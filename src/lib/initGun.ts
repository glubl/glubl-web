import type { GunOptions } from "gun"

import Gun from "gun/gun"

const options : GunOptions = {
    peers: ["http://localhost:8765/gun"],
    file: 'db.json', 
    localStorage: true,
    radisk: true, 
}

const gun = Gun(options)

export const gunRoot = gun._

export default gun 
