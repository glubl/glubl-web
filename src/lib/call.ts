// import "@src/lib/webrtc"
// RFC Ice Candidate Attribute https://datatracker.ietf.org/doc/html/rfc8839#name-candidate-attribute

import { EventEmitter, type EventReceiver } from "events";
import type { RTCPeer } from "./webrtc";
import type { EventMap } from "events";
import { getGun } from "./db";
import { getUserSpacePath } from "./utils";
import { friendsStore } from "./stores";
import SEA from "gun/sea";
import { DecriptionFail, SharedCreationFail, VerifyFail } from "./errors";
import { Debugger } from "./debugger";
// import { localStream, screenStore } from "./stores";


const isDebug = false
const _debugger = Debugger("call", isDebug)

export type CallStreamKind = "cam" | "screen"
export type CallStream = {
    id: string,
    stream: MediaStream,
    kind: CallStreamKind
}
export type CallStreams = {[id: string]: CallStream}
export type CallPeerState = 'connecting' | 'open' | 'closed'
export type CallPeerEvents = {
    "statechange"   : [state: CallPeerState, reason?: string]
    "audioMute"     : [mute: boolean]
    "videoMute"     : [mute: boolean]
    "addStream"     : [stream: MediaStream, kind: CallStreamKind]
    "removeStream"  : [stream: MediaStream, kind: CallStreamKind]
}

abstract class BasePeer<T extends EventMap> extends EventEmitter<CallPeerEvents & T> {
    abstract get isVideoMuted(): boolean
    abstract get isAudioMuted(): boolean
    abstract get state(): CallPeerState
    abstract get streams(): CallStreams
    abstract get callId(): string
    abstract get peerId(): string
    abstract get channelName(): string
    abstract getStreamByKind(kind: CallStreamKind): MediaStream[]
}

export abstract class CallPeer extends BasePeer<{}> {}

interface CallPeerRemoteData {
    type: "hi" | "bye" | "audioMute" | "videoMute" | "stream"
    mute?: boolean
    reason?: string
    streamId?: string
    streamKind?: CallStreamKind
}

class RemotePeer extends BasePeer<{}> {
    readonly channelName: string
    readonly peerId: string
    private _state: CallPeerState = 'connecting'
    private _rtc: RTCPeer
    private _videoMute = true
    private _audioMute = true
    private _controller: CallController
    private remoteStreams: CallStreams = {}
    private kindToStreamId: {[kind: string]: Set<string>} = {}
    private pendingRemoteStreams: CallStreams & {
        [id: string]: {
            defer?: ReturnType<typeof setTimeout>
        }
    } = {}

    private _debugger?: ReturnType<typeof Debugger>

    get state() { return this._state }
    private setState(s: CallPeerState, reason?: string) { 
        console.log("FFF", s)
        if (this._state === s) return
        console.log("GGGG")
        this._state = s 
        this.emit("statechange", s, reason)
    }
    private set videoMute(mute: boolean) {
        _debugger.log("{{videoMute}}", mute)
        if (this._videoMute === mute) return
        this._videoMute = mute
        this.emit("videoMute", this._videoMute)
    }
    private set audioMute(mute: boolean) {
        _debugger.log("{{audioMute}}", mute)
        if (this._audioMute === mute) return
        this._audioMute = mute
        this.emit("audioMute", this._audioMute)
    }
    get isVideoMuted() { return this._videoMute }
    get isAudioMuted() { return this._audioMute }

    get callId() { return this._controller.callId }

    private init: () => void
    constructor(peerId: string, rtc: RTCPeer, controller: CallController) {
        super()
        this._rtc = rtc
        this._controller = controller
        this.channelName = `call-${controller.callId}`
        this.peerId = peerId
        this._debugger = Debugger(`call ${peerId}`, isDebug)
        let onMessage: (ev: MessageEvent<string>) => void = (e) => this.receive(e.data)
        let onClose: () => void = () => this.disconnect("Disconnected")
        let onError: (ev: string | Event) => void = (e) => this.disconnect("Error: " + e)
        


        /**
         * Data channels for signalling
         */
        rtc.addDataChannel(this.channelName, onMessage)
        let cb: (dc: RTCDataChannel) => void
        rtc.on("data-channel", cb = (dc) => {
            if (dc.label === this.channelName){
                this._debugger?.log("{{channel}} in", dc.label)
                dc.addEventListener("close", onClose)
                dc.addEventListener("error", onError)
                this.send({type: "hi"})
                rtc.off("data-channel", cb)
            }
        })
        rtc.once("disconnected", onClose)
        this.on("statechange", (state) => {
            if (state !== "closed") return
            rtc.off("data-channel", cb)
            rtc.off("disconnected", onClose)
        })



        /**
         * Wait for "hi" before sending streams
         */
        this.init = () => {
            this._debugger?.log("{{init}}")
             /**
             * Streams from controller (local) to be sent to peer (remote)
             */
            const localStreams: Set<string> = new Set()
            const controllerOnAddStream = (stream: MediaStream, kind: CallStreamKind) => {
                console.log(stream.getTracks().length === 0, localStreams.has(stream.id))
                if (stream.getTracks().length === 0) return
                if (localStreams.has(stream.id)) return
                this._debugger?.log("::stream:: controller in")
                this.send({
                    type: "stream",
                    streamId: stream.id,
                    streamKind: kind
                })
                const onRemoveTrack = () => {
                    if (stream.getTracks().length === 0) {
                        controllerOnRemoveStream(stream, kind)
                    }
                }
                stream.addEventListener("removetrack", onRemoveTrack)
                localStreams.add(stream.id)
                rtc.addStream(stream)
            }
            const controllerOnRemoveStream = (stream: MediaStream, kind: CallStreamKind) => {
                this._debugger?.log("::stream:: controller remove")
                stream.removeEventListener("removetrack", onRemoveTrack)
                localStreams.delete(stream.id)
                rtc.removeStream(stream)
            }
            const onVideoMute = (mute: boolean) => {
                console.log(mute)
                this.send({type: "videoMute", mute: mute})
            }
            const onAudioMute = (mute: boolean) => {
                this.send({type: "audioMute", mute: mute})
            }
            controller.on("addStream", controllerOnAddStream)
            controller.on("removeStream", controllerOnRemoveStream)
            controller.on("videoMute", onVideoMute)
            controller.on("audioMute", onAudioMute)
            this.send({type: "audioMute", mute: this._controller.isAudioMuted})
            this.send({type: "videoMute", mute: this._controller.isVideoMuted})
            let streams = Object.values(controller.streams)
            if (streams.length > 0) {
                console.log("DDD")
                this.on("statechange", (state: CallPeerState, reason?: string) => {
                    console.log("CCC", state)
                    if (state === "open") {
                        console.log("AAA")
                        for (const { stream, kind } of streams!) {
                            console.log("BBB")
                            controllerOnAddStream(stream, kind)
                        }
                    }
                })
            }
                



            /**
             * Streams from peer (remote)
             */
            let ins = this
            const onRemoveTrack = function (this: MediaStream) {
                if (this.getTracks().length === 0) {
                    const { kind } = ins.remoteStreams[this.id]
                    delete ins.remoteStreams[this.id]
                    ;(ins.kindToStreamId[kind]??=new Set()).delete(this.id)
                    ins.emit("removeStream", this, kind)
                    ins._debugger?.log("::stream:: peer remove", this.id)
                }
            }
            const peerOnStream = (stream: MediaStream) => {
                if (this.remoteStreams[stream.id]) return
                let st = this.pendingRemoteStreams[stream.id] ??= {} as any
                if (st.kind) {
                    stream.addEventListener("removetrack", onRemoveTrack)
                    delete this.pendingRemoteStreams[stream.id]
                    this.remoteStreams[stream.id] = {
                        id: stream.id,
                        stream: stream,
                        kind: st.kind
                    }
                    ;(this.kindToStreamId[st.kind] ??= new Set()).add(stream.id)
                    this.emit("addStream", stream, st.kind)
                    ins._debugger?.log("::stream:: peer in", st.kind, stream)
                    return
                }
                st.id = stream.id
                st.stream = stream
                stream.addEventListener("removetrack", onRemoveTrack)
                st.defer = setTimeout(() => {
                    stream.removeEventListener("removetrack", onRemoveTrack)
                    this._debugger?.log("::stream:: peer timeout", stream.id)
                    delete this.pendingRemoteStreams[stream.id]
                }, 30*1000)
                this._debugger?.log("::stream:: peer cache (stream)", stream.id)
            }
            rtc.on("stream", peerOnStream)



            /**
             * Clean-up listener on disconnect
             */
            const onStateChange = (state: CallPeerState) => {
                this._debugger?.log("{{state}}", state)
                if (state !== "closed") return
                controller.off("addStream", controllerOnAddStream)
                controller.off("removeStream", controllerOnRemoveStream)
                rtc.off("stream", peerOnStream)
                this.off("statechange", onStateChange)
            }
            this.on("statechange", onStateChange)
        }

    }

    get streams(): CallStreams {
        return this.remoteStreams
    }

    private receive(d: string) {
        let data: CallPeerRemoteData
        try {
            data = JSON.parse(d)
        } catch {
            return
        }
        this._debugger?.log("{{receive}}", data.type)
        switch (data.type) {
            case "audioMute":
                this.audioMute = data.mute === undefined ? this._audioMute : data.mute
                break;
            case "videoMute":
                this.videoMute = data.mute === undefined ? this._videoMute : data.mute
                break;
            case "hi":
                if (this.state === "open") {
                    return
                }
                this.init()
                this.setState("open")
                this.send({type: "hi"})
                break;
            case "bye":
                this.disconnect("bye")
                break;
            case "stream": 
                const { streamId, streamKind } = data
                if (!streamId || !streamKind || this.remoteStreams[streamId]) return
                let st = this.pendingRemoteStreams[streamId] ??= {} as any
                if (st.stream) {
                    clearTimeout(st.defer)
                    delete this.pendingRemoteStreams[streamId]
                    this.remoteStreams[streamId] = {
                        id: streamId,
                        kind: streamKind,
                        stream: st.stream
                    }
                    ;(this.kindToStreamId[streamKind] ??= new Set()).add(streamId)
                    this.emit("addStream", st.stream, streamKind)
                    this._debugger?.log("::stream:: peer in", st.kind, streamId)
                    break;
                }
                st.id = streamId
                st.kind = streamKind
                this._debugger?.log("::stream:: peer cache (kind)", st.kind, streamId)
                break;
            default:
                break;
        }
    }

    private send(d: CallPeerRemoteData) {
        this._debugger?.log("{{send}}", d.type)
        this._rtc.sendDataChannel(this.channelName, JSON.stringify(d))
    }

    disconnect(reason?: string) {
        if (this.state === "closed") return
        if (reason !== "bye")
            this.send({"type": "bye"})
        this._rtc.removeDataChannel(this.channelName)
        this.emit("statechange", "closed", reason)
        this._debugger?.log("{{disconnect}}")
    }

    getStreamByKind(kind: CallStreamKind): MediaStream[] {
        let res: MediaStream[] = []
        ;(this.kindToStreamId[kind]??=new Set()).forEach((id) => {
            res.push(this.remoteStreams[id].stream)
        })
        return res
    }
}
type ControllerEvents = { 
    "addPeer": [peer: CallPeer]
    "removePeer": [peer: CallPeer]
    "broadcastsend": [peerId: string]
}
abstract class Controller extends BasePeer<ControllerEvents> {}
export class CallController extends Controller {
    private _oldConstraint: MediaStreamConstraints = {}
    private _constraint: MediaStreamConstraints
    private _userMedia?: MediaStream
    private _state: CallPeerState = "closed"
    private _videoMute = true
    private _audioMute = true
    private _streams: {[id: string]: {
        id: string,
        stream: MediaStream,
        kind: CallStreamKind
    }} = {}
    private _peerId?: string
    get peerId() { return this._peerId || "" }
    private kindToStreamId: {[kind: string]: Set<string>} = {}

    private _peers: {[id: string]: RemotePeer} = {}
    // readonly selfPeer: LocalPeer

    get streams() { return this._streams }
    get channelName() { return `call-${this.callId}` }

    constructor(constraint?: MediaStreamConstraints) {
        super();
        this._constraint = constraint || { video: true, audio: true }
        // this.selfPeer = new LocalPeer(this)
        this.on("statechange", (state, reason) => {
            if (state !== "open") return
            this.emit("broadcastsend", this.peerId)
        })
    }

    get stream() { return this._userMedia }
    get state() { return this._state }
    private set state( state: CallPeerState ) { 
        if (state === this._state) return
        this._state = state
        this.emit("statechange", state)
        _debugger.log("{{state}}", state)
    }   
    get isOnGoing() { return this._state === "open" }
    get userMedia() { return this._userMedia }
    get constraint() { return this._constraint }
    set constraint(c: MediaStreamConstraints) { 
        this._oldConstraint = this._constraint
        this._constraint = c 

        let isSame = false
        try { isSame = JSON.stringify(this._constraint) === JSON.stringify(this._oldConstraint) }
        catch {}
        if (isSame) return

        this.updateMedia()
        _debugger.log("{{contraint}}", c)
    }

    private _callId?: string
    get callId(): string { return this._callId || "" }
    async start(callId: string, peerId: string, opt?: {videoMute?: boolean, audioMute?: boolean}) {
        _debugger.log("{{start}}")
        this._callId = callId
        this._peerId = peerId
        if (opt?.videoMute !== undefined)
            this._videoMute = opt.videoMute
        if (opt?.audioMute !== undefined)
            this._audioMute = opt.audioMute
        await this.createMedia()
        this.state = "open"
    }

    stop() {
        _debugger.log("{{stop}}")
        this.removeMedia()
        for (const peerId in this._peers)
            this.removePeer(peerId)
        this.state = "closed"
        this._callId = undefined
        this._peerId = undefined
    }

    private async _toggleVideo(mute: boolean) {
        this._videoMute = mute
        let track: MediaStreamTrack
        if (
            this._userMedia 
            && (track = this._userMedia.getVideoTracks()[0])
        ) {
            track.enabled = !this._videoMute
        } else if (this.isOnGoing && !this._videoMute) {
            await this.createMedia()
        }
    }

    async toggleVideo(mute?: boolean) {
        if (mute === this._videoMute) return
        this._videoMute = mute === undefined ? !this._videoMute : mute
        await this._toggleVideo(this._videoMute)
        this.emit("videoMute", this._videoMute)
        _debugger.log("{{video}}", this._videoMute)
    }

    private async _toggleAudio(mute: boolean) {
        this._audioMute = mute
        let track: MediaStreamTrack
        if (
            this._userMedia 
            && (track = this._userMedia.getAudioTracks()[0]) 
        ) {
            track.enabled = !this._audioMute
        } else if (this.isOnGoing && !this._audioMute) {
            await this.createMedia()
        }
        
    }

    async toggleAudio(mute?: boolean) {
        if (mute === this._audioMute) return
        this._audioMute = mute === undefined ? !this._audioMute : mute
        await this._toggleAudio(this._audioMute)
        _debugger.log("{{audio}}", this._audioMute)
        this.emit("audioMute", this._audioMute)
    }

    get isVideoMuted() {
        return !this._userMedia?.getVideoTracks()[0]?.enabled
    }

    get isAudioMuted() {
        return !this._userMedia?.getAudioTracks()[0]?.enabled
    }

    private async updateMedia() {
        let isRecreated = false
        // Remove or add video or audio
        if (
            !this._constraint.audio !== !this._oldConstraint.audio ||
            !this._constraint.video !== !this._oldConstraint.video
        ) {
            await this.createMedia()
            isRecreated = true
        } else {
            let track: MediaStreamTrack | undefined
            let futs = []
            if (
                JSON.stringify(this._constraint.audio) !== JSON.stringify(this._oldConstraint.audio)
                && (track = this._userMedia?.getAudioTracks()[0])
            ) {
                futs.push(track.applyConstraints(
                    this._constraint.audio == true 
                        ? undefined 
                        : (this._constraint.audio || undefined))
                )
            }
            if (JSON.stringify(this._constraint.video) !== JSON.stringify(this._oldConstraint.video)) {
                futs.push((track = this._userMedia?.getVideoTracks()[0])?.applyConstraints(
                    this._constraint.video == true 
                        ? undefined 
                        : (this._constraint.video || undefined))
                )
            }
            await Promise.all(futs)
        }
        _debugger.log("{{media}} update")
        return isRecreated
    }

    private async createMedia() {
        this.removeMedia()
        let constraint = this._constraint
        if (!constraint.audio && !constraint.video) return
        
        this._userMedia = await navigator.mediaDevices.getUserMedia(constraint);
        let track: MediaStreamTrack
        if (track = this._userMedia.getAudioTracks()[0]) {
            track.enabled = !this._audioMute
            this.addStream(new MediaStream([track]), "cam")
        }
        if (track = this._userMedia.getVideoTracks()[0]) {
            track.enabled = !this._videoMute
            this.addStream(new MediaStream([track]), "cam")
        }
        _debugger.log("{{media}} create")
    }

    private removeMedia() {
        this.getStreamByKind("cam").forEach((s) => {
            this.removeStream(s)
            this.destroyStream(s)
        })
        if (this._userMedia) {
            _debugger.log("{{media}} remove")
            this.destroyStream(this._userMedia)
            this._userMedia = undefined
        }
    }

    addStream(stream: MediaStream, kind: CallStreamKind) {
        if (this._streams[stream.id]) return
        _debugger.log("{{stream}} add", stream.id)
        this._streams[stream.id] = {
            id: stream.id,
            stream: stream,
            kind: kind
        }
        ;(this.kindToStreamId[kind] ??= new Set()).add(stream.id)
        this.emit("addStream", stream, kind)
    }

    removeStream(stream: MediaStream) {
        const st = this._streams[stream.id]
        if (!st) return
        _debugger.log("{{stream}} remove", stream.id)
        ;(this.kindToStreamId[st.kind]??=new Set()).delete(stream.id)
        delete this._streams[stream.id]
        this.emit("removeStream", st.stream, st.kind)
    }


    private destroyStream(stream?: MediaStream) {
        if (!stream) return
        stream.getTracks()
            .forEach((track) => {
                try { track.stop() } catch (_) {}
                stream.removeTrack(track)
            })
    }

    addPeer(peerId: string, conn: RTCPeer): CallPeer {
        if (this._peers[peerId]) return this._peers[peerId]
        _debugger.log("{{peer}} add", peerId)
        let peer = this._peers[peerId] = new RemotePeer(peerId, conn, this)
        peer.on("statechange", (state, reason) => {
            if (state === "closed") 
                this.doRemovePeer(peer.peerId, reason)
            else if (state === "open")
                this.emit("addPeer", peer)
        })
        return peer
    }

    removePeer(id: string, reason?: string) {
        let peer = this._peers[id]
        if (!peer) return
        peer.disconnect(reason || "removed")
        this.doRemovePeer(id, reason)
    }

    private doRemovePeer(id: string, reason?: string) {
        let peer = this._peers[id]
        if (!peer) return
        _debugger.log("{{peer}} remove", id)
        delete this._peers[id]
        this.emit("removePeer", peer)
    }

    getPeer(peerId: string): CallPeer | undefined {
        if (peerId === this.peerId) return this as CallPeer
        return this._peers[peerId]
    }

    get peers(): {[id: string]: CallPeer} { return {...this._peers} }
    get participants(): readonly CallPeer[] { return [...Object.values(this._peers), this as CallPeer] }

    getStreamByKind(kind: CallStreamKind): MediaStream[] {
        let res: MediaStream[] = []
        ;(this.kindToStreamId[kind]??=new Set()).forEach((id) => {
            res.push(this._streams[id].stream)
        })
        return res
    }
}

type FriendNotification = {
    type: "call" | "message"

}

// export const init = async () => {
//     const { gun, user, pair} = getGun()
//     let friendSet = new Set<string>()
//     let startTime = +new Date
//     friendsStore.subscribe(o => Object.entries(o).forEach(async ([id, friend]) => {
//         if (friendSet.has(id)) return
//         friendSet.add(id)
//         let _ = await SEA.secret(friend.epub, pair);
//         if (!_) throw new SharedCreationFail();
//         let shared = _;

//         let mySpacePath = await getUserSpacePath(pair.pub, shared)
//         gun.get("~"+friend.pub)
//             .get("spaces")
//             .get(mySpacePath)
//             .get("notifs")
//             .map()
//             .on(async (v, k, meta, e) => {
//                 if (meta.put['>'] < startTime || typeof v !== "string") return
//                 const enc = await SEA.verify(v, friend.pub);
//                 if (!enc) throw new VerifyFail();
//                 const data = await SEA.decrypt(enc, shared);
//                 if (!data) throw new DecriptionFail();
//                 const { type } = data as FriendNotification
//                 if (!type) return

//             })

//     }))
//   }
  
//   export const deinit = () => {
    
//   }
