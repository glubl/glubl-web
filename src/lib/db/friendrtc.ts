import type { GunHookFriend, GunOptions, GunPeer, IGunHookContext, IGunInstance, IGunOnEvent, _GunRoot } from "gun"
import SEA from "gun/sea"
import { RTCPeer, type GunRTCPeerOptions, type RTCSignal } from "../webrtcSignal"
import Gun from "gun/gun"
import type { Tunnel, TunnelConnection, TunnelPeer } from "./tunnel"

const LOG = (...arg: any[]) => console.log("<FriendRTC>", ...arg)
const ERR = (...arg: any[]) => console.error("<FriendRTC>", ...arg)

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
    rtcPeer: RTCPeer
    tunPeer: TunnelPeer
}} = {}

async function connect(friend: GunHookFriend, opt: GunOptions, gun: IGunInstance<any>) {
    let user = gun._.user!
    let root = gun._
    let gunOpt = gun._.opt as GunOptions
    let mesh = gunOpt.mesh

    
    if (!friend.pub || !friend.epub || !friend.path || !friend.mypath || !user || !user._.sea) {
        return
    }
    const pair = user._.sea!
    const secret = (await SEA.secret(friend.epub, user._.sea))!

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

    // async function initTunnelPeer() {
    //     if (!tunnel)
    //         await initTunnel()
    //     if (!tunnel)
    //         return
    //     if (peer)
    //         tunnel?.removePeer(peer)
    //     if (!tunnel?.isConnected)
    //         tunnel.connect()
    //     await new Promise<TunnelPeer | undefined>((res, _) => {
            
    //         setTimeout(() => res(undefined), 30*1000)
    //     })
    //     peer?.on('message', receive)
    // }

    tunnel.on("connected", async (tunPeer: TunnelPeer) => {
        var enc = await SEA.verify(tunPeer.id, friend.pub)
        var id: string | undefined
        if (enc) id = await SEA.decrypt(enc, secret)
        if (!id || id === pair.pub) {
            tunPeer.kill()
            return
        }
        let peer = peers[id] ??= {} as any
        if (peer.tunPeer && !peer.tunPeer.isDead) {
            peer.tunPeer.kill()
        }
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
            this.rtcPeer.emit("recv-signal", dat)
        }
        tunPeer.on("message", (msg) => {
            peers[id!].receive(msg)
        })
        peer.rtcPeer ??= (() => {
            let options: GunRTCPeerOptions = {
                ...opt.rtc,
            }
            let rtcPeer = new RTCPeer(id, pair.pub, options)
            rtcPeer.on("send-signal", (msg) => {
                peer.send(msg)
            })
            var conn: RTCPeerConnection & GunPeer | undefined
            function createGunChannel() {
                LOG("{{create data channel}} gun")
                let ch = rtcPeer.createDataChannel('gun')
                if (!ch) return
                ch.addEventListener('message', message)
                ch.addEventListener('close', close)
                ch.addEventListener('error', error)
                ch.addEventListener('open', open)
            }
            function close() {
                if (!conn) return
                mesh.bye(conn)
                conn.wire = null
                if (rtcPeer.isConnected) {
                    createGunChannel()
                }
            }
            function error(ev: Event) {
                if (!conn) return
                mesh.bye(conn)
                conn.wire = null
                if (rtcPeer.isConnected) {
                    createGunChannel()
                }
            }
            function open(this: RTCDataChannel) {
                if (!conn) return
                LOG("{{data channel}} open", this.label)
                conn.wire = this
                conn.id = id!
                mesh.hi(conn)
            }
            function message(this: RTCDataChannel, msg: MessageEvent<any>) {
                if (!msg.data) return
                mesh.hear(msg.data, conn)
            }
            rtcPeer.on("connected", (connection) => {
                LOG("{{connected}}")
                conn = connection as any
                createGunChannel()
            })
            rtcPeer.on("disconnected", () => {
                close()
                conn = undefined
            })
            rtcPeer.on("data-channel", (ch) => {
                if (ch.label !== 'gun') return
                LOG("{{data channel}} gun")
                ch.addEventListener('message', message)
                ch.addEventListener('close', close)
                ch.addEventListener('error', error)
                ch.addEventListener('open', open)
            })
            setTimeout(() => rtcPeer.connect(), 50)
            return rtcPeer
        })()
        // opt.rtcInstance.connect(
        //     friend.pub, 
        //     pair.pub, 
        //     (data, init) => {
        //         if (init && (!peer.tunPeer || peer.tunPeer.isDead)) {
        //             tunnel?.disconnect()
        //             tunnel?.connect()
        //         } else if (peers[id] && !!peers[id].send)
        //             peers[id].send(data)
        //     }
        // )
    })
    tunnel.connect()

}