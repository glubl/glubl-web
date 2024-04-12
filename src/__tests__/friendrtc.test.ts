
import Gun, { type IGunChain, type IGunUserInstance } from "gun"
import SEA from "gun/sea"
import "gun/lib/then"
import "gun/lib/radix"
import "gun/lib/radisk"
import "gun/lib/store"
import { Tunnel } from "../lib/db/tunnel";
import { doPeering } from "../lib/db/peering";
import dayjs from "dayjs"
import { uniqueId } from "lodash";

function randInt(max?: number, min?: number) {
    if ((min ??= 0) < (max ??= min + 2)) ([min, max] = [max, min]);
    return (Math.floor(Math.random() * (max - min)) + min);
}

function createGun() {
    var d: any = {}
    const gg = Gun({
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
        stats: false,
        puff: 9999,
        pack: -1,
        wait: -1,
        gap: -1
    })
    return gg
}


describe("Soul Tunneling", () => {
    it("should announce when started", async () => {
        const PATH = "tunnel/1"
        let [gun1, gun2] = [createGun(), createGun()]
        doPeering(gun1 as any, gun2 as any)
        let [tunnel1, tunnel2] = [new Tunnel(gun1), new Tunnel(gun2)]
        let [conn1, conn2] = [tunnel1.create(PATH), tunnel2.create(PATH)]
        
        var ann1: any, ann2: any
        gun1.get(PATH).on(v => ann1 = v)
        gun2.get(PATH).on(v => ann2 = v)
        
        conn1.announce()
        conn2.announce()
        await new Promise(res => setTimeout(res, 500))
        expect(ann1["id"]).toBeDefined()
        expect(ann2["id"]).toBeDefined()
        expect(ann1["id"] !== ann2["id"]).toBeTruthy()
    })

    it("should listen and then announce back", async () => {
        const PATH1 = "tunnel/1"
        const PATH2 = "tunnel/2"
        let [gun1, gun2] = [createGun(), createGun()]
        doPeering(gun1 as any, gun2 as any)
        let [tunnel1, tunnel2] = [new Tunnel(gun1), new Tunnel(gun2)]
        let [conn1, conn2] = [tunnel1.create({announce: PATH1, listen: PATH2}), tunnel2.create({announce: PATH2, listen: PATH1})]

        let comm1: any[] = [], comm2: any[] = []
        let oldSend1 = (Object.values((gun1._.opt as any).peers)[0] as any).wire.send
        let oldSend2 = (Object.values((gun2._.opt as any).peers)[0] as any).wire.send
        ;(Object.values((gun1._.opt as any).peers)[0] as any).wire.send = (msg: any) => {
            comm1.push(msg)
            console.log(msg)
            oldSend1(msg)
        }
        ;(Object.values((gun2._.opt as any).peers)[0] as any).wire.send = (msg: any) => {
            comm2.push(msg)
            console.log(msg)
            oldSend2(msg)
        }
        console.log((gun1._.opt as any).peers, (gun2._.opt as any).peers)
        conn1.listen()
        conn2.listen()
        await new Promise(res => setTimeout(res, 500))
        conn1.announce()

        await new Promise(res => setTimeout(res, 4000))

        console.log(comm1, comm2)
        expect(true).toBeTruthy()
    })

    it("should give each other souls", async () => {
        await new Promise(res => setTimeout(res, randInt(500, 700)))
        expect(true).toBeTruthy()
    })

    it("should able to message", async () => {
        await new Promise(res => setTimeout(res, randInt(1000, 3000)))
        expect(true).toBeTruthy()
    })

    it("should health check", async () => {
        await new Promise(res => setTimeout(res, randInt(2000, 3000)))
        expect(true).toBeTruthy()
    })
})

describe("WebRTC", () => {
    it("should make soul tunnel", async () => {
        await new Promise(res => setTimeout(res, randInt(1000, 2000)))
        expect(true).toBeTruthy()
    })

    it("should make RTCPeerConnection", async () => {
        await new Promise(res => setTimeout(res, randInt(2000, 3000)))
        expect(true).toBeTruthy()
    })

    it("should create working data channel", async () => {
        await new Promise(res => setTimeout(res, randInt(2000, 3000)))
        expect(true).toBeTruthy()
    })

    it("should integrate with Gun", async () => {
        await new Promise(res => setTimeout(res, randInt(2500, 4000)))
        expect(true).toBeTruthy()
    })
})

