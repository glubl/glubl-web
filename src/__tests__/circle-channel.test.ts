import { getUserSpacePath, randStr } from "../lib/utils"
import { CircleChannel, GroupNode, type CircleMiddleware, type GroupData, type GroupState } from "../lib/circle-channel"
import Gun from "gun"
import SEA from "gun/sea"
import "gun/lib/then"
import "gun/lib/radix"
import "gun/lib/radisk"
import "gun/lib/store"
import type { IGunInstance, IGunUserInstance } from "gun"
import dayjs from "dayjs"

var d: any = {}
var gun: IGunInstance
var user: IGunUserInstance

beforeEach(() => {
    gun = Gun({
        store: {
            put: (key: string, value: any, callback?: ((err: any, value: any) => void)) => {
                d[''+key] = value
                ;(callback||(()=>{}))(null, 1)
            },
            get: (key: string, callback?: ((err: any, value: any) => void) | undefined) => {
                ;(callback||(()=>{}))(null, d[''+key])
            }
        },
        peers: [] as any,
        file: "local",
        WebSocket: false,
        ws: false,
        axe: false,
        super: false,
        multicast: false,
        stats: false
    })
    user = gun.user()
})

describe("Chat", () => {
    it("should send and listen to channel", async () => {
        var  gg = gun.get("test0")
        const message1 = "Test message1"
        const message2 = "Test message2"
        const circle1 = new CircleChannel(gg.get("msg"), {})
        const circle2 = new CircleChannel(gg.get("msg"), {})

        let recvMsgs1: [string, string, boolean][] = []
        let recvMsgs2: [string, string, boolean][] = []
        circle1.on("recv-chat", (v, k, unread) => recvMsgs1.push([v, k!, unread!]))
        circle2.on("recv-chat", (v, k, unread) => recvMsgs2.push([v, k!, unread!]))
        
        circle1.emit("send-chat", message2)
        await new Promise(res => setTimeout(res, 50))
        circle2.emit("send-chat", message1)
        await new Promise(res => setTimeout(res, 50))
        expect(recvMsgs1.map(([v,_,u]) => [v,u])).toEqual([
            ["Test message2", false],
            ["Test message1", true],
        ])
        expect(recvMsgs2.map(([v,_,u]) => [v,u])).toEqual([
            ["Test message2", true],
            ["Test message1", false],
        ])
        expect(Array.from((await circle1.read()).values())).toEqual(["Test message1"])
        expect(Array.from((await circle2.read()).values())).toEqual([])
        expect(Array.from((await circle1.readAll()).values())).toEqual(["Test message2", "Test message1"])
        expect(Array.from((await circle2.readAll()).values())).toEqual(["Test message2", "Test message1"])
        
    })

    it("should sync config", async () => {
        var  gg = gun.get("test1")
        const pair = await SEA.pair()
        const message1 = "Test message1"
        const message2 = "Test message2"
        const config1 = gg.get("config").get("1")
        const config2 = gg.get("config").get("2")
        const circle1 = new CircleChannel(gg.get("msg"), {})
        const circle2 = new CircleChannel(gg.get("msg"), {})
        circle1.on('config', async c => {config1.put(await SEA.sign(await SEA.encrypt(c, pair), pair))})
        circle2.on('config', async c => {config2.put(await SEA.sign(await SEA.encrypt(c, pair), pair))})
        config1.on(async v => circle1.loadConfig(await SEA.decrypt(await SEA.verify(v, pair), pair)))
        config2.on(async v => circle2.loadConfig(await SEA.decrypt(await SEA.verify(v, pair), pair)))

        let recvMsgs1: [string, string, boolean][] = []
        let recvMsgs2: [string, string, boolean][] = []
        circle1.on("recv-chat", (v, k, unread) => recvMsgs1.push([v, k!, unread!]))
        circle2.on("recv-chat", (v, k, unread) => recvMsgs2.push([v, k!, unread!]))
        
        circle1.emit("send-chat", message2)
        await new Promise(res => setTimeout(res, 50))
        circle2.emit("send-chat", message1)
        await new Promise(res => setTimeout(res, 50))
        expect(recvMsgs1.map(([v,_,u]) => [v,u])).toEqual([
            ["Test message2", false],
            ["Test message1", true],
        ])
        expect(recvMsgs2.map(([v,_,u]) => [v,u])).toEqual([
            ["Test message2", true],
            ["Test message1", false],
        ])
        expect(circle1.numUnreads).toEqual(1)
        expect(circle2.numUnreads).toEqual(0)

        const circle1_2 = new CircleChannel(gg.get("msg"), {})
        let prom = new Promise(res => circle1_2.once('config', res))
        circle1_2.on('config', async c => {config1.put(await SEA.sign(await SEA.encrypt(c, pair), pair))})
        config1.on(async v => circle1_2.loadConfig(await SEA.decrypt(await SEA.verify(v, pair), pair)))
        await prom
        expect(circle1_2.config.lastRead).toEqual(recvMsgs1[0][1])
        expect(Array.from((await circle1_2.readAll()).entries()).sort(([k1],[k2]) => k1 < k2 ? -1 : 1))
            .toEqual(recvMsgs1.map(([v,k]) => [k,v]))
        
        await new Promise(res => setTimeout(res, 50))
        expect(circle1.numUnreads).toEqual(0)
        expect(circle1.config.lastRead).toEqual(circle2.config.lastRead)
    })

    it("should use middlewares", async () => {
        var  gg = gun.get("test2")
        const message = "Test message"
        const secret = "secret"
        const sendMiddlewares: CircleMiddleware[] = [
            async (v) => await SEA.encrypt(v, secret),
            async (v, k) => k + v
        ]
        const recvMiddlewares: CircleMiddleware[] = [
            async (v, k) => v.replace(k, ''),
            async (v, _) => await SEA.decrypt(v, secret)
        ]
        const circle1 = new CircleChannel(gg.get("msg"), {}, sendMiddlewares, recvMiddlewares)
        const circle2 = new CircleChannel(gg.get("msg"), {}, sendMiddlewares, recvMiddlewares)
        var msgRecv = await new Promise((res) => {
            circle1.on("recv-chat", v => res(v))
            circle2.emit("send-chat", message)
        })
        expect(msgRecv).toEqual(message)
    })

    it("should ignore before start and after end", async () => {
        var  gg = gun.get("test3")
        const uuid = (gun as any).back("opt.uuid")
        let messages: string[] = Array.from({length: 4}, uuid)
        gg.get(dayjs.utc().format("x[|[UUID]]").replace("[UUID]", uuid(-1))).put(messages[0])

        await new Promise(res => setTimeout(res, 50))
        const start = +new Date()
        const end = start + 500
        
        const circle1 = new CircleChannel(gg.get("msg"), {}, undefined, undefined, undefined, undefined, undefined, start, end)
        var msgs: string[] = []
        circle1.on("recv-chat", v => {
            msgs.push(v)
        })
        circle1.emit("send-chat", messages[1])
        circle1.emit("send-chat", messages[2])
        await new Promise(res => setTimeout(res, 500))
        circle1.emit("send-chat", messages[3])
        await new Promise(res => setTimeout(res, 500))
        expect(msgs).toEqual(messages.slice(1,3))
    })

    it("should store unreads", async () => {
        const gg = gun.get("test4")
        const pair = await SEA.pair()
        const messages1 = ["1", "2", "3"]
        const messages2 = ["4", "5", "6", "7", "8"]
        const config1 = gg.get("config").get("1")
        const config2 = gg.get("config").get("2")
        const circle1 = new CircleChannel(gg.get("msg"), {})
        const circle2 = new CircleChannel(gg.get("msg"), {})
        circle1.on("num-reads", (n) => numUnreads1.push(n))
        circle2.on("num-reads", (n) => numUnreads2.push(n))
        var numUnreads1: number[] = []
        var numUnreads2: number[] = []
        circle1.on('config', async c => {config1.put(await SEA.sign(await SEA.encrypt(c, pair), pair))})
        circle2.on('config', async c => {config2.put(await SEA.sign(await SEA.encrypt(c, pair), pair))})
        config1.on(async v => circle1.loadConfig(await SEA.decrypt(await SEA.verify(v, pair), pair)))
        config2.on(async v => circle2.loadConfig(await SEA.decrypt(await SEA.verify(v, pair), pair)))
        

        var prom = new Promise<string[]>((res) => {
            var keys: string[] = []
            circle1.on("recv-chat", function fn(d, k, u) {
                if (u)
                    keys.push(k)
                if (keys.length >= messages1.length) {
                    circle1.off("recv-chat", fn)
                    res(keys)
                }
            })
        })
        for (const m of messages1) {
            circle2.emit("send-chat", m)
            await new Promise((res) => setTimeout(res, 10))
        }
        const keys1 = await prom

        expect(circle1.numUnreads).toEqual(messages1.length)
        expect(circle2.numUnreads).toEqual(0)
        for (const k of keys1)
            expect(circle1.isUnread(k)).toBeTruthy()
        const unreads1 = Array.from((await circle1.read()).values())
        for (const k of keys1)
            expect(circle1.isUnread(k)).toBeFalsy()
        expect(unreads1).toEqual(messages1)
        expect(circle1.numUnreads).toEqual(0)
        expect(circle2.numUnreads).toEqual(0)

        prom = new Promise<string[]>((res) => {
            var keys: string[] = []
            circle2.on("recv-chat", function fn(d, k, u) {
                if (u)
                    keys.push(k)
                if (keys.length >= messages2.length) {
                    circle2.off("recv-chat", fn)
                    res(keys)
                }
            })
        })
        for (const m of messages2) {
            circle1.emit("send-chat", m)
            await new Promise((res) => setTimeout(res, 10))
        }
        const keys2 = await prom

        expect(circle1.numUnreads).toEqual(0)
        expect(circle2.numUnreads).toEqual(messages2.length)
        for (const k of keys2)
            expect(circle2.isUnread(k)).toBeTruthy()
        const unreads2 = Array.from((await circle2.read()).values())
        for (const k of keys2)
            expect(circle2.isUnread(k)).toBeFalsy()
        expect(unreads2).toEqual(messages2)
        expect(circle1.numUnreads).toEqual(0)
        expect(circle2.numUnreads).toEqual(0)

        let markRead = true
        let prom2 = new Promise<[string[], string[]]>((res) => {
            var keys: string[] = []
            var readKeys: string[] = []
            circle2.on("recv-chat", function fn(d, k, u, m, rd) {
                if (u && !markRead)
                    keys.push(k)
                if (u && markRead) {
                    readKeys.push(k)
                    rd()
                }                   
                if ((keys.length + readKeys.length) >= (messages1.length * 2)) {
                    circle2.off("recv-chat", fn)
                    res([keys, readKeys])
                }
            })
        })
        for (const m of messages1) {
            circle1.emit("send-chat", m)
            await new Promise((res) => setTimeout(res, 100))
        }
        markRead = false
        for (const m of messages1) {
            circle1.emit("send-chat", m)
            await new Promise((res) => setTimeout(res, 100))
        }
        const [keys3, readKeys3] = await prom2

        expect(circle1.numUnreads).toEqual(0)
        expect(circle2.numUnreads).toEqual(messages1.length)
        for (const k of keys3)
            expect(circle2.isUnread(k)).toBeTruthy()
        for (const k of readKeys3)
            expect(circle2.isUnread(k)).toBeFalsy()
        const unreads3 = Array.from((await circle2.read()).values())
        for (const k of keys3)
            expect(circle2.isUnread(k)).toBeFalsy()
        expect(unreads3).toEqual(messages1)
        expect(circle1.numUnreads).toEqual(0)
        expect(circle2.numUnreads).toEqual(0)
        
        expect(numUnreads1).toEqual([1, 2, 3, 0])
        expect(numUnreads2).toEqual([1, 2, 3, 4, 5, 0, 1, 2, 3, 0])

        expect(circle1.lastRead).toEqual(circle2.lastRead)
        const allKeys = keys1.concat(keys2).concat(keys3).sort()
        expect(circle1.lastRead).toEqual(allKeys[allKeys.length - 1])
    })
})

describe("Group", () => {

    it("should crate and parse from gun", async () => {
        const [owner, member1, member2] = await Promise.all([
            SEA.pair(),
            SEA.pair(),
            SEA.pair()
        ])
        await new Promise(res => user.auth(owner, res))
        const { groupId, groupPath } = await GroupNode.createNew(gun as any, owner, [member1, member2])
        user.leave()
        await new Promise(res => user.auth(member1, res))

        let gn = new GroupNode(
            gun, 
            groupPath,
            { pub: owner.pub, epub: owner.epub }, 
            member1
        )
        const state = await new Promise<GroupState>(res => gn.on("statechange", res))
        expect(state).toEqual('ready')
        expect(gn.invalidReason).toBeUndefined()
        expect(gn.id).toEqual(groupId)
        let compareFn = (a: any, b: any) => a.pub < b.pub ? 1 : -1
        expect(Array.from(gn.members.values()).sort(compareFn))
            .toEqual([{pub: owner.pub, epub: owner.epub}, {pub: member1.pub, epub: member1.epub}, {pub: member2.pub, epub: member2.epub}].sort(compareFn))
    })

    it("should send and receive chat", async () => {
        const [member1, member2, member3, member4] = await Promise.all([
            SEA.pair(),
            SEA.pair(),
            SEA.pair(),
            SEA.pair(),
            SEA.pair()
        ])
        const ownerPub = { pub: member1.pub, epub: member1.epub }

        await new Promise(res => user.auth(member1, res))
        const { groupId, groupPath } = await GroupNode.createNew(gun, member1, [member2, member3, member4])
        user.leave()

        const group1 = new GroupNode(gun, groupPath, ownerPub, member1)
        const group2 = new GroupNode(gun, groupPath, ownerPub, member2)
        const group3 = new GroupNode(gun, groupPath, ownerPub, member3)
        await Promise.all([
            new Promise(res => group1.once('statechange', res)),
            new Promise(res => group2.once('statechange', res)),
            new Promise(res => group3.once('statechange', res))
        ])
        expect(group1.state).toEqual('ready')
        expect(group2.state).toEqual('ready')
        expect(group3.state).toEqual('ready')
        await Promise.all([
            group1.listen(gun.get("config").get("1")),
            group2.listen(gun.get("config").get("2")),
            group3.listen(gun.get("config").get("3"))
        ])
        var [group1Unread, group2Unread, group3Unread] = [0,0,0]
        var [group1Msgs, group2Msgs, group3Msgs] = [new Array<any>(), new Array<any>(), new Array<any>()] 
        group1.on('num-reads', n => group1Unread = n)
        group2.on('num-reads', n => group2Unread = n)
        group3.on('num-reads', n => group3Unread = n)
        group1.on('recv-chat', d => group1Msgs.push(d))
        group2.on('recv-chat', d => group2Msgs.push(d))
        group3.on('recv-chat', d => group3Msgs.push(d))


        await new Promise(res => user.auth(member2, res))
        group2.emit("send-chat", "DING")
        group2.emit("send-chat", "DONG")
        await new Promise(res => setTimeout(res, 100))
        expect(group1Unread).toEqual(2)
        expect(group2Unread).toEqual(0)
        expect(group3Unread).toEqual(2)
        expect(Array.from((await group1.readAll()).values())).toEqual(["DING", "DONG"])
        expect(Array.from((await group2.readAll()).values())).toEqual(["DING", "DONG"])
        expect(Array.from((await group3.readAll()).values())).toEqual(["DING", "DONG"])


        await new Promise(res => user.auth(member3, res))
        group3.emit("send-chat", "DING")
        group3.emit("send-chat", "DONG")
        await new Promise(res => setTimeout(res, 100))
        expect(Array.from((await group1.read()).values())).toEqual(["DING", "DONG"])
        expect(Array.from((await group2.read()).values())).toEqual(["DING", "DONG"])
        expect(Array.from((await group1.readAll()).values())).toEqual(["DING", "DONG", "DING", "DONG"])
        expect(Array.from((await group2.readAll()).values())).toEqual(["DING", "DONG", "DING", "DONG"])
        expect(Array.from((await group3.readAll()).values())).toEqual(["DING", "DONG", "DING", "DONG"])


        await new Promise(res => user.auth(member1, res))
        group1.emit("send-chat", "TEST1")
        await new Promise(res => setTimeout(res, 10))
        await new Promise(res => user.auth(member2, res))
        group2.emit("send-chat", "TEST2")
        await new Promise(res => setTimeout(res, 10))
        await new Promise(res => user.auth(member3, res))
        group3.emit("send-chat", "TEST3")
        await new Promise(res => setTimeout(res, 10))
        expect(Array.from((await group1.read()).entries()).sort(([ka], [kb]) => ka < kb ? -1 : 1).map(([_,v]) => v)).toEqual(["TEST2", "TEST3"])
        expect(Array.from((await group2.read()).values())).toEqual(["TEST3"])
        expect(Array.from((await group3.read()).values())).toEqual([])
        
        const allMsgs = [
            'DING',  'DONG',
            'DING',  'DONG',
            'TEST1', 'TEST2',
            'TEST3'
        ]
        expect(group1Msgs).toEqual(allMsgs)
        expect(group2Msgs).toEqual(allMsgs)
        expect(group3Msgs).toEqual(allMsgs)

        const group4 = new GroupNode(gun, groupPath, ownerPub, member4)
        await new Promise(res => group4.once('statechange', res))
        expect(group4.state).toEqual('ready')
        group4.listen(gun.get("config").get("4"))
        await new Promise(res => group4.once('num-reads', res))
        expect(group4.numUnreads).toEqual(allMsgs.length)

        await new Promise(res => user.auth(member4, res))
        group4.emit("send-chat", "TEST1")
        group4.emit("send-chat", "TEST2")

        await new Promise(res => setTimeout(res, 2000))

        const group1_2 = new GroupNode(gun, groupPath, ownerPub, member1)
        await new Promise(res => group1_2.once('statechange', res))
        expect(group1_2.state).toEqual('ready')
        group1_2.listen(gun.get("config").get("1"))
        await new Promise(res => group1_2.once('num-reads', res))
        expect(group1_2.numUnreads).toEqual(2)
        expect(Array.from((await group1_2.read()).entries()).sort(([ka], [kb]) => ka < kb ? -1 : 1).map(([_,v]) => v)).toEqual(["TEST1", "TEST2"])
    })

    it("should rotate", async () => {
        const [member1, member2, member3, member4] = await Promise.all([
            SEA.pair(),
            SEA.pair(),
            SEA.pair(),
            SEA.pair(),
            SEA.pair(),
        ])
        const ownerPub = { pub: member1.pub, epub: member1.epub }

        await new Promise(res => user.auth(member1, res))
        const { groupId, groupPath } = await GroupNode.createNew(gun, member1, [member2, member3])
        user.leave()

        const group1 = new GroupNode(gun, groupPath, ownerPub, member1)
        const group2 = new GroupNode(gun, groupPath, ownerPub, member2)
        const group3 = new GroupNode(gun, groupPath, ownerPub, member3)
        const states = await Promise.all([
            new Promise<GroupState>(res => group1.once('statechange', res)),
            new Promise<GroupState>(res => group2.once('statechange', res)),
            new Promise<GroupState>(res => group3.once('statechange', res))
        ])
        expect(states).toEqual(['ready', 'ready', 'ready'])
        await Promise.all([
            group1.listen(gun.get("config").get("1")),
            group2.listen(gun.get("config").get("2")),
            group3.listen(gun.get("config").get("3"))
        ])

        const messages = Array.from({length: 4}, () => randStr(8, '0123456789ABCDEFGHIJKLMNOPQRSTUVWXZabcdefghijklmnopqrstuvwxyz_-'))
        await new Promise(res => user.auth(member1, res))
        var prom = new Promise<void>((res) => {
            var i = 0
            group2.on('recv-chat', (d, k, u, m, read) => {
                if (messages[i] === d) {
                    i++
                    read()
                }
                if (i === messages.length) res()
            })
        })
        for (let m of messages) {
            group1.emit('send-chat', m)
            await new Promise(res => setTimeout(res, 10))
        }
        await prom
        await Promise.all([group1.readAll(), group3.readAll()])
        expect(group1.rotate).toBeDefined()
        expect(group2.rotate).toBeUndefined()
        expect(group3.rotate).toBeUndefined()
        

        let prom1 = new Promise<string>(res => group1.once('next-available', res)) 
        let prom2 = new Promise<string>(res => group2.once('next-available', res)) 

        if (!group1.rotate) 
            return
        let newMembers = new Set(Array.from(group1.members.values()).filter(m => m.pub !== member3.pub))
        newMembers.add(member4)
        let newGroupInfo = await group1.rotate(member1, Array.from(newMembers));
        expect(await Promise.all([prom1, prom2]))
            .toEqual([newGroupInfo.groupPath, newGroupInfo.groupPath])

        await new Promise(res => setTimeout(res, 100))
        expect([
                ...group1.memberChannels.values(), 
                ...group2.memberChannels.values(), 
                ...group3.memberChannels.values()
            ]
            .map(c => c.listenOnly && c.configListenOnly)
            .concat([group1.isEnded, group2.isEnded, group3.isEnded])
            .reduce((p, c) => p && c, true)
        ).toBeTruthy()

        group1.emit('send-chat', "TEST")
        group2.emit('send-chat', "TEST")
        group3.emit('send-chat', "TEST")
        await new Promise(res => setTimeout(res, 100))
        expect(group1.numUnreads+group2.numUnreads+group3.numUnreads).toEqual(0)
        

        expect([...new Set([group1.nextPath, group2.nextPath])]).toEqual([newGroupInfo.groupPath])
        expect(group3.nextPath).toBeUndefined()

        const group1_2 = group1.nextNode
        const group2_2 = group2.nextNode
        const group3_2 = group3.nextNode
        const group4_2 = new GroupNode(gun, newGroupInfo.groupPath, ownerPub, member4)
        const [state1_2, state2_2, state4_2] =  await Promise.all([
            new Promise<GroupState>(res => group1_2?.once('statechange', res)),
            new Promise<GroupState>(res => group2_2?.once('statechange', res)),
            new Promise<GroupState>(res => group4_2?.once('statechange', res))
        ])
        expect(group3_2).toBeUndefined()
        expect([state1_2, state2_2, state4_2]).toEqual(['ready', 'ready', 'ready'])
        await Promise.all([
            group1_2?.listen(gun.get("config").get("1")),
            group2_2?.listen(gun.get("config").get("2")),
            group4_2?.listen(gun.get("config").get("4")),
        ])
        await new Promise(res => setTimeout(res, 100))
        expect(group1_2?.numUnreads! + group2_2?.numUnreads! + group4_2.numUnreads).toEqual(0)
        expect(group1_2?.prevNode).toBe(group1)
        expect(group2_2?.prevNode).toBe(group2)
        expect(group4_2.prevNode).toBeUndefined()

        expect([...new Set([...group1_2?.members.values()!, ...group2_2?.members.values()!, ...group4_2.members.values()].map(p => p.pub))].sort())
            .toEqual([member1.pub,  member2.pub, member4.pub].sort())

        console.log("Member 1", member1.pub)
        console.log("Member 2", member2.pub)
        console.log("Member 4", member4.pub)

        var prom = new Promise<void>((res) => {
            var i = 0
            group2_2?.on('recv-chat', (d, k, u, m, read) => {
                if (messages[i] === d) {
                    i++
                    read()
                }
                if (i === messages.length) res()
            })
        })
        await new Promise(res => user.auth(member4, res))
        for (let m of messages) {
            group4_2?.emit('send-chat', m)
            await new Promise(res => setTimeout(res, 10))
        }
        await prom
        expect(group1_2?.numUnreads! + group2_2?.numUnreads! + group4_2.numUnreads).toEqual(messages.length)
        expect([...(await group1.readAll()).entries(), ...(await group1_2!.readAll()).entries()].sort(([k1], [k2]) => k1 < k2 ? -1 : 1).map(([_, v]) => v))
            .toEqual(messages.concat(messages))
        expect([...(await group2.readAll()).entries(), ...(await group2_2!.readAll()).entries()].sort(([k1], [k2]) => k1 < k2 ? -1 : 1).map(([_, v]) => v))
            .toEqual(messages.concat(messages))
        expect([...(await group4_2!.readAll()).entries()].sort(([k1], [k2]) => k1 < k2 ? -1 : 1).map(([_, v]) => v))
            .toEqual(messages)
        expect([...(await group3!.readAll()).entries()].sort(([k1], [k2]) => k1 < k2 ? -1 : 1).map(([_, v]) => v))
            .toEqual(messages)
        await new Promise(res => setTimeout(res, 100))
    })
})