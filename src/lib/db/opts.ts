import type { GunOptions } from "gun"

export const options : GunOptions = {
  peers: ["https://test-gun.glubl.io/gun"] as any,
  file: "global",
}

export const optionsLocal : GunOptions = {
  peers: [] as any,
  file: "local",
  WebSocket: false,
  ws: false,
  RTCPeerConnection: false,
  ntp: false,
  Tunnel: false
}