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
    let { audio, peerIdentity, preferCurrentTab, video} = constraints
    navigator.mediaDevices
    .getUserMedia({ audio: audio, video: video })
    .then((stream)=>{
      stream.getAudioTracks().forEach(audio => audio.onmute = () => console.log("mic muted"))
      stream.getVideoTracks().forEach(video => video.onmute = () => console.log("cam off"))
      localStream.set(stream)
      }).catch((err)=> {
        console.log("Unable to use camera:\n", {err})
        return
      })
    },

  // update change on local media device
  async updateCapture(constraints: MediaStreamConstraints) {
    let stream = get(localStream)
    let { audio, peerIdentity, preferCurrentTab, video } = constraints

    if (!stream) {return}
    if (audio && video) {
      navigator.mediaDevices.getUserMedia((constraints))
        .then((newStream) => {
          stream?.getVideoTracks().forEach(track=> {track.stop(); stream?.removeTrack(track)});
          newStream.getVideoTracks().forEach(track => stream?.addTrack(track))
        })
      stream.getTracks().forEach((track) => track.enabled = true)
    } else if (audio) {
      stream.getAudioTracks().forEach((track) => track.enabled = true)
      stream.getVideoTracks().forEach((track) => {track.stop(); stream?.removeTrack(track)})
    } else if (video) {
      navigator.mediaDevices.getUserMedia((constraints))
        .then((newStream) => {
          stream?.getVideoTracks().forEach(track=> {track.stop(); stream?.removeTrack(track)});
          newStream.getVideoTracks().forEach(track => stream?.addTrack(track))
        })
      stream.getAudioTracks().forEach((track) => track.enabled = false)
    } else {
      stream.getVideoTracks().forEach((track) => {track.stop(); stream?.removeTrack(track)})
      stream.getTracks().forEach((track) => track.enabled = false)
    }
    localStream.set(stream)
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
