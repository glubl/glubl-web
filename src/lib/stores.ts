import type { IGunInstance } from "gun"
import { writable, readable } from "svelte/store"

export const screenStore = {
  selectedChatMenu: writable<string>(),
  selectedFriendProfile: writable<FriendProfile | undefined>()
}

export const menuOpen = writable(false)
export const gunStore = writable<IGunInstance<any>>()
export const localGunStore = writable<IGunInstance<any>>()
export const friendsStore = writable<{[pub: string]: FriendProfile}>({})
export const profileStore = writable<FriendProfile | undefined>()

export function clear() {
  screenStore.selectedChatMenu.set("")
  screenStore.selectedFriendProfile.set(undefined)
  menuOpen.set(false)
  friendsStore.set({})
  profileStore.set(undefined)
}