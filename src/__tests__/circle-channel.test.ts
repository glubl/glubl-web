import { CircleChannel, type CircleMiddleware } from "../lib/circle-channel"
import Gun from "gun/gun"
import SEA from "gun/sea"


describe("Chat", () => {
    it("should send and listen to channel", async () => {
        const gun = new Gun()
        const message1 = "Test message1"
        const message2 = "Test message2"
        const circle1 = new CircleChannel(gun.get("msg"), gun.get("config1"))
        const circle2 = new CircleChannel(gun.get("msg"), gun.get("config2"))
        const [msgRecv1, isUnread1] = await new Promise<[string, boolean]>((res) => {
            circle1.on("recv-chat", (v, _, unread) => res([v, unread!]))
            circle2.emit("send-chat", message1)
        })
        const [msgRecv2, isUnread2] = await new Promise<[string, boolean]>((res) => {
            circle2.on("recv-chat", (v, _, unread) => res([v, unread!]))
            circle1.emit("send-chat", message2)
        })
        expect(msgRecv1).toEqual(message1)
        expect(isUnread1).toBeTruthy()
        expect(msgRecv2).toEqual(message2)
        expect(isUnread2).toBeTruthy()
    })

    it("should use middlewares", async () => {
        const gun = new Gun()
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
        const circle1 = new CircleChannel(gun.get("msg"), gun.get("config1"), sendMiddlewares, recvMiddlewares)
        const circle2 = new CircleChannel(gun.get("msg"), gun.get("config2"), sendMiddlewares, recvMiddlewares)
        var msgRecv = await new Promise((res) => {
            circle1.on("recv-chat", v => res(v))
            circle2.emit("send-chat", message)
        })
        expect(msgRecv).toEqual(message)
    })

    it("should store unreads", async () => {
        const gun = new Gun()
        const messages1 = ["1", "2", "3"]
        const messages2 = ["4", "5", "6", "7", "8"]
        const circle1 = new CircleChannel(gun.get("msg"), gun.get("config1"))
        const circle2 = new CircleChannel(gun.get("msg"), gun.get("config2"))
        var numUnreads1: number[] = []
        var numUnreads2: number[] = []
        circle1.on("num-reads", (n) => numUnreads1.push(n))
        circle2.on("num-reads", (n) => numUnreads2.push(n))
        var config1: { lastRead?: string } = {}
        var config2: { lastRead?: string } = {}
        gun.get("config1").on(v => config1 = v)
        gun.get("config2").on(v => config2 = v)

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
        const unreads1 = Array.from(circle1.read().values())
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
        const unreads2 = Array.from(circle2.read().values())
        for (const k of keys2)
            expect(circle2.isUnread(k)).toBeFalsy()
        expect(unreads2).toEqual(messages2)
        expect(circle1.numUnreads).toEqual(0)
        expect(circle2.numUnreads).toEqual(0)

        prom = new Promise<string[]>((res) => {
            var keys: string[] = []
            circle2.on("recv-chat", function fn(d, k, u) {
                if (u)
                    keys.push(k)
                if (keys.length >= messages1.length) {
                    circle2.off("recv-chat", fn)
                    res(keys)
                }
            })
        })
        for (const m of messages1) {
            circle1.emit("send-chat", m)
            await new Promise((res) => setTimeout(res, 10))
        }
        const keys3 = await prom

        expect(circle1.numUnreads).toEqual(0)
        expect(circle2.numUnreads).toEqual(messages1.length)
        for (const k of keys3)
            expect(circle2.isUnread(k)).toBeTruthy()
        const unreads3 = Array.from(circle2.read().values())
        for (const k of keys3)
            expect(circle2.isUnread(k)).toBeFalsy()
        expect(unreads3).toEqual(messages1)
        expect(circle1.numUnreads).toEqual(0)
        expect(circle2.numUnreads).toEqual(0)
        
        expect(numUnreads1).toEqual([1, 2, 3, 0])
        expect(numUnreads2).toEqual([1, 2, 3, 4, 5, 0, 1, 2, 3, 0])

        // Wait for debounce and gun put
        await new Promise((res) => setTimeout(res, 2500))
        expect(config1.lastRead).toEqual(config2.lastRead)
        const allKeys = keys1.concat(keys2).concat(keys3).sort()
        expect(config1.lastRead).toEqual(allKeys[allKeys.length - 1])
    })
})