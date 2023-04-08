import type { GunOptions } from "gun"

export const options : GunOptions & {[key: string]:any} = {
  peers: ["https://gun.dirtboll.com/gun"],
  file: "global",
}

export const optionsLocal : GunOptions & {[key: string]:any} = {
  peers: [],
  file: "local",
  WebSocket: false,
  ws: false,
  RTCPeerConnection: false,
  ntp: false
}