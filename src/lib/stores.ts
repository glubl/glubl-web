import type { IGunInstance } from "gun"
import { writable, readable } from "svelte/store"

export const chatStore = {
  selectedAddFriend: writable(true),
  selectedFriend: writable<string>("")
}

export const menuOpen = writable(false)
export const gunStore = writable<IGunInstance<any>>()
export const localGunStore = writable<IGunInstance<any>>()
export const friendsStore = writable<{[pub: string]: FriendProfile}>()