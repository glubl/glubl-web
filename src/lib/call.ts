// import "@src/lib/webrtc"
// RFC Ice Candidate Attribute https://datatracker.ietf.org/doc/html/rfc8839#name-candidate-attribute

import { EventEmitter } from "events";
// import { localStream, screenStore } from "./stores";

export type MediaEvents = {
    "constraint"    : [constraint: MediaStreamConstraints]
    "userMedia"     : [stream: MediaStream | undefined]
    "recorder"      : [recorder: MediaRecorder | undefined]
    "data"          : [blob: Blob]
    "start"         : []
    "startRecorder" : []
    "stop"          : []
    "stopRecorder"  : []
    "audioMute"     : [mute: boolean]
    "videoMute"     : [mute: boolean]
}

export class MediaController extends EventEmitter<MediaEvents> {
    private _mediaRecorder?: MediaRecorder
    private _oldConstraint: MediaStreamConstraints = {}
    private _constraint: MediaStreamConstraints
    private _userMedia?: MediaStream
    private _recorderOptions: MediaRecorderOptions
    private _ongoing = false
    private _videoMute = true
    private _audioMute = true
    readonly timeslice: number

    constructor(constraint?: MediaStreamConstraints, timeslice?: number, recorderOptions?: MediaRecorderOptions) {
        super();
        this._constraint = constraint || { video: true, audio: true }
        this.timeslice = timeslice || 1000
        this._recorderOptions = recorderOptions || {
            mimeType: "video/webm"
        }
    }
    get isOnGoing() { return this._ongoing }
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
            .then((isRecreated) => isRecreated && this._userMedia && this.createRecorder())
    }

    async start(opt?: {videoMute?: boolean, audioMute?: boolean}) {
        const [videoMute, audioMute] = [opt?.videoMute || true, opt?.audioMute || true]
        return new Promise<void>(async (resolv, reject) => {
            try {
                await this.createMedia()
                this.createRecorder()
                if (this._mediaRecorder && this._mediaRecorder.state !== "recording") {
                    this.once("startRecorder", () => {
                        this.emit("start")
                        resolv()
                    })
                    this._mediaRecorder.start(this.timeslice)
                } else if (this._audioMute && this._videoMute) {
                    this.emit("start")
                }
                this._ongoing = true
            } catch (error) {
                reject(error)
            }
        })
    }

    async stop() {
        return new Promise<void>(async (resolv, reject) => {
            try {
                if (this._mediaRecorder && this._mediaRecorder.state !== "inactive") {
                    this._mediaRecorder.stop()
                }
                this.removeRecorder()
                this.removeMedia()
                this.emit("stop")
                this._ongoing = false
                resolv()
            } catch (error) {
                reject(error)
            }
            
        })
    }

    private _toggleVideo(mute: boolean) {
        this._videoMute = mute
        let track: MediaStreamTrack
        if (
            this._userMedia 
            && (track = this._userMedia.getVideoTracks()[0])
        ) {
            track.enabled = !this._videoMute
        } else if (this._ongoing && !this._videoMute) {
            this.createMedia()
                .then(() => {
                    this.createRecorder()
                    this._mediaRecorder?.start(this.timeslice)
                })
        }
    }

    toggleVideo(mute?: boolean) {
        if (mute === this._videoMute) return
        this._videoMute = mute || !this._videoMute
        this._toggleVideo(this._videoMute)
        this.emit("videoMute", this._videoMute)
    }

    private _toggleAudio(mute: boolean) {
        this._audioMute = mute
        let track: MediaStreamTrack
        if (
            this._userMedia 
            && (track = this._userMedia.getAudioTracks()[0]) 
        ) {
            track.enabled = !this._audioMute
        } else if (this._ongoing && !this._audioMute) {
            this.createMedia()
                .then(() => {
                    this.createRecorder()
                    this._mediaRecorder?.start(this.timeslice)
                })
        }
    }

    toggleAudio(mute?: boolean) {
        if (mute === this._audioMute) return
        this._audioMute = mute || !this._audioMute
        this._toggleAudio(this._audioMute)
        this.emit("audioMute", this._audioMute)
    }

    muteVideo() {
        this.toggleVideo(true)
    }

    muteAudio() {
        this.toggleAudio(true)
    }

    unmuteVideo() {
        this.toggleVideo(false)
    }

    unmuteAudio() {
        this.toggleAudio(false)
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
            if (JSON.stringify(this._constraint.audio) !== JSON.stringify(this._oldConstraint.audio)) {
                futs.push((track = this._userMedia?.getAudioTracks()[0])?.applyConstraints(
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
        return isRecreated
    }

    private async createMedia() {
        if (!this._constraint.audio && !this._constraint.video) return
        this.removeMedia()
        let constraint: MediaStreamConstraints = {
            audio: this._audioMute ? false : this._constraint.audio,
            video: this._videoMute ? false : this._constraint.video
        }
        if (!constraint.audio && !constraint.video) return
        
        this._userMedia = await navigator.mediaDevices.getUserMedia(constraint)
            .then((v) => {
                (v.getVideoTracks()[0] || {}).enabled = !this._videoMute;
                (v.getAudioTracks()[0] || {}).enabled = !this._audioMute
                return v
            })
        this.emit("userMedia", this._userMedia)
    }

    private removeMedia() {
        if (this._userMedia) {
            this._userMedia
                .getTracks()
                .forEach((stream) => {
                    stream.stop()
                    this._userMedia?.removeTrack(stream)
                })
            this.emit("userMedia", undefined)
        }
        this._userMedia = undefined
    }

    private createRecorder() {
        if (!this._userMedia) return
        
        this.removeRecorder()
        this._mediaRecorder = new MediaRecorder(this._userMedia, this._recorderOptions)
        this._mediaRecorder
            .addEventListener("start", () => this.emit("startRecorder"))
        this._mediaRecorder
            .addEventListener("stop", () => this.emit("stopRecorder"))
        this._mediaRecorder
            .addEventListener("dataavailable", (e) => this.emit("data", e.data))
        this._mediaRecorder
            .addEventListener("error", (e) => console.error(e))
        this.emit("recorder", this._mediaRecorder)
    }

    private removeRecorder() {
        if (this._mediaRecorder && this._mediaRecorder.state !== "inactive") {
            this._mediaRecorder.stop()
            this.emit("recorder", undefined)
        }
        this._mediaRecorder = undefined
    }
}

// export const call: any = {

//     call() {

//     },

//     reject() { },

//     // start only local media capture
//     async startCapture(constraints: MediaStreamConstraints) {
//         console.log("starting media capture...")
//         let { audio, peerIdentity, preferCurrentTab, video } = constraints
//         let newStream: MediaStream
//         newStream = await navigator.mediaDevices
//             .getUserMedia({ audio: true, video: video })
//         newStream.getVideoTracks().forEach(track => { if (!video) { track.stop(); newStream.removeTrack(track) } })
//         newStream.getAudioTracks().forEach(track => { if (!audio) { track.enabled = false } })
//         if (newStream) {
//             localStream.set(newStream)
//         }
//     },

//     // update change on local media device
//     async updateCapture(constraints: MediaStreamConstraints) {
//         let stream = get(localStream)
//         let newStream: MediaStream
//         let { audio, peerIdentity, preferCurrentTab, video } = constraints

//         if (!stream) { return }
//         if (!audio) {
//             constraints.audio = true
//             newStream = await navigator.mediaDevices.getUserMedia((constraints))
//             newStream.getAudioTracks().forEach(track => {
//                 track.enabled = !!audio;
//             })
//         } else {
//             newStream = await navigator.mediaDevices.getUserMedia((constraints))
//         }
//         stream.getTracks().forEach(track => track.stop())
//         localStream.set(newStream)
//     },

//     // end only local media capture
//     async endCapture() {
//         if (get(localStream)) {
//             get(localStream)!.getTracks().forEach((track) => track.stop())
//         }
//         localStream.set(null)
//         screenStore.currentActiveCall.set(false)
//     },
// }

// const call = new CallController()
// export default call
