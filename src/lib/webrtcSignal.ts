import { EventEmitter } from "events"

declare var global: typeof globalThis | (Window & typeof globalThis)

const LOG = (...arg: any[]) => console.log("<RTC>", ...arg)
const ERR = (...arg: any[]) => console.error("<RTC>", ...arg)

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

export type GunRTCPeerOptions = Partial<{
    minWait: number
    maxWait: number
    startWait: number
    waitInc: number
    maxRetry: number
    initiator: boolean

    rtcConfig: RTCConfiguration
    dataChannel: RTCDataChannelInit 
    offer: RTCOfferOptions

    RTCPeerConnection: typeof RTCPeerConnection 
    RTCSessionDescription: typeof RTCSessionDescription
    RTCIceCandidate: typeof RTCIceCandidate
}>

export type RTCPeerEvents = {
    "send-signal"   : [msg: RTCSignal]
    "recv-signal"   : [msg: RTCSignal]
    "data-channel"  : [channel: RTCDataChannel]
    "connected"     : [connection: RTCPeerConnection]
    "disconnected"  : []
}

export class RTCPeer extends EventEmitter<RTCPeerEvents> {
    private peer?: RTCPeerConnection

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

    private offerTs?: number
    private pendingICECandidate: RTCSignal["candidate"][] = []

    private RTCPeerConnection: typeof RTCPeerConnection
    private RTCSessionDescription: typeof RTCSessionDescription
    private RTCIceCandidate: typeof RTCIceCandidate
    private initPeerConnection: RTCConfiguration
    private initDataChannel: RTCDataChannelInit
    private initOffer: RTCOfferOptions
    
    constructor(id: string, myId: string, opt?: GunRTCPeerOptions) {
        super()
        let env: typeof window | typeof globalThis = {} as any
        if (typeof window !== "undefined") {
            env = window
        }
        if (typeof global !== "undefined") {
            env = global
        }

        this.RTCPeerConnection = opt?.RTCPeerConnection 
            || env.RTCPeerConnection 
            || env.webkitRTCPeerConnection 
            || env.mozRTCPeerConnection
        this.RTCSessionDescription = opt?.RTCSessionDescription
            || env.RTCSessionDescription 
            || env.webkitRTCSessionDescription 
            || env.mozRTCSessionDescription
        this.RTCIceCandidate = opt?.RTCIceCandidate
            || env.RTCIceCandidate 
            || env.webkitRTCIceCandidate 
            || env.mozRTCIceCandidate
        this.initPeerConnection = opt?.rtcConfig || {
            iceServers: [
                { urls: "stun:stun.l.google.com:19302" },
                { urls: "stun:stun.sipgate.net:3478" }
            ],
        }
        this.initDataChannel = opt?.dataChannel || {
            ordered: true,
            maxRetransmits: 3,
        }
        this.initOffer = opt?.offer || {
            iceRestart: false,
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
        }

        this.wait = opt?.startWait || opt?.minWait || 15*1000
        this.retry = opt?.maxRetry || 8
        this.waitInc = opt?.waitInc || 2
        this.maxWait = opt?.maxWait || 30*1000
        this.minWait = opt?.minWait || 10*1000
        this.maxRetry = opt?.maxRetry || 8
        this.id = id
        this.myId = myId
        this.on("recv-signal", (msg) => {
            this.receive(msg)
        })
    }
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
        if (this.peer) {
            this.peer.close()
            this.peer = undefined
            LOG("::close::")
        }
        this.offerTs = undefined
        this.setConnected(false)
    }
    receive(msg: RTCSignal) {
        if (!msg) return


        if (!this.peer) {
            this.connect()
        }

        if (!this._connected)
            this.resetReconnect()

        let peer = this.peer!

        switch (true) {
            case (msg.candidate !== undefined):
                // if (this._connected) return
                // if (peer.signalingState === "stable") return
                if (!peer.remoteDescription) {
                    LOG("::ice:: cache");
                    (this.pendingICECandidate ??= []).push(msg.candidate)
                    return
                }
                LOG("::ice::")
                peer.addIceCandidate(new this.RTCIceCandidate(msg.candidate))
                    .catch((e: DOMException) => {
                        if (e.name === 'InvalidStateError') return
                        ERR("::ice::", e)
                    })
                break
            case (msg.answer !== undefined):
                if (!msg.answer || !msg.answer.sdp) {
                    LOG("::answer:: RET no sdp")
                    break
                }   
                LOG("::answer::")
                msg.answer.sdp = msg.answer.sdp.replace(/\\r\\n/g, '\r\n')
                peer.setRemoteDescription(new this.RTCSessionDescription(msg.answer))
                    .then(async () => {
                        for (let ice of this.pendingICECandidate) {
                            await peer.addIceCandidate(new this.RTCIceCandidate(ice))
                        }
                        this.pendingICECandidate = []
                    })
                    .catch((e: DOMException) => {
                        if (e.name === 'InvalidStateError') return
                        ERR("::answer::", e)
                    })
                break
            case (msg.offer !== undefined):
                if (!msg.offer || !msg.offer!.sdp) {
                    LOG("::offer:: RET no sdp")
                    break
                }
                LOG("::offer::")
                msg.offer.sdp = msg.offer.sdp.replace(/\\r\\n/g, '\r\n')
                peer.setRemoteDescription(new this.RTCSessionDescription!(msg.offer))
                    .then(() => peer.createAnswer(this.initOffer))
                    .then((answer) => {
                        peer.setLocalDescription(answer)
                        LOG("::answer:: send")
                        this.emit("send-signal", {
                            answer: JSON.parse(JSON.stringify(answer)),
                            ts: +new Date
                        })
                    })
                    .catch((e: DOMException) => {
                        if (e.name === 'InvalidStateError') return
                        ERR("::offer::", e)
                    })
                break
            case (msg.hi !== undefined):
                if (msg.ts > this.offerTs!) {
                    LOG("::hi:: RET they init")
                    return
                }
                LOG("::hi::")
                this.sendOffer()
                break
            default:
                LOG("::?::")
                break
        }
    }
    sendOffer() {
        if (!this.peer) return
        let peer = this.peer

        // if (peer.signalingState === 'stable' && !!peer.localDescription && !!peer.remoteDescription) return
        
        peer.createOffer(this.initOffer)
            .then((offer) => {
                peer.setLocalDescription(offer)
                LOG("::offer:: send")
                this.emit("send-signal", {
                    offer: JSON.parse(JSON.stringify(offer)),
                    ts: +new Date
                })
            })
            .catch((e) => {
                LOG("::offer:: send", e)
            })
    }
    resetReconnect() {
        this.clearReconnect()
        this.wait = this.maxWait
        this.defer = setTimeout(() => this.connect(), this.wait)
    }
    clearReconnect() {
        clearTimeout(this.defer)
        this.retry = this.maxRetry || 8
    }
    private _connected = false
    get isConnected() {return this._connected}
    private setConnected(connected?: boolean) {
        let oldConnected = this._connected
        this._connected = connected !== undefined ? connected : !this._connected
        if (oldConnected !== this._connected) {
            if (this._connected) this.emit("connected", this.peer!)
            else this.emit("disconnected")
        }
    }
    private createPeer(): RTCPeerConnection {
        LOG("{{create peer}}")

        if (this.peer)
            this.disconnect()

        let peer = new (this.RTCPeerConnection)(this.initPeerConnection)
        this.peer = peer;

        const onOpen = (ch: RTCDataChannel) => {
            return () => {
                this.clearReconnect()
                LOG("<<init channel>> send ping")
                ch.send("ping")
            }
        }
        const onClose = () => {
            this.disconnect()
            this.resetReconnect()
        }
        const onError = () => {
            this.disconnect()
            this.resetReconnect()
        }
        const onMessage = (ch: RTCDataChannel) => {
            return (ev: MessageEvent<any>) => {
                if (ev.data === 'pong') {
                    LOG("<<init channel>> pong")
                    this.setConnected(true)
                } else if (ev.data === 'ping') {
                    LOG("<<init channel>> ping")
                    ch.send('pong')
                }
                
                this.clearReconnect()
            }
        }

        peer.onicecandidate = (e) => {
            if (!e.candidate) return
            LOG("::ice:: send")
            const candidate = JSON.parse(JSON.stringify(e.candidate))
            this.emit("send-signal", {
                candidate: candidate,
                ts: +new Date
            })
        }
        
        peer.ondatachannel = (e) => {
            LOG("{{data channel}} in", e.channel.label)
            let ch = e.channel
            if (ch.label === 'init') {
                ch.addEventListener('open', onOpen(ch))
                ch.addEventListener('error', onError)
                ch.addEventListener('close', onClose)
                ch.addEventListener('message', onMessage(ch))
                return
            } else {
                this.emit("data-channel", ch)
            }
        }
        peer.addEventListener("signalingstatechange", (e) => {
            LOG("{{signaling state}} ", peer.signalingState)
        })

        peer.addEventListener("connectionstatechange", (e) => {
            LOG("{{connection state}} ", peer.connectionState)
        })

        peer.addEventListener("iceconnectionstatechange", (e) => {
            LOG("{{ice connection state}} ", peer.iceConnectionState)
        })

        let ch = this.createDataChannel('init')
        if (ch) {
            ch.addEventListener('open', onOpen(ch))
            ch.addEventListener('error', onError)
            ch.addEventListener('close', onClose)
            ch.addEventListener('message', onMessage(ch))
        }
        return peer
    }

    createDataChannel(name: string) {
        if (!this.peer) return

        console.log("channel: creating", this.initDataChannel)
        let ch = this.peer.createDataChannel(name, {negotiated: false, ordered: false})
        ch.addEventListener("open", () => LOG("{{data channel}} open", ch.label))
        ch.addEventListener("close", () => LOG("{{data channel}} close", ch.label))
        ch.addEventListener("error", (ev) => LOG("{{data channel}} open", ch.label, ev))
        ch.addEventListener("message", () => LOG("{{data channel}} message", ch.label))
        ch.addEventListener("bufferedamountlow", () => LOG("{{data channel}} bufferedamountlow", ch.label))
        return ch
    }
}