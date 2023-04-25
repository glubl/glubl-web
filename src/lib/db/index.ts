import Gun from "gun/gun"
import SEA from "gun/sea"
import "gun/lib/then"
import "gun/lib/radix"
import "gun/lib/radisk"
import "gun/lib/store"
import "./ntp"
import "../webrtcSignal"
import "./friendrtc"
import "./tunnel"

import { gunStore, localGunStore } from "../stores"
import type { ISEAPair } from "gun"
import { get } from "svelte/store"
import { goto } from "$app/navigation"
import { options, optionsLocal } from "./opts"
import { globalStorage, localStorage } from "./storage"

// (Gun.state as any).drift += 2000

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

  const localGun = Gun(localOpt)
  localGunStore.set(localGun)

  const gun = Gun(opt)
  window.gun = gun;
  gunStore.set(gun)

  
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