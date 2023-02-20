import type { GunOptions } from "gun"

import Gun from "gun/gun"
import "gun/sea"
import "gun/lib/radix"
import "gun/lib/radisk"
import "gun/lib/store"
import "gun/lib/rindexed"
import "gun/lib/then"

const options : GunOptions = {
    peers: ["https://gun.dirtboll.com/gun"],
    file: "global",
    localStorage: false,
    indexedDB: true,
    radisk: true, 
}

const optionsLocal : GunOptions = {
    peers: [],
    file: "local",
    localStorage: true,
    indexedDB: true,
    radisk: true, 
    WebSocket: false,
    ws: false,
    RTCPeerConnection: false
}

export const gun = Gun(options)
export const gunLocal = Gun(optionsLocal)
