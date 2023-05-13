import type { GunOptions } from "gun"

export const options : GunOptions = {
  peers: ["https://gun.glubl.io/gun"],
  file: "global",
}

export const optionsLocal : GunOptions = {
  peers: [],
  file: "local",
  WebSocket: false,
  ws: false,
  RTCPeerConnection: false,
  ntp: false,
  Tunnel: false
}