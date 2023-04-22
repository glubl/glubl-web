import { EventEmitter } from "events"
import Gun, { type GunOptions, type GunPeer as GP, type IGunHookContext, type IGunInstance, type _GunRoot, type GunMesh, type IGun, type IGunOnEvent } from "gun"

Gun.on('opt', function(this: IGunHookContext<_GunRoot>, root: _GunRoot) {
    let opt = root.opt as GunOptions
    
    if (root.once || !Gun.Mesh || (false === opt.Tunnel)) {
        return
    }
    let gun = root.$ as IGunInstance<any>
    let tunOpt = !opt.Tunnel ? {} : opt.Tunnel;
    opt.Tunnel = tunOpt
    tunOpt.instance = new Tunnel(gun)
    gun._.on("tun-instance", tunOpt.instance)
    this.to.next(root)
})

export type TunnelEvent = {}
export type Path = { announce: string, listen: string, id?: string }
export class Tunnel extends EventEmitter<TunnelEvent> {
    private gun: IGunInstance<any>
    constructor(gun: IGunInstance<any>) {
        super()
        this.gun = gun
        let ins = this
        gun._.on("tun-create", function (data) { 
            let {path, connect, callback} = data
            let p = ins.create(path)
            callback(p)
            if (connect)
                setTimeout(() => p.connect(), 1)
        })
    }

    create(path: string | Path) {
        let p = typeof path === 'string' ? {announce: path, listen: path} : path
        return new TunnelConnection(p, this.gun)
    }
}

export type TunnelConnectionEvents = {
    "connected"         : [peer: TunnelPeer]
    "disconnected"      : [peer: TunnelPeer]
    "message"           : [msg: any, peer: TunnelPeer]
}
export class TunnelConnection extends EventEmitter<TunnelConnectionEvents>  {
    private gun: IGunInstance<any>
    private startTime: number = 0
    private event?: IGunOnEvent
    
    peers: {[id: string]: TunnelPeer } = {}
    path: Path
    id: string
    constructor(path: Path, gun: IGunInstance<any>) {
        super()
        this.path = path
        this.gun = gun
        this.id = path.id || ((gun as any).back("opt.uuid") || String.random)()
    }

    get isConnected() { return !!this.event }

    connect() {
        this.startTime = +new Date()
        this.listen()
        setTimeout(() => this.announce(), 1000)
    }
    disconnect() {
        if (this.event) {
            this.event.off()
            this.event = undefined
        }
        Object.values(this.peers).forEach((p) => this.removePeer(p))
    }
    broadcast(msg: any) {
        Object.values(this.peers)
            .forEach((peer) => peer.send(msg))
    }
    private createPeer(id: string, soul: string) {
        let peer = new TunnelPeer(id, soul, this.gun)
        peer.on("dead", () => {
            this.emit("disconnected", peer)
            this.removePeer(peer)
        })
        peer.on("message", (msg) => {
            this.emit("message", msg, peer)
        })
        peer.once("connected", () => this.emit("connected", peer))
        this.peers[id] = peer
        return peer
    }

    private putSoul?: string
    private announce() {
        // console.log("announce", this.path.announce)
        this.gun.get(this.path.announce)
            .get("id")
            .put(
                "", 
                (ack) => {
                    if (
                        !ack 
                        || 'err' in ack 
                        || !ack.ok 
                        || !(ack.ok as any).id 
                        || (ack.ok as any).id === this.id
                    ) return

                    // console.log("===> 2")

                    let id = (ack.ok as any).id
                    var peer = this.peers[id]
                    if (peer) return
                    var soul = ''+(ack as any)["#"]
                    var peer = this.createPeer(id, soul)
                    soul = this.gun._.ask((ack: any) => {
                        try {
                            peer.receive(ack.ok)
                        } catch (error) {
                            console.error(error)
                        }
                    })
                    peer.sendRaw({
                        s: soul,
                        id: this.id
                    }, soul)
                },
                { acks: 20 } as any
            )
    }

    private listen() {
        // console.log("listen", this.path.listen)
        this.gun.get(this.path.listen).get("id").on(async (__, _, meta, event) => {
            // console.log("listen-meta", meta, meta.put['>'] < this.startTime, !value, value === this.id, value in this.peers)
            this.event = event
            if (meta.put['>'] < this.startTime) return

            // console.log("===> 1")

            // Temporary callback to wait soul from the other side
            var callback = (ack: any) => {
                // console.log("===> 3")
                if (!ack || 'err' in ack || !ack.ok) return
                let msg = ack.ok as PeerRawMessage
                var peer: TunnelPeer | undefined
                if (msg.s && msg.id) {
                    peer = this.createPeer(msg.id, msg.s)
                    callback = (ack: any) => {
                        try {
                            peer!.receive(ack.ok)
                        } catch (error) {
                            console.error(error)
                        }
                    }
                }
            }
            this.gun._.on('out', {
                '#': this.gun._.ask((m) => {
                    try {
                        callback(m)
                    } catch (error) {
                        console.error(error)
                    }
                }), 
                '@': '' + meta["#"],                                       
                'ok': {
                    'id': this.id
                }
            })
        })
    }

    removePeer(peer: TunnelPeer) {
        if (!peer.isDead) {
            peer.kill()
        }
        delete this.peers[peer.id]
    }
}

export interface PeerRawMessage {
    m?: any // Message
    t?: 'ping' | 'pong' | 'bye' | 'hi' // Command
    s?: string // Soul
    id?: string // id
}

export type TunnelPeerEvents = { 
    "connected"     : []
    "message"       : [msg: any]
    "ping"          : [msg: 'ping' | 'pong' | 'bye' | 'hi']
    "raw"           : [msg: PeerRawMessage]
    "unresponsive"  : [tried: number]
    "dead"          : [] 
}

export class TunnelPeer extends EventEmitter<TunnelPeerEvents> {
    private soul: string
    private gun: IGunInstance<any>
    private opt: GunOptions
    private responsive = true
    private tried = 0
    private hcDefer?: ReturnType<typeof setTimeout>
    private _id: string
    private _dead = false
    private _connected = false
    get id() { return this._id }
    get isDead() { return this._dead }
    get isConnected() { return this._connected }
    constructor(id: string, soul: string, gun: IGunInstance<any>) {
        super()
        this._id = id
        this.soul = soul
        this.gun = gun
        this.opt = gun._.opt as any
        this.startHc()
    }
    receive(raw: PeerRawMessage) {
        // console.log("raw", raw)

        if (!this._connected) this.emit("connected")
        this._connected = true

        if (!raw) return
        this.emit("raw", raw)
        
        if (raw.t === 'ping' || raw.t === 'pong')
            this.emit("ping", raw.t)
        else if (raw.t === 'bye')
            this.kill(true)

        if (raw.m)
            this.emit("message", raw.m)
    }
    send(msg: any) {
        this.sendRaw({m: msg})
    }
    sendRaw(msg: PeerRawMessage, msgSoul?: string) {
        let m = { '@': this.soul, ok: msg} as any
        if (msgSoul) m["#"] = msgSoul
        this.gun._.on('out', m)
    }
    startHc() {
        if (this.hcDefer) {
            clearTimeout(this.hcDefer)
            this.hcDefer = undefined
        }
        this.hcDefer = setTimeout(() => this.hc(), (this.opt?.Tunnel || {}).startHc || 2000)
        this.on('ping', (t) => t === 'ping' && this.sendRaw({t: 'pong'}))
        this.on('ping', (t) => t === 'pong' && (this.responsive = true))
    }
    private hc() {
        if (this.tried > ((this.opt?.Tunnel || {}).maxRetry || 5)) {
            this.emit("dead")
            return
        }
        if (!this.responsive) {
            this.emit("unresponsive", ++this.tried)
        }
        this.responsive = false
        this.sendRaw({t: 'ping'})
        this.hcDefer = setTimeout(() => this.hc(), (this.opt?.Tunnel || {}).hc || 5000)
    }
    kill(byed?: boolean) {
        if (!byed) this.sendRaw({t: 'bye'})
        if (this.hcDefer) {
            clearTimeout(this.hcDefer)
            this.hcDefer = undefined
        }
        this._dead = true
        this._connected = false
        this.responsive = false
        this.emit("dead")
    }
}