import type { GunOptions } from "gun"

import Gun from "gun/gun"
import "gun/lib/radix"
import "gun/lib/radisk"
import "gun/lib/store"
import "gun/lib/rindexed"

const options : GunOptions = {
    peers: ["http://localhost:8765/gun"],
    file: 'db.json', 
    localStorage: false,
    indexedDB: true,
    radisk: true, 
}

const optionsLocal : GunOptions = {
    peers: ["http://localhost:8765/gun"],
    localStorage: true,
    indexedDB: false,
    radisk: false, 
}

const gun = Gun(options)
export const gunLocal = Gun(optionsLocal)

export const gunRoot = gun._

export default gun 
