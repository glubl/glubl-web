import type { GunHookFriend, GunOptions, GunPeer, IGunHookContext, IGunInstance, IGunOnEvent, _GunRoot } from "gun"
import SEA from "gun/sea"
import { RTCPeer, type GunRTCPeerOptions, type RTCSignal } from "../webrtc"
import Gun from "gun/gun"
import type { Tunnel, TunnelConnection, TunnelPeer } from "./tunnel"
import { Debugger } from "../debugger"

const isDebug = true
const _debugger = Debugger("friendRTC", isDebug)

Gun.on("opt", function (this: IGunHookContext<_GunRoot>, root: _GunRoot) {
    this.to.next(root)
    let opt = root.opt;
    let friends = new Set<string>()
    root.on("friend", function (this: IGunHookContext<GunHookFriend>, friend: GunHookFriend) {
        if (friend.pub in friends) return
        this.to.next(friend)
        connect(friend, root.opt as any, root.$ as any)
    })
})

let tunnels: { [pid: string]: TunnelConnection | undefined} = {}
let peers: {[pid: string]: {
    send(this: typeof peers[keyof typeof peers], msg: any): void
    receive(this: typeof peers[keyof typeof peers], sig: string): void
    rtc: RTCPeer
    tunPeer: TunnelPeer
}} = {}

async function connect(friend: GunHookFriend, opt: GunOptions, gun: IGunInstance<any>) {
    let user = gun._.user!
    let root = gun._
    let gunOpt = gun._.opt as GunOptions
    let mesh = gunOpt.mesh!
    
    if (!friend.pub || !friend.epub || !friend.path || !friend.mypath || !user || !user._.sea) {
        return
    }
    const pair = user._.sea!
    const secret = (await SEA.secret(friend.epub, user._.sea))!
    
    _debugger.log("{{connect}}", friend.pub)

    if (!secret) {
        console.error("Can't initiate shared secret with ", friend.pub)
        return
    }

    const path = {
        announce: `~${pair.pub}/spaces/${friend.path}/RT`,
        listen: `~${friend.pub}/spaces/${friend.mypath}/RT`,
        id: await SEA.sign(await SEA.encrypt(pair.pub, secret), pair),
    }

    var tunnel = tunnels[friend.pub] ??= await new Promise<TunnelConnection | undefined>((res, _) => {
        root.on("tun-create", {path: path, connect: false, callback: (tunnel) => {
            res(tunnel)
        }})
        setTimeout(() => res(undefined), 30*1000)
    })

    if (!tunnel){
        return
    }

    tunnel.on("connected", async (tunPeer: TunnelPeer) => {
        var enc = await SEA.verify(tunPeer.id, friend.pub)
        var id: string | undefined
        if (enc) id = await SEA.decrypt(enc, secret)
        if (!id || id === pair.pub) {
            tunPeer.disconnect()
            return
        }
        _debugger.log("{{connected}}")
        let peer = peers[id] ??= {} as any
        if (peer.tunPeer && !peer.tunPeer.isDead) {
            peer.tunPeer.disconnect()
        }
        // TODO: Turn this into class
        peer.tunPeer = tunPeer
        peer.send ??= async function(msg: any) {
            if (this.tunPeer.isDead) {
                return
            }
            let enc = await SEA.encrypt(msg, secret)
            let sig = await SEA.sign(enc, pair)
            this.tunPeer.send(sig)
        }
        peer.receive ??= async function(sig: string) {
            let enc = await SEA.verify(sig, friend.pub)
            if (!enc) return
            let dat = await SEA.decrypt(enc, secret)
            if (!dat) return
            this.rtc.emit("recv-signal", dat)
        }
        tunPeer.on("message", (msg) => {
            peers[id!].receive(msg)
        })
        // TODO: Turn this into class
        peer.rtc ??= (() => {
            let options: GunRTCPeerOptions = {
                ...opt.rtc,
            }
            let rtcPeer = new RTCPeer(id, pair.pub, options)
            rtcPeer.on("send-signal", (msg) => {
                peer.send(JSON.parse(JSON.stringify(msg)))
            })
            let wire = {
                send(msg: any) {
                    peer.rtc.sendDataChannel("gun", msg)
                }
            }
            var gunPeer: GunPeer = {
                id: id,
                queue: [],
                url: id,
                wire: wire,
                rtc: peer
            }
            function close(this: RTCDataChannel) {
                _debugger.log("{{data channel}} close", this.label)
                gunPeer.wire = null
                mesh.bye(gunPeer)
            }
            function error(this: RTCDataChannel, ev: Event) {
                _debugger.log("{{data channel}} error", this.label, ev)
                gunPeer.wire = null
                mesh.bye(gunPeer)
            }
            function open(this: RTCDataChannel) {
                _debugger.log("{{data channel}} open", this.label)
                gunPeer.wire = wire
                gunPeer.id = id!
                mesh.hi(gunPeer)
            }
            function message(this: RTCDataChannel, msg: MessageEvent<any>) {
                if (!msg.data) return
                // _debugger.log("::msg::")
                mesh.hear(msg.data, gunPeer)
            }
            rtcPeer.addDataChannel('gun', message, open, close, error)
            rtcPeer.on("connected", () => _debugger.log("{{connected}}"))
            rtcPeer.on("disconnected", () => {
                gunPeer.wire = null
                mesh.bye(gunPeer)
            })
            rtcPeer.on("data-channel", (label) => _debugger.log("{{data-channel}}", label))
            setTimeout(() => rtcPeer.connect(), 50)
            return rtcPeer
        })()
    })
    tunnel.connect()

}