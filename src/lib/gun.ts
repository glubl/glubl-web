import Gun from "gun/gun"
import SEA from "gun/sea"
import "gun/lib/then"
import "gun/lib/radix"
import "gun/lib/radisk"
import "gun/lib/store"

import { gunStore, localGunStore } from "./stores"
import type { GunOptions, IGunInstance, IGunInstanceRoot, IGunUserInstance, ISEA, ISEAPair } from "gun"
import localforage from "localforage"
import { get } from "svelte/store"
import { Unauthenticated } from "./errors"
import { goto } from "$app/navigation"

let gunApp: {
  gun: IGunInstance<any>;
  SEA: ISEA;
  user: IGunUserInstance<any, any, any, IGunInstanceRoot<any, IGunInstance<any>>>;
  pair: ISEAPair;
}

const options : GunOptions & {[key: string]:any} = {
    peers: ["https://gun.dirtboll.com/gun"],
    file: "global",
}

const optionsLocal : GunOptions & {[key: string]:any} = {
    peers: [],
    file: "local",
    WebSocket: false,
    ws: false,
    RTCPeerConnection: false
}

const globalStorage = localforage.createInstance({
  name: options.file || "global",
  description: "Global Gun Storage"
})

const localStorage = localforage.createInstance({
  name: optionsLocal.file || "local",
  description: "Local Gun Storage"
})

export async function init() {
  globalStorage.ready().then(() => {
    console.log(`Using ${globalStorage.driver()} for global storage`)
  })
  localStorage.ready().then(() => {
    console.log(`Using ${localStorage.driver()} for local storage`)
  })

  // Need to deep copy to recreate gun because gun stores
  // everything in opt object and it needs to be cleared.
  const opt = JSON.parse(JSON.stringify(options))
  const localOpt = JSON.parse(JSON.stringify(optionsLocal))
  opt.store = {
    put: globalStorage.setItem,
    get: globalStorage.getItem
  }
  localOpt.store = {
    put: localStorage.setItem,
    get: localStorage.getItem
  }

  const gun = Gun(opt)
  window.gun = gun;
  gunStore.set(gun)

  const localGun = Gun(localOpt)
  localGunStore.set(localGun)
}

export function deinit() {
  const gun = get(gunStore)
  const opt = (gun as any).back("opt")
  Object.entries(opt.peers).map(([k, v]) => opt.mesh.bye(v))
  // Buggy
  const user = gun.user()
  user.leave();
  (user._ as any).sea = undefined
}

export function getGun() {
  const gun = get(gunStore)
  const user = gun.user()
  const pair = (user._ as any).sea as ISEAPair
  if (!pair)
    goto("/login")
  return { gun, SEA, user, pair }
}