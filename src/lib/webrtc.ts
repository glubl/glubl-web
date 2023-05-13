import { EventEmitter } from "events"
import { Debugger } from "./debugger"

declare var global: typeof globalThis | (Window & typeof globalThis)

const isDebug = true
const _debugger = Debugger("RTC", isDebug)

export type RTCSignal = {
    description?: RTCSessionDescriptionInit
    candidate?: RTCIceCandidate
    bye?: any
    hi?: any
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
    "stream"        : [stream: MediaStream]
    "connected"     : [connection: RTCPeerConnection]
    "disconnected"  : []
}

export class RTCPeer extends EventEmitter<RTCPeerEvents> {
    private pc?: RTCPeerConnection

    private id: string
    private myId: string
    private wait: number
    private retry: number
    private lastTry = 0
    private leave = false
    private defer: ReturnType<typeof setTimeout> = 0
    private lastTried = +new Date
    private waitInc: number
    private maxRetry: number
    private maxWait: number
    private minWait: number

    private pendingICECandidate: RTCSignal["candidate"][] = []

    private RTCPeerConnection: typeof RTCPeerConnection
    private RTCSessionDescription: typeof RTCSessionDescription
    private RTCIceCandidate: typeof RTCIceCandidate
    private initPeerConnection: RTCConfiguration
    private initDataChannel: RTCDataChannelInit
    private initOffer: RTCOfferOptions
    
    private mediaStreams: {[id: string]: MediaStream} = {}
    private tracksRtpSenders: {[trackId: string]: RTCRtpSender} = {}
    private dataChannels: {[id: string]: {
        name: string,
        channel?: RTCDataChannel,
        onmessage: (this: RTCDataChannel, ev: MessageEvent<any>) => any,
        onopen?: (this: RTCDataChannel, ev: Event) => any,
        onclose?: (this: RTCDataChannel, ev: Event) => any,
        onerror?: (this: RTCDataChannel, ev: Event) => any,
        onbufferedamountlow?: (this: RTCDataChannel, ev: Event) => any
    }} = {}

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
        this.polite = [id, myId].sort()[0] === id
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
    async connect() {
        if (this.retry <= 0) return
        _debugger.log("((reconnect))", this.retry, this.wait)
        this.disconnect("bye")
        this.emit("send-signal", {hi: this.myId, ts: +new Date})
        _debugger.log("::hi send::")

        clearTimeout(this.defer)
        this.defer = setTimeout(() => this.connect(), this.wait)
        this.retry = this.retry - ((-this.lastTried + (this.lastTried = +new Date) < (this.wait * this.waitInc) ) ? 1 : 0)
        this.wait = Math.min(this.wait * this.waitInc, this.maxWait)
    }
    disconnect(reason?: string) {
        this.clearReconnect()
        _debugger.log("::close::")
        if (this.pc) {
            for (const channelId in this.dataChannels) {
                this.disconnectDataChannel(channelId)
            }
            for (const streamId in this.mediaStreams) {
                this.disconnectStream(this.mediaStreams[streamId])
            }
            this.pc.close()
            this.pc = undefined
        }
        this.setConnected(false)
        this.hiReceive = false
        if (reason !== "bye") {
            _debugger.log("::bye send::")
            this.emit("send-signal", {ts: +new Date, bye: "bye"})
        }
    }

    addStream(stream: MediaStream) {
        if (this.mediaStreams[stream.id]) return
        _debugger.log("{{stream}} add", stream.id, stream.getTracks())
        this.mediaStreams[stream.id] = stream
        for (const track of stream.getTracks()) {
            if (this.pc) {
                
                this.tracksRtpSenders[track.id] = this.pc.addTrack(track, stream)
                console.log(this.tracksRtpSenders[track.id])
            }
        }
    }

    removeStream(stream: MediaStream) {
        this.disconnectStream(stream)
        delete this.mediaStreams[stream.id]
    }

    private disconnectStream(stream: MediaStream) {
        if (!this.mediaStreams[stream.id]) return
        _debugger.log("{{stream}} disconnect", stream.id)
        for (const track of stream.getTracks()) {
            if (this.pc)
                this.pc.removeTrack(this.tracksRtpSenders[track.id])
            delete this.tracksRtpSenders[track.id]
        }
    }
 
    private makingOffer = false
    private polite: boolean
    private hiReceive = false
    async receive(msg: RTCSignal) {
        try {
            if (!msg) return
            let { candidate, description, bye, hi } = msg
            console.log(msg)

            if (bye && (this.isConnected || (+new Date - this.lastTried > (this.wait * this.waitInc)))) {
                _debugger.log("::bye::")
                this.disconnect("bye")
                return
            }

            if (hi && !this.hiReceive) {
                _debugger.log("::hi::")
                this.hiReceive = true
                this.emit("send-signal", {hi: this.myId, ts: +new Date})
                _debugger.log("::hi send::")
                await this.sendOffer()
                return
            }

            if (!this.pc) {
                return
            }
    
            let pc = this.pc!
            if (description) {
                const offerCollision = description.type == "offer" &&
                                 (this.makingOffer || pc.signalingState != "stable");
                let ignoreOffer = !this.polite && offerCollision;
                if (ignoreOffer) {
                    _debugger.log("::offer:: ignore")
                    return
                }

                if (offerCollision) {
                    _debugger.log("::offer:: rollback")
                    await Promise.all([
                        pc.setLocalDescription({type: "rollback"}),
                        pc.setRemoteDescription(description)
                    ]);
                } else {
                    _debugger.log(`::${description.type}:: accept`)
                    await pc.setRemoteDescription(description);
                }

                if (description.type == "offer") {
                    let answer = await pc.createAnswer(this.initOffer)
                    
                    await pc.setLocalDescription(answer);
                    _debugger.log("::answer:: send")
                    this.emit("send-signal", {
                        description: answer,
                        ts: +new Date
                    })
                }

                if (pc.remoteDescription) {
                    _debugger.log("{{ice apply cache}}")
                    for (let candidate of this.pendingICECandidate) {
                        await pc.addIceCandidate(candidate)
                    }
                    this.pendingICECandidate = []
                }
                return
            }

            if (candidate) {
                if (!pc.remoteDescription) {
                    _debugger.log("::ice:: cache");
                    (this.pendingICECandidate ??= []).push(candidate)
                    return
                }
                _debugger.log("::ice::")
                await pc.addIceCandidate(candidate)
                return
            }

            
        } catch (e: any) {
            if (e.name === 'InvalidStateError') return
            _debugger.error("::receive::", e)
        }
    }
    async sendOffer() {
        if (!this.pc) 
            this.createPeer()

        let pc = this.pc!

        try {
            this.makingOffer = true
            let offer = await pc.createOffer(this.initOffer)
            if (pc.signalingState != "stable") {
                _debugger.log("::offer:: send cancel")
                return
            };
            await pc.setLocalDescription(offer)
            _debugger.log("::offer:: send")
            this.emit("send-signal", {
                description: offer,
                ts: +new Date
            })
        } catch (e) {
            _debugger.error("::offer:: send", e)
        } finally {
            this.makingOffer = false
        }
    }
    resetReconnect(restart?: boolean) {
        _debugger.log("{{reconnect}} reset")
        this.clearReconnect()
        this.wait = restart ? this.minWait : this.maxWait
        this.defer = setTimeout(() => this.connect(), this.wait)
    }
    clearReconnect(restart?: boolean) {
        _debugger.log("{{reconnect}} clear")
        clearTimeout(this.defer)
        this.retry = restart ? this.maxRetry || 8 : this.retry
    }
    private _connected = false
    get isConnected() {return this._connected}
    private setConnected(connected: boolean) {
        this._connected = connected
        if (connected) {
            this.emit("connected", this.pc!)
            this.clearReconnect()
        }
        else this.emit("disconnected")
    }
    private createPeer(): RTCPeerConnection {
        _debugger.log("{{create peer}}")

        if (this.pc)
            this.disconnect()

        let pc = this.pc = new (this.RTCPeerConnection)(this.initPeerConnection)
        const ins = this
        function onOpen(this: RTCDataChannel) {
            ins.clearReconnect()
            _debugger.log("::ping:: send")
            this.send("ping")
        }
        let closeCalled = false
        function onClose(this: RTCDataChannel) {
            if (!closeCalled) {
                closeCalled = true
                return
            }
            ins.disconnect()
            ins.resetReconnect(true)
            ins.connect()
        }
        function onError(this: RTCDataChannel) {
            ins.disconnect()
            ins.resetReconnect(true)
            ins.connect()
        }
        function onMessage(this: RTCDataChannel, ev: MessageEvent<any>) {
            if (ev.data === 'pong') {
                _debugger.log("::pong:: recv")
                ins.clearReconnect(true)
                ins.setConnected(true)
            } else if (ev.data === 'ping') {
                _debugger.log("::ping:: recv")
                _debugger.log("::pong:: send")
                this.send('pong')
            }
            if (!ins.isConnected)
                ins.resetReconnect()
        }

        pc.addEventListener("icecandidate", (e) => {
            if (!e.candidate) return
            _debugger.log("::ice:: send")
            this.emit("send-signal", {
                candidate: e.candidate,
                ts: +new Date
            })
        })

        pc.addEventListener("datachannel", (e) => {
            _debugger.log("{{data channel}} in", e.channel.label)
            let dc = e.channel
            let ch: typeof this.dataChannels[keyof typeof this.dataChannels]
            const { onmessage, onopen, onerror, onclose, onbufferedamountlow } = ch = this.dataChannels[dc.label] || {}
            if (ch) {
                dc.addEventListener("message", onmessage)
                if (onopen)
                    dc.addEventListener("open", onopen)
                if (onclose)
                    dc.addEventListener("close", onclose)
                if (onerror)
                    dc.addEventListener("error", onerror)
                if (onbufferedamountlow)
                    dc.addEventListener("bufferedamountlow", onbufferedamountlow)
                dc.addEventListener("error", () => ch.channel = undefined)
                dc.addEventListener("close", () => ch.channel = undefined)
                dc.addEventListener("open", () => this.emit("data-channel", dc))
                ch.channel = dc
            }
        })
        
        pc.addEventListener("signalingstatechange", (e) => {
            _debugger.log("{{signaling state}} ", pc.signalingState)
        })

        pc.addEventListener("connectionstatechange", (e) => {
            _debugger.log("{{connection state}} ", pc.connectionState)
        })

        pc.addEventListener("iceconnectionstatechange", (e) => {
            _debugger.log("{{ice connection state}} ", pc.iceConnectionState)
        })

        pc.addEventListener("track", (e) => {
            const {track, streams} = e
            let str = [...streams]
            _debugger.log("{{track}} ", e)
            if (str.length === 0) str = [new MediaStream([track])]
            for (const s of str) {
                this.emit("stream", s)
            }
            track.addEventListener("ended", () => {
                for (const s of str) {
                    s.removeTrack(track)
                }
            })
        })

        pc.addEventListener("negotiationneeded", (e) => this.sendOffer())

        this.addDataChannel('init', onMessage, onOpen, onClose, onError)
        
        for (const stream of Object.values(this.mediaStreams)) {
            for (const track of stream.getTracks()) {
                this.tracksRtpSenders[track.id] = pc.addTrack(track, stream)
            }
        }
        for (const channel of Object.values(this.dataChannels)) {
            this.createDataChannel(channel)
        }
        return pc
    }

    addDataChannel(
        name: string, 
        onmessage: (this: RTCDataChannel, ev: MessageEvent<any>) => any,
        onopen?: (this: RTCDataChannel, ev: Event) => any,
        onclose?: (this: RTCDataChannel, ev: Event) => any,
        onerror?: (this: RTCDataChannel, ev: Event) => any,
        onbufferedamountlow?: (this: RTCDataChannel, ev: Event) => any
    ) {
        let ch = this.dataChannels[name] ??= {} as any
        ch.name = name
        ch.onmessage = onmessage
        ch.onopen = onopen
        ch.onclose = onclose
        ch.onerror = onerror
        ch.onbufferedamountlow = onbufferedamountlow
        if (ch.channel?.readyState === "open") 
            this.emit("data-channel", ch.channel)
        else if (!ch.channel || ch.channel.readyState === "closed" || ch.channel.readyState === "closing") 
            this.createDataChannel(ch)
    }

    private createDataChannel(ch: typeof this.dataChannels[keyof typeof this.dataChannels]) {
        if (!this.pc) return
        _debugger.log("{{data-channel}} create", ch.name)
        if (ch.channel)
            try { ch.channel.close() } catch {}
        let dc = ch.channel = this.pc.createDataChannel(ch.name)
        dc.addEventListener("message", ch.onmessage)
        if (ch.onopen)
            dc.addEventListener("open", ch.onopen)
        if (ch.onclose)
            dc.addEventListener("close", ch.onclose)
        if (ch.onerror)
            dc.addEventListener("error", ch.onerror)
        if (ch.onbufferedamountlow)
            dc.addEventListener("bufferedamountlow", ch.onbufferedamountlow)
        dc.addEventListener("error", () => ch.channel = undefined)
        dc.addEventListener("close", () => ch.channel = undefined)
        dc.addEventListener("open", () => this.emit("data-channel", dc))
        return dc
    }

    manageDataChannel(
        dc: RTCDataChannel, 
        onmessage: (this: RTCDataChannel, ev: MessageEvent<any>) => any,
        onopen?: (this: RTCDataChannel, ev: Event) => any,
        onclose?: (this: RTCDataChannel, ev: Event) => any,
        onerror?: (this: RTCDataChannel, ev: Event) => any,
        onbufferedamountlow?: (this: RTCDataChannel, ev: Event) => any
    ) {
        let ch = this.dataChannels[dc.label] ??= {} as any
        if (!(dc.label in (this.pc?.channels||{})) || (ch.channel && ch.channel.readyState === "open")) return
        ch.channel = dc
        dc.addEventListener("message", onmessage)
        if (onopen)
            dc.addEventListener("open", onopen)
        if (onclose)
            dc.addEventListener("close", onclose)
        if (onerror)
            dc.addEventListener("error", onerror)
        if (onbufferedamountlow)
            dc.addEventListener("bufferedamountlow", onbufferedamountlow)
        dc.addEventListener("error", () => ch.channel = undefined)
        dc.addEventListener("close", () => ch.channel = undefined)
        return dc
    }

    removeDataChannel(name: string) {
        _debugger.log("{{data-channel}} delete", name)
        this.disconnectDataChannel(name)
        delete this.dataChannels[name]
    }

    private disconnectDataChannel(name: string) {
        let ch: typeof this.dataChannels[keyof typeof this.dataChannels]
        if (!(ch = this.dataChannels[name])) return
        if (ch.channel) {
            let dc = ch.channel
            dc.close()
            ch.channel = undefined
        }
    }

    sendDataChannel(name: string, data: string) {
        const exists = this.isDataChannelExists(name)
        if (!exists) return exists
        // _debugger.log("{{data-channel}} send")
        this.dataChannels[name]!.channel!.send(data)
        return exists
    }

    isDataChannelExists(name: string) {
        let ch: typeof this.dataChannels[keyof typeof this.dataChannels]
        if (!(ch = this.dataChannels[name])) return false
        if (!ch.channel || ch.channel.readyState !== "open") return false
        return true
    }

    isDataChannelManaged(name: string) {
        let m = this.isDataChannelExists(name)
        if (m) return true
        m = !!this.pc?.channels[name]
        if (m) return false
        return undefined
    }
}