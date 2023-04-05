// import "@src/lib/webrtc"
// RFC Ice Candidate Attribute https://datatracker.ietf.org/doc/html/rfc8839#name-candidate-attribute

import { localStream, screenStore } from "./stores";
import { get } from "svelte/store";

// const servers = {
//   iceServers: [
//     {
//       urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
//     },
//   ],
//   iceCandidatePoolSize: 10,
// };

// // Global State
// const pc = new RTCPeerConnection(servers)
// const pc2 = new RTCPeerConnection(servers)

export const call: any = {
  makeCall() { },

  reject() { },

  // start only local media capture
  async startCapture(constraints: MediaStreamConstraints) {
    console.log("starting media capture...")
    let { audio, peerIdentity, preferCurrentTab, video } = constraints
    let newStream: MediaStream
    newStream = await navigator.mediaDevices
      .getUserMedia({ audio: true, video: true })      
    newStream.getVideoTracks().forEach(track => { if (!video) { newStream.removeTrack(track) } })
    newStream.getAudioTracks().forEach(track => { if (!audio) { track.enabled = false } })
    if (newStream) {
      localStream.set(newStream)
    }
  },

  // update change on local media device
  async updateCapture(constraints: MediaStreamConstraints) {
    let stream = get(localStream)
    let newStream : MediaStream
    let { audio, peerIdentity, preferCurrentTab, video } = constraints

    if (!stream) {return}
    if (!audio) {
      constraints.audio = true
      newStream = await navigator.mediaDevices.getUserMedia((constraints))
      newStream.getAudioTracks().forEach(track => { 
        track.enabled = !!audio; 
      })
    } else {
      newStream = await navigator.mediaDevices.getUserMedia((constraints))
    }
    localStream.set(newStream)
  },

  // end only local media capture
  async endCapture() {
    if (get(localStream)) {
      get(localStream)!.getTracks().forEach((track) => track.stop())
    }
    localStream.set(null)
    screenStore.currentActiveCall.set(false)
  },
}

export default call
