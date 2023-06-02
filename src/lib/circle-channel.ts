import { EventEmitter } from "events";
import { SEA, type GunHookMessagePut, type IGunChain, type IGunOnEvent, type ISEAPair, type IGunInstance, type IGunInstanceRoot} from "gun";

import dayjs from 'dayjs'
import dayjsParse from 'dayjs/plugin/customParseFormat'
import dayjsUtc from 'dayjs/plugin/utc'
import dayjsFormat from "dayjs/plugin/advancedFormat";
import { getUserSpacePath, randStr } from "./utils";
dayjs.extend(dayjsParse)
dayjs.extend(dayjsUtc)
dayjs.extend(dayjsFormat)

export type CircleMiddleware = (data: any, key: string, metadata?: GunHookMessagePut) => any | Promise<any>
export type CircleEvents = {
    "recv-chat" : [data: any, key: string, unread: boolean, metadata: GunHookMessagePut, doRead: () => void]
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
    keyFormat = "x[|[UUID]]"
    private _config: ChannelConfig = {}
    get config(): ChannelConfig { return {...this._config} }
    private sendMiddlewares: Set<CircleMiddleware> = new Set()
    private recvMiddlewares: Set<CircleMiddleware> = new Set()
    private recvOnEvent?: IGunOnEvent
    private chats: Map<string, any> = new Map()
    // TODO: make btree node index accessable outside for slicing
    // private chatsKeySorted = new SortedArray<string>()
    private _unreadKeys = new Array<string>()
    get unreadKeys() { return [...this._unreadKeys] }
    private uuid: (l?: number) => string
    private _listenOnly: boolean
    get listenOnly() { return this._listenOnly }
    set listenOnly(v: boolean) {
        if (v === this._listenOnly) return
        this._listenOnly = v
        if (!v) {
            this.off('send-chat', this.send)
        } else if (this.recvOnEvent) {
            this.on('send-chat', this.send)
        }
    }
    private _configListenOnly: boolean
    get configListenOnly() { return this._configListenOnly }
    set configListenOnly(v: boolean) {
        if (v === this._configListenOnly) return
        this._configListenOnly = v
    }
    start?: number
    end?: number
    constructor(
        gun: IGunChain<any, any, any, string>,
        config: ChannelConfig,
        sendMiddlewares?: CircleMiddleware[],
        recvMiddlewares?: CircleMiddleware[],
        keyFormat?: string,
        listenOnly?: boolean,
        configListenOnly?: boolean,
        start?: number,
        end?: number
    ) {
        super()
        this.gun = gun
        this._config = config
        this.keyFormat = keyFormat || this.keyFormat
        sendMiddlewares?.map(v => this.sendMiddlewares.add(v))
        recvMiddlewares?.map(v => this.recvMiddlewares.add(v))
        this._listenOnly = listenOnly ??= false
        this._configListenOnly = configListenOnly ??= false
        this.start = start
        this.end = end
        this.uuid = gun.back("opt.uuid" as any) 
        this.init()
    }
    private saveConfig() {
        if (!this._configListenOnly)
            this.emit('config', this._config)
    }
    loadConfig(config: ChannelConfig) {
        if (JSON.stringify(config) === JSON.stringify(this._config)) return
        let greaterLastRead = (config.lastRead||'') > (this._config.lastRead||'')
        this._config = {
            ...config,
            lastRead: greaterLastRead ? config.lastRead : this._config.lastRead
        }
        if (greaterLastRead) {
            this._unreadKeys = this._unreadKeys.filter(k => k > (this._config.lastRead||''))
        }
        this.saveConfig()
    }
    private send = async (data: any, k?: string) => {
        var v = data
        const key = k || dayjs.utc().format(this.keyFormat).replace("[UUID]", this.uuid(-1))
        for (const md of this.sendMiddlewares) {
            let res = md(v, key)
            if (res instanceof Promise)
                res = await res
            v = res
        }
        const isNew = (key > (this._config.lastRead || '')) && !this.chats.has(key)
        if (isNew) {
            this._unreadKeys.push(key)
            this.markRead()
        }
        this.chats.set(key, data)
        this.gun.get(key).put(v)
    }
    private init() {
        this.gun.map().on(async (v, k, meta, eve) => {
            this.recvOnEvent = eve
            if (this.start && (meta.put[">"] < this.start)) return
            if (this.end && (meta.put[">"] > this.end)) return
            var data = v
            for (const md of this.recvMiddlewares) {
                let res = md(data, k, meta)
                if (res instanceof Promise)
                    res = await res
                data = res
            }
            const isUnread = k > (this._config.lastRead || '')
            var read = false
            this.emit("recv-chat", data, k, isUnread, meta, () => read = true)
            if (isUnread && !this.chats.has(k) && !read) {
                this._unreadKeys.push(k)
                this.markNumRead = this._unreadKeys.length
            }
            if (read) {
                this._unreadKeys.push(k)
                await this.markRead()
            }
            this.chats.set(k, data)
            
        })
        if (!this._listenOnly) {
            this.on("send-chat", this.send)
        }
    }

    deinit() {
        if (this.send) {
            this.off("send-chat", this.send)
        }
        if (this.recvOnEvent) {
            this.recvOnEvent.off()
            this.recvOnEvent = undefined
        }
    }

    get lastRead() { return this._config.lastRead }
    get numUnreads() { return this._unreadKeys.length }
    isUnread(key: string) { return key > (this._config.lastRead || '') }

    async read(res?: Map<string, any>) {
        res ??= new Map<string, any>()
        for (const k of this._unreadKeys) {
            res.set(k, this.chats.get(k))
        }
        await this.markRead()
        return res
    }

    async readAll(res?: Map<string, any>) {
        await this.markRead()
        res ??= new Map()
        for (const k of this.chats.keys()) {
            res.set(k, this.chats.get(k))
        }
        return res
    }

    private _markLastNumRead = 0
    private set markNumRead(numRead: number) {
        if (this._markLastNumRead === numRead) return
        this._markLastNumRead = numRead
        this.emit("num-reads", numRead)
    }
    private _markLastRead = ''
    private set markLastRead(lastRead: string) {
        if (this._markLastRead === lastRead) return
        this._markLastRead = lastRead
        this.emit("last-read", lastRead)
    }
    async markRead() {
        var lastRead = this._unreadKeys[this._unreadKeys.length-1]
        if (!lastRead) return
        this._config.lastRead = lastRead
        this._unreadKeys = []
        this.markNumRead = 0
        this.markLastRead = lastRead
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

// Inside group's user space
export type GroupData = {
    dat: {
        /** path based on owner secret */
        [path: string]: /** encrypted w/ owner secret */  {
            id: string
            key: string // group secret for this instance
            next?: string
            prev?: string
            start: number
            end?: number
        }
    }
    // member pub key
    mem: /** encrypted w/ group secret */ {
        [path: string]: {
            pub: string
            epub: string
        } 
    }
}

//Inside member's user space
export type GroupsJoined = /** encrypted */ {
    [path: string] : {
        path: string
        owner: {
            pub: string,
            epub: string
        },
        msgs: {
            [ts: string]: string
        }
    }
}

export type GroupState = 'initializing' | 'ready' | 'invalid'

export type GroupNodeEvents = {
    "statechange": [state: GroupState]
    "next-available": [path: string]
    "prev-available": [path: string]
    "ended": []
} & CircleEvents

export class GroupNode extends EventEmitter<GroupNodeEvents> {
    private _isEnded = false
    get isEnded() { return this._isEnded }
    private _isCurrent = true
    get isCurrent() { return this._isCurrent }
    private _invalidReason?: string
    get invalidReason() { return this._invalidReason }
    private _state: GroupState = 'initializing'
    private groupSecret?: string
    private myGroupPath?: string
    get state() { return this._state }
    set state(s: GroupState) {
        if (this._state === s) return
        this._state = s
        this.emit('statechange', s)
    }
    private _members: Map<string, {pub: string, epub: string}> = new Map()
    private _memberChannels: Map<string, CircleChannel> = new Map()
    get members() { return new Map(this._members) }
    get memberChannels() { return new Map(this._memberChannels) }
    private start?: number
    private end?: number
    private _id?: string
    get id() { return this._id }
    // readonly gun: IGunChain<any, any, any, string>

    private _prevPath?: string
    get prevPath() { return this._prevPath }
    private _nextPath?: string
    get nextPath() { return this._nextPath }
    private _prevNode?: GroupNode
    get prevNode(): GroupNode | undefined {
        if (!this.prevPath) return
        if (!this._prevNode) {
            const node  = new GroupNode(this.gun.back(-1), this.prevPath, this.ownerPub, this.myPair)
            node._nextNode = this
            node._nextPath = this.path
            this._prevNode = node
        }
        return this._prevNode
    }
    private _nextNode?: GroupNode
    get nextNode(): GroupNode | undefined {
        if (!this.nextPath) return
        if (!this._nextNode) {
            const node  = new GroupNode(this.gun.back(-1), this.nextPath, this.ownerPub, this.myPair)
            node._prevNode = this
            node._prevPath = this.path
            this._nextNode = node
        }
        return this._nextNode
    }

    constructor(
        readonly gun: IGunChain<any, any, any, string>,
        readonly path: string,
        readonly ownerPub: {pub: string, epub: string},
        readonly myPair: ISEAPair,
        init?: boolean
    ) {
        super()
        this.once('statechange', (s) => {
            if (s !== 'ready') return
        })
        if (init ??= true)
            this.init()
    }

    private setInvalid(reason: string) {
        this.state = 'invalid'
        this._invalidReason = reason
    }
    // private groupDataEve?: IGunOnEvent
    // private groupDataEnc?: string
    private groupData?: GroupData["dat"][any]
    static async createFriendGroup(
        gun: IGunChain<any, any, any, string>,
        friend: {pub: string, epub: string},
        myPair: ISEAPair
    ) {
        const shared = await SEA.secret(friend, myPair)
        if (!shared) 
            throw "Can't create shared key!"
        const myPath = await getUserSpacePath(myPair.pub, shared)
        const friendPath = await getUserSpacePath(friend.pub, shared)
        const groupId = await getUserSpacePath([myPair.pub, friend.pub].sort().join(''), shared)
        const node = new GroupNode(gun, '', friend /** Disables group rotation */, myPair, false)
        
        node._members = new Map([
            [friendPath, friend],
            [myPath, { pub: myPair.pub, epub: myPair.epub }]
        ])
        node.groupData = {
            id: groupId,
            key: shared,
            start: 0
        }
        setTimeout(() => node.state = 'ready', 5)
        return node
    }
    private async init() {
        const ownerSecret = await SEA.secret(this.ownerPub.epub, this.myPair)
        const myPath = await getUserSpacePath(this.myPair.pub, ownerSecret!)
        const root = (this.gun.back(-1) as IGunInstanceRoot<any, any>)
        const groupGun = root.get(this.path)
        // Get group info
        // const gData = this.gData = await this.gun.then() as typeof this.gData
        // if (!gData || !gData.dat || !gData.mem) {
        //     this.setInvalid("Can't get group info!")
        //     return
        // }
        const gMem = await groupGun.get("mem").then()
        if (!gMem)
            throw 'Cannot get member data!'

        var groupDataEnc = ''
        root.get(`${this.path}/dat`).get(myPath).on(async (v, _, __, eve) => {
            // this.groupDataEve = eve
            if (!v) {
                if (!groupDataEnc) 
                    this.setInvalid("Group info empty!")
                return
            }
            if (v === groupDataEnc) return
            groupDataEnc = v

            let dat: GroupData["dat"][any] = this.groupData = await SEA.decrypt(await SEA.verify(v, this.ownerPub.pub), ownerSecret!)
            if (!dat || !dat.key) {
                this.setInvalid("Invalid group info or access forbidden!")
                return
            }
            this.groupSecret = dat.key
            this._id = dat.id
            this.myGroupPath = await getUserSpacePath(this.myPair.pub, this.groupSecret)


            // Determine neighbour node
            if (dat.next) {
                this._isCurrent = false
                this._nextPath = dat.next
                setTimeout(() => this.emit("next-available", dat.next!), 1)
            }
            if (dat.prev) {
                this._prevPath = dat.prev
                setTimeout(() => this.emit("prev-available", dat.prev!), 1)
            }

            // Get members
            if (this._members.size === 0) {
                this.start = dat.start
                this.end = dat.end

                let mem: GroupData["mem"] = await SEA.decrypt(gMem, dat.key)
                if (!mem) {
                    this.setInvalid("Can't get group members!")
                    return
                }
                let memKeys = Object.keys(mem)
                if (memKeys.length === 0) {
                    this.setInvalid("Group has 0 members!")
                    return
                }
                memKeys.map(k => this._members.set(k, mem[k]))
            }

            var startEndChanged = this.start !== dat.start || this.end !== dat.end
            if (startEndChanged) {
                this.start = dat.start
                this.end = dat.end
                for (const [path, c] of this._memberChannels.entries()) {
                    c.start = this.start
                    c.end = this.end
                }
            }

            if (this.end || dat.next) {
                this._isEnded = true
                this.emit("ended")
            }

            this.state = "ready"
        })
    }
    getMember(path: string) {
        return this._members.get(path)
    }
    markRead() {
        for (let i = 0; i < this.channelArr.length; i++) {
            this.channelArr[i].markRead()
        }
    }
    async read() {
        let res = new Map<string, any>()
        let proms: Promise<any>[] = []
        for (let i = 0; i < this.channelArr.length; i++) {
            proms.push(this.channelArr[i].read(res))
        }
        await Promise.all(proms)
        return res
    }
    async readAll() {
        let res = new Map<string, any>()
        let proms: Promise<any>[] = []
        for (let i = 0; i < this.channelArr.length; i++) {
            proms.push(this.channelArr[i].readAll(res))
        }
        await Promise.all(proms)
        return res
    }
    private _numUnreads = 0
    get numUnreads() { return this._numUnreads }
    private isCurrentFn?: () => void
    private channelArr: CircleChannel[] = []
    get channel() { return [...this.channelArr] }
    private myChannel?: CircleChannel
    get writeChannel()  { return this.myChannel }
    get isMine() { 
        return this.myPair.pub === this.ownerPub.pub && this.myPair.epub === this.ownerPub.epub
    }
    async listen(gunConfig: IGunChain<any, any, any, string>) {
        if (this.state !== 'ready') throw 'Group is not ready'
        let root: IGunInstanceRoot<any, any> = this.gun.back(-1)
        let lastConfigEnc = ''
        let configEnc = await gunConfig.on(async (d) => {
            if (!d || lastConfigEnc === d) return
            lastConfigEnc = d
            let c = await SEA.decrypt(
                d, 
                this.groupData?.key!
            )
            if (!c) return
            for (let i = 0; i < this.channelArr.length; i++) {
                this.channelArr[i].loadConfig(c);
            }
        }).then()
        var config: ChannelConfig | undefined = await SEA.decrypt(configEnc, this.groupData?.key!)
        config = typeof config !== 'object' ? {} : config
        for (const [path, mem] of this._members.entries()) {
            const g = root.get(`~${mem.pub}/c/${this.groupData?.id}/msgs`)
            const isMe = mem.pub === this.myPair.pub
            const channel = new CircleChannel(
                g, 
                config, 
                isMe 
                    ? [async (data) => await SEA.sign(await SEA.encrypt(data, this.groupData?.key!), this.myPair)] 
                    : undefined,
                [async (data) => await SEA.decrypt(await SEA.verify(data, mem), this.groupData?.key!)],
                undefined,
                !isMe || !this.isCurrent,
                !this.isCurrent,
                this.start,
                this.end
            )
            this.channelArr.push(channel)
            channel.on('num-reads', async () => {
                let total = 0
                for (let i = 0; i < this.channelArr.length; i++) {
                    total += this.channelArr[i].numUnreads;
                }
                this._numUnreads = total
                this.emit('num-reads', total)
            })
            channel.on('recv-chat', async (m, k, u, meta, fn) => this.emit("recv-chat", m, k!, u!, meta!, fn!))
            channel.on('config', async (c) => {
                gunConfig.put(await SEA.encrypt(c, this.groupData?.key!))
            })
            this._memberChannels.set(path, channel)
            if (isMe) {
                this.myChannel = channel
            }
        }
        
        if (this._isCurrent && !this.isCurrentFn) {
            let sendFn: (data: any, key?: string) => void
            this.once("ended", this.isCurrentFn = () => {
                for (const [path, c] of this._memberChannels.entries()) {
                    c.configListenOnly = true
                    c.listenOnly = true
                }
                this.off('send-chat', sendFn)
            })
            this.on('send-chat', sendFn = (data, key) => {
                this.myChannel?.emit('send-chat', data, key)
                this.markRead()
            })
        }
        
        if (this.isCurrent && this.isMine) {
            this.rotate = async (owner, members) => {
                if (this.state !== 'ready') throw 'Group is not ready!'
                if (!this.isCurrent) throw 'Group is not the latest node!'
                if (owner.pub !== this.ownerPub.pub || owner.epub !== this.ownerPub.epub) 
                    throw 'You are not the group owner!'
                const ownerShared = await SEA.secret(owner.epub, owner)
                if (!ownerShared)
                    throw 'Failed to create owner secret!'
                const pairPath = await getUserSpacePath("pair", ownerShared!)
                const root: IGunInstance<any> = (this.gun as any).back(-1)
                const groupPairData = await root.get(`${this.path}/dat`).get(pairPath).then()
                const oldGroupPair: ISEAPair | undefined = await SEA.decrypt(await SEA.verify(groupPairData, owner), ownerShared)
                if (!oldGroupPair) 
                    throw 'Failed to retreive old group key pair!'
                const cert = await SEA.certify([root._.user?._.sea?.pub!], {'#': {'*': this.id}}, oldGroupPair, undefined, {expiry: (5*60*1000)+(+new Date())})
                const groupEnd = +new Date()
                const oldMembers = new Set(this.members.values())
                const newMembers = new Set(members ??= Array.from(oldMembers))
                const oldNewMember = Array.from(newMembers).filter(m => oldMembers.has(m))
                
                const { groupId, groupPath, groupPair } = await GroupNode.createNew(root as any, owner, members, this.path, oldNewMember)
                const groupData = Object.fromEntries(await Promise.all(Array.from(oldMembers).map(async (m) => {
                    const shared = await SEA.secret(m.epub, owner)
                    return Promise.all([
                        getUserSpacePath(m.pub, shared!),
                        SEA.sign(await SEA.encrypt((() => {
                            let dat: GroupData["dat"][any] = {
                                id: groupId,
                                key: this.groupData?.key!,
                                start: this.groupData?.start!,
                                end: groupEnd
                            }
                            if (this.groupData?.prev) dat.prev = this.groupData.prev
                            if (newMembers.has(m)) dat.next = groupPath
                            return dat
                        })(), shared!), owner)
                    ])
                })))
                root.get(`${this.path}/dat`).put(groupData, undefined, {opt: {cert: cert}})
                return { groupId, groupPath, groupPair }
            }
        }
    }

    rotate?: (owner: ISEAPair, member?: {pub: string, epub: string}[]) => Promise<{ groupId: string, groupPath: string, groupPair: ISEAPair }>

    static async createNew(gun: IGunChain<any, any, any, string>, owner: ISEAPair, members: {pub: string, epub: string}[], prev?: string, prevMembers?: {pub: string, epub: string}[]) {
        const groupPair = await SEA.pair()
        const groupKey = randStr(43)
        const groupId = (gun as any).back("opt.uuid")() as string
        const groupCert = await SEA.certify([gun._.user?._.sea?.pub!], {'#': {'*': groupId}}, groupPair, undefined, {expiry: (5*60*1000)+(+new Date())})
        const groupStart = +new Date()
        let memberSet = new Set(members)
        memberSet.add({pub: owner.pub, epub: owner.epub})
        members = Array.from(memberSet)
        const prevMemberSet = new Set(prevMembers ??= members)
        const [groupData, memberDataEnc] = await Promise.all([
            Promise.all(members.map(async (m) => {
                const shared = await SEA.secret(m.epub, owner)
                return Promise.all([
                    getUserSpacePath(m.pub, shared!),
                    SEA.sign(await SEA.encrypt((() => {
                        let dat: GroupData["dat"][any] = {
                            id: groupId,
                            key: groupKey,
                            start: groupStart,
                        }
                        if (prev && prevMemberSet.has(m)) dat.prev = prev
                        return dat
                    })(), shared!), owner)
                ])
            })),
            SEA.encrypt(
                Object.fromEntries(
                    await Promise.all(members.map(async (m) => {
                        return [
                            await getUserSpacePath(m.pub, groupKey),
                            { pub: m.pub, epub: m.epub }
                        ]
                    }))
                ),
                groupKey
            )
        ]) 
        const data: {
            dat: {
                [path: string]: string
            },
            mem: string
        } = {
            dat: Object.fromEntries(groupData),
            mem: memberDataEnc
        }

        // Store group pair inside group data using owner's key
        const mySec = await SEA.secret(owner.epub, owner)
        data.dat[await getUserSpacePath("pair", mySec!)] = await SEA.sign(await SEA.encrypt(groupPair, mySec!), owner)

        const put = await (gun as any).back(-1).get(`~${groupPair.pub}`).get(`${groupId}`).put(data, undefined, {opt: {cert: groupCert}})
            .then()
        return { groupId: groupId, groupPath: put._["#"] as string, groupPair: groupPair }
    }
}

export async function createSEAMiddleware(otherPub: {pub: string, epub: string}, myPair: ISEAPair): Promise<{
    send: CircleMiddleware,
    recv: CircleMiddleware
}> {
    const shared = await SEA.secret(otherPub, myPair)
    if (!shared) throw "Can't create shared key pair!"
    return {
        send: async (data) => {
            return await SEA.sign(await SEA.encrypt(data, shared), myPair)
        },
        recv: async (data) => {
            return await SEA.decrypt(await SEA.verify(data, otherPub), shared)
        }
    }
}