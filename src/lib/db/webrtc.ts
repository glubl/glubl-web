import { EventEmitter } from "events"
import type { GunMesh, GunOptions, GunPeer, IGunHookContext, IGunInstance, _GunRoot } from "gun"
import Gun from "gun"

declare var global: typeof globalThis | (Window & typeof globalThis)
Gun.on("opt", initOpt)

function initOpt(this: IGunHookContext<_GunRoot>, root: _GunRoot) {
    this.to.next(root)

    let env: typeof window | typeof globalThis = {} as any
    let opt = root.opt as GunOptions

    if (root.once || !Gun.Mesh || (false === (opt.RTCPeerConnection as any))) {
        return
    }
    
    if (typeof window !== "undefined") {
        env = window
    }
    if (typeof global !== "undefined") {
        env = global
    }

    var rtcpc =
        opt.RTCPeerConnection ||
        env.RTCPeerConnection ||
        env.webkitRTCPeerConnection ||
        env.mozRTCPeerConnection
    var rtcsd =
        opt.RTCSessionDescription ||
        env.RTCSessionDescription ||
        env.webkitRTCSessionDescription ||
        env.mozRTCSessionDescription
    var rtcic =
        opt.RTCIceCandidate ||
        env.RTCIceCandidate ||
        env.webkitRTCIceCandidate ||
        env.mozRTCIceCandidate
    if (!rtcpc || !rtcsd || !rtcic) {
        return
    }
    opt.RTCPeerConnection = rtcpc
    opt.RTCSessionDescription = rtcsd
    opt.RTCIceCandidate = rtcic
    opt.rtc = opt.rtc || {
        iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun.sipgate.net:3478" }
        ],
    }

    opt.rtc.dataChannel = opt.rtc.dataChannel || {
        ordered: false,
        maxRetransmits: 2,
    }
    opt.rtc.offer = opt.rtc.offer || {
        offerToReceiveAudio: false,
        offerToReceiveVideo: false
    }
    opt.rtc.max = opt.rtc.max || 55
    opt.rtc.room =
        opt.rtc.room ||
        (Gun.window && (location.hash.slice(1) || location.pathname.slice(1)))
    return opt
}

export type RTCSignal = {
    hi?: any,
    answer?: {
        sdp: string
        type: RTCSdpType
    }
    candidate?: {
        address: string | null
        candidate: string
        component: RTCIceComponent | null
        foundation: string | null
        port: number | null
        priority: number | null
        protocol: RTCIceProtocol | null
        relatedAddress: string | null
        relatedPort: number | null
        sdpMLineIndex: number | null
        sdpMid: string | null
        tcpType: RTCIceTcpCandidateType | null
        type: RTCIceCandidateType | null
        usernameFragment: string | null
    }
    offer?: {
        sdp?: string
        type: RTCSdpType
    }
    ts: number
}

export interface GunRTCPeerOptions {
    minWait: number
    maxWait: number
    startWait: number
    waitInc: number
    maxRetry: number
    initiator: boolean
}

export type RTCPeerEvents = {
    "send-signal": [msg: RTCSignal]
    "recv-signal": [msg: RTCSignal]
    "data-channel": [channel: RTCDataChannel]
}

type RTCGunPeer = GunPeer & RTCPeerConnection

export class RTCPeer extends EventEmitter<RTCPeerEvents> {
    private gunPeer?: GunPeer & RTCPeerConnection

    private id: string
    private myId: string
    private wait: number
    private retry: number
    private lastTry = 0
    private leave = false
    private defer: ReturnType<typeof setTimeout> = 0
    private lastTried = 0
    private waitInc: number
    private maxRetry: number
    private maxWait: number
    private minWait: number
    private gun: IGunInstance<any>
    private opt: GunOptions
    private mesh: GunMesh

    private offerTs?: number
    private pendingICECandidate?: RTCSignal["candidate"]
    
    constructor(id: string, myId: string, gun: IGunInstance<any>, opt?: GunRTCPeerOptions) {
        super()
        this.gun = gun
        this.opt = gun._.opt as GunOptions
        this.mesh = this.opt.mesh
        this.wait = opt?.startWait || opt?.minWait || 15*1000
        this.retry = opt?.maxRetry || 8
        this.waitInc = opt?.waitInc || 2
        this.maxWait = opt?.maxWait || 120*1000
        this.minWait = opt?.minWait || 10*1000
        this.maxRetry = opt?.maxRetry || 8
        this.id = id
        this.myId = myId
        this.on("recv-signal", this.recvFn = (msg) => {
            console.log("eeeeeeeee",!this.gunPeer)
            if (!this.gunPeer) return
            this.receive(msg)
        })
    }
    private recvFn?: (msg: RTCSignal) => void
    connect() {
        console.log(`reconnect: ${this.retry} `, this.wait)
        this.disconnect()

        this.createPeer()
       
        this.emit("send-signal", {hi: this.myId, ts: this.offerTs = +new Date})

        this.defer = setTimeout(() => this.connect(), this.wait)
        this.retry = this.retry - ((-this.lastTried + (this.lastTried = +new Date) < (this.wait * this.waitInc) ) ? 1 : 0)
        this.wait = Math.min(this.wait * this.waitInc, this.maxWait)
    }
    disconnect() {
        this.clearReconnect()
        if (this.gunPeer) {
            this.gunPeer.close()
            this.mesh.bye(this.gunPeer)
            this.gunPeer = undefined
        }
        this.offerTs = undefined
    }
    private receive(msg: RTCSignal) {
        if (!this.gunPeer || !msg) return
        this.resetReconnect()
        let peer = this.gunPeer



        switch (true) {
            case (msg.candidate !== undefined):
                console.log(`receive: cadidate`)
                // if (peer.signalingState === "stable") return
                if (!peer.remoteDescription) {
                    console.log(`RET receive: cadidate: no remote desc`)
                    this.pendingICECandidate = msg.candidate
                    return
                }
                peer.addIceCandidate(new this.opt.RTCIceCandidate!(msg.candidate))
                    .catch((e) => {
                        console.error(`ERR receive: cadidate: `, e)
                    })
                break
            case (msg.answer !== undefined):
                console.log(`receive: answer`)
                // if (peer.signalingState === 'stable' && !!peer.localDescription && !!peer.remoteDescription) return
                msg.answer!.sdp = msg.answer!.sdp.replace(/\\r\\n/g, '\r\n')
                peer.setRemoteDescription(new this.opt.RTCSessionDescription!(msg.answer!))
                    .then(() => {
                        let ice
                        if (ice = (peer as any).pendingICECandidate) {
                            peer.addIceCandidate(new this.opt.RTCIceCandidate!(ice))
                            delete (peer as any).pendingICECandidate
                        }
                    })
                    .catch((e) => {
                        console.error(`ERR receive: answer: `, e)
                    })
                break
            case (msg.offer !== undefined):
                if (!msg.offer!.sdp) {
                    console.log(`RET receive: offer: no sdp`)
                    break
                }
                console.log(`receive: offer`)
                msg.offer!.sdp = msg.offer!.sdp.replace(/\\r\\n/g, '\r\n')
                // if (peer.signalingState === 'stable' && !!peer.localDescription && !!peer.remoteDescription) return
                peer.setRemoteDescription(new this.opt.RTCSessionDescription!(msg.offer!))
                    .then(() => peer.createAnswer(this.opt.rtc!.offer))
                    .then((answer) => {
                        peer.setLocalDescription(answer)
                        console.log(`send: answer`)
                        this.emit("send-signal", {
                            answer: JSON.parse(JSON.stringify(answer)),
                            ts: +new Date
                        })
                    })
                    .catch((e) => {
                        console.error(`ERR receive: offer: `, e)
                    })
                break
            case (msg.hi !== undefined):
                console.log("HERE")
                if (msg.ts > this.offerTs!) {
                    this.emit("send-signal", {hi: this.myId, ts: this.offerTs ??= +new Date})
                    return
                }
                this.sendOffer()
                break
            default:
                console.warn("unknown signal")
                break
        }
    }
    private sendOffer() {
        if (!this.gunPeer) return
        let peer = this.gunPeer

        // if (peer.signalingState === 'stable' && !!peer.localDescription && !!peer.remoteDescription) return
        
        peer.createOffer(this.opt.rtc!.offer)
            .then((offer) => {
                peer.setLocalDescription(offer)
                console.log(`send: offer`)
                this.emit("send-signal", {
                    offer: JSON.parse(JSON.stringify(offer)),
                    ts: +new Date
                })
            })
            .catch((e) => {
                console.error(`ERR receive: none: `, e)
            })
    }
    private resetReconnect() {
        // console.log(`resetReconnect`)
        this.clearReconnect()
        this.wait = this.maxWait || 30*1000*10000
        this.defer = setTimeout(() => this.connect(), this.wait)
    }
    private clearReconnect() {
        // console.log(`clearReconnect`)
        clearTimeout(this.defer)
        this.retry = this.maxRetry || 8
    }
    private createPeer(): GunPeer {
        console.log(`create`)

        if (this.gunPeer)
            this.disconnect()

        let peer = new (this.opt.RTCPeerConnection as any)(this.opt.rtc) as RTCGunPeer
        this.gunPeer = peer;
        peer.id = this.id

        peer.onicecandidate = (e) => {
            if (!e.candidate) return
            console.log(`send: ice`)
            const candidate = JSON.parse(JSON.stringify(e.candidate))
            this.emit("send-signal", {
                candidate: candidate,
                ts: +new Date
            })
        }
        
        peer.ondatachannel = (e) => {
            console.log(`======================== channel: `, e.channel.label, e.channel.label === 'gun')
            let chan = e.channel
            if (chan.label === 'gun') {
                chan.onopen = wire.onopen as any
                chan.onerror = wire.onerror as any
                chan.onclose = wire.onclose as any
                chan.onmessage = wire.onmessage as any
                return
            } else {
                this.emit("data-channel", chan)
            }
        }
        peer.addEventListener("signalingstatechange", (e) => {
            // if(peer.signalingState === 'stable' && !!peer.localDescription && !!peer.remoteDescription)
            //     this.createGunChannel(peer)
            console.log(`SIGNAL state: ${peer.signalingState}`)
            console.log(`SIGNAL state: ${!!peer.localDescription} ${!!peer.remoteDescription}`)
        })

        peer.addEventListener("connectionstatechange", (e) => {
            console.log(`RTC state: ${peer.connectionState}`)
        })

        peer.addEventListener("iceconnectionstatechange", (e) => {
            console.log(`ICE state: `, peer.iceConnectionState)
        })

        let wire = peer.wire = this.createChannel('gun')!
        wire.onclose = () => {
            console.log(`channel: close: `, wire.label);
            // this.createGunChannel(peer)
            this.disconnect()
            this.mesh.bye(peer)
            this.wait = this.minWait
            this.defer = setTimeout(() => this.connect(), 1)
            // delete this.opt.peers[peer.id]
        }
        wire.onerror = (err) => {
            console.log(`channel: error: `, wire.label);
            this.disconnect()
            this.wait = this.minWait
            this.defer = setTimeout(() => this.connect(), 1)
            // delete this.opt.peers[peer.id]
        }
        wire.onopen = () => {
            console.log(`channel: open: `, wire.label);
            this.clearReconnect()
            this.wait = this.minWait
            this.mesh.hi(this.gunPeer)
        }
        wire.addEventListener("closing", (m) => console.log("closing", m))
        // wire.addEventListener("bufferedamountlow", (m) => console.log("bufferedamountlow", m))
        wire.onmessage = (msg) => {
            this.clearReconnect()
            if (!msg) return
            console.log(`msg`, msg.data)
            this.mesh.hear(msg.data, this.gunPeer)
        }
        // peer.addEventListener("track")

        
        return peer
    }

    createChannel(name: string) {
        if (!this.gunPeer) return

        console.log("channel: creating", this.opt.rtc!.dataChannel)
        return this.gunPeer.createDataChannel(name, {negotiated: false, ordered: false})
    }
}