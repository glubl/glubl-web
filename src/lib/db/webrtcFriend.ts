import type { GunHookFriend, GunOptions, IGunHookContext, IGunInstance, IGunOnEvent, _GunRoot } from "gun"
import SEA from "gun/sea"
import { RTCPeer, type RTCSignal } from "./webrtc"
import Gun from "gun/gun"
import type { TunnelConnection, TunnelPeer } from "./tunnel"

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

async function connect(friend: GunHookFriend, opt: GunOptions, gun: IGunInstance<any>) {
    let user = gun._.user!
    let root = gun._

    
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

    var tunnel: TunnelConnection | undefined
    async function initTunnel() {
        if (tunnel) {
            return
        }
        tunnel = await new Promise<TunnelConnection | undefined>((res, _) => {
            root.on("tun-create", {path: path, connect: false, callback: (tunnel) => {
                res(tunnel)
            }})
            setTimeout(() => res(undefined), 30*1000)
        })
    }
    
    await initTunnel()

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

    let peers: {[pid: string]: {
        send(this: typeof peers[keyof typeof peers], msg: any): void
        receive(this: typeof peers[keyof typeof peers], sig: string): void
        rtcPeer: RTCPeer
        tunPeer: TunnelPeer
    }} = {}


    tunnel.on("connected", async (tunPeer: TunnelPeer) => {
        var enc = await SEA.verify(tunPeer.id, friend.pub)
        if (enc) var id = await SEA.decrypt(enc, secret)
        if (!id || id === pair.pub) {
            tunPeer.kill()
            return
        }

        if (peers[id])
            console.log("using old tunpeer")
        else
            console.log("creating tunpeer")
        let peer = peers[id] ??= {} as any
        if (peer.tunPeer && !peer.tunPeer.isDead) {
            peer.tunPeer.kill()
        }
        peer.tunPeer = tunPeer
        peer.send ??= async function(msg: any) {
            console.log("send:", msg)
            console.log("tunpeer dead", this.tunPeer.isDead)
            if (this.tunPeer.isDead) {
                return
            }
            let enc = await SEA.encrypt(msg, secret)
            let sig = await SEA.sign(enc, pair)
            this.tunPeer.send(sig)
        }
        peer.receive ??= async function(sig: string) {
            console.log("recv: ",sig)
            let enc = await SEA.verify(sig, friend.pub)
            if (!enc) return
            let dat = await SEA.decrypt(enc, secret)
            if (!dat) return
            this.rtcPeer.emit("recv-signal", dat)
        }
        tunPeer.on("message", (msg) => {
            console.log("MESAGEEEEE", msg)
            peers[id].receive(msg)
        })
        peer.rtcPeer ??= (() => {
            let rtcPeer = new RTCPeer(id, pair.pub, gun)
            rtcPeer.on("send-signal", (msg) => {
                peer.send(msg)
            })
            rtcPeer.connect()
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