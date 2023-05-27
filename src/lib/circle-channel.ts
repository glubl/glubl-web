import { EventEmitter } from "events";
import type { GunHookMessagePut, IGun, IGunChain, IGunInstance, IGunOnEvent } from "gun";
import * as lo from 'lodash'

import dayjs from 'dayjs'
import dayjsParse from 'dayjs/plugin/customParseFormat'
import dayjsUtc from 'dayjs/plugin/utc'
dayjs.extend(dayjsParse)
dayjs.extend(dayjsUtc)

export type CircleMiddleware = (data: any, key: string, metadata?: GunHookMessagePut) => any | Promise<any>
export type CircleEvents = {
    "recv-chat" : [data: any, key: string, unread: boolean, metadata: GunHookMessagePut]
    "send-chat" : [data: any, key?: string]
    "config"    : [config: ChannelConfig]
    "last-read" : [key: string]
    "num-reads" : [num: number]
}

interface ChannelConfig {
    lastRead?: string
}

//TODO: implement message slicing between 2 keys
export class CircleChannel extends EventEmitter<CircleEvents> {
    gun: IGunChain<any, any, any, string>
    gunConfig: IGunChain<any, any, any, string>
    keyFormat = "YYYY-MM-DD[T]HH:mm:ss.SSS[Z]|[[UUID]]"
    private sendMiddlewares: Set<CircleMiddleware> = new Set()
    private recvMiddlewares: Set<CircleMiddleware> = new Set()
    private recvOnEvent?: IGunOnEvent
    private confOnEvent?: IGunOnEvent
    private chats: Map<string, any> = new Map()
    // TODO: make btree node index accessable outside for slicing
    // private chatsKeySorted = new SortedArray<string>()
    private unreadKeys = new Array<string>()
    private config: ChannelConfig = {}
    private uuid: (l?: number) => string
    constructor(
        gun: IGunChain<any, any, any, string>,
        gunConfig: IGunChain<any, any, any, string>,
        sendMiddlewares?: CircleMiddleware[],
        recvMiddlewares?: CircleMiddleware[],
        keyFormat?: string
    ) {
        super()
        this.gun = gun
        this.gunConfig = gunConfig
        this.keyFormat = keyFormat || this.keyFormat
        sendMiddlewares?.map(v => this.sendMiddlewares.add(v))
        recvMiddlewares?.map(v => this.recvMiddlewares.add(v))
        this.uuid = gun.back("opt.uuid" as any) 
        this.init()
    }
    private saveConfig = lo.debounce(() => {
        if (this.config.lastRead === undefined || this.config.lastRead === '') return
        this.gunConfig.put(this.config)
    }, 2000)
    private send?: (data: any) => Promise<void>
    init() {
        this.gunConfig.on((d) => {
            if (typeof d !== 'object') {
                d = {}
            }
            if (JSON.stringify(d) === JSON.stringify(this.config)) return
            this.config = {
                ...d,
                lastRead: this.config.lastRead || d.lastRead
            }
            this.emit("config", d)
        })
        this.gun.map().on(async (v, k, meta, eve) => {
            this.recvOnEvent = eve
            var data = v
            for (const md of this.recvMiddlewares) {
                let res = md(data, k, meta)
                if (res instanceof Promise)
                    res = await res
                data = res
            }
            const isUnread = k > (this.config.lastRead || '')
            if (isUnread && !this.chats.has(k)) {
                this.unreadKeys.push(k)
                setTimeout(() => this.emit("num-reads", this.unreadKeys.length), 1)
            }
            this.chats.set(k, data)
            this.emit("recv-chat", data, k, isUnread, meta)
        })
        this.on("send-chat", this.send = async (data: any, k?: string) => {
            var v = data
            const key = k || dayjs.utc().format(this.keyFormat).replace("[UUID]", this.uuid(-1))
            for (const md of this.sendMiddlewares) {
                let res = md(v, key)
                if (res instanceof Promise)
                    res = await res
                v = res
            }
            const isNew = (key > (this.config.lastRead || '')) && !this.chats.has(key)
            if (isNew) {
                this.unreadKeys.push(key)
                this.markRead(false)
            }
            this.chats.set(key, data)
            this.gun.get(key).put(v)
        })
    }

    deinit() {
        if (this.send) {
            this.off("send-chat", this.send)
            this.send = undefined
        }
        if (this.recvOnEvent) {
            this.recvOnEvent.off()
            this.recvOnEvent = undefined
        }
    }

    get lastRead() { return this.config.lastRead }
    get numUnreads() { return this.unreadKeys.length }
    isUnread(key: string) { return key > (this.config.lastRead || '') }

    read() {
        const res = new Map<string, any>()
        for (const k of this.unreadKeys) {
            res.set(k, this.chats.get(k))
        }
        this.markRead()
        return res
    }

    readAll() {
        this.markRead()
        return new Map(this.chats)
    }

    markRead(emitNum?: boolean, emitLast?: boolean) {
        var lastRead: string
        if (
            this.unreadKeys.length === 0 
            || (lastRead = this.unreadKeys[this.unreadKeys.length-1]) === this.config.lastRead
        ) return
        this.config.lastRead = lastRead
        this.unreadKeys = []
        if (emitNum ??= true)
            this.emit("num-reads", 0)
        if (emitLast ??= true)
            this.emit("last-read", lastRead)
        this.saveConfig()
    }

    addSendMiddleware(fn: CircleMiddleware) {
        this.sendMiddlewares.add(fn)
    }

    addRecvMiddleware(fn: CircleMiddleware) {
        this.recvMiddlewares.add(fn)
    }

    removeSendMiddleware(fn: CircleMiddleware) {
        return this.sendMiddlewares.delete(fn)
    }

    removeRecvMiddleware(fn: CircleMiddleware) {
        return this.recvMiddlewares.delete(fn)
    }
}