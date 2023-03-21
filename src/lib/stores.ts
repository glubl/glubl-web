import type { IGunInstance } from "gun"
import { writable } from "svelte/store"

export const screenStore = {
  selectedChatMenu: writable<string>(),
  selectedFriendProfile: writable<FriendProfile | undefined>(),
  currentActiveCall: writable<boolean>(true)
}

export const localStream = writable<MediaStream | null>(null)
export const remoteStream = writable<MediaStream | null>(null)

export const menuOpen = writable(false)
export const callExpanded = writable(false)
export const gunStore = writable<IGunInstance<any>>()
export const localGunStore = writable<IGunInstance<any>>()
export const friendsStore = writable<{[pub: string]: FriendProfile}>({})
export const profileStore = writable<FriendProfile | undefined>()
export const callFriendStore = writable<{[pub: string]: FriendProfile}>({})

export function clear() {
  screenStore.selectedChatMenu.set("")
  screenStore.selectedFriendProfile.set(undefined)
  screenStore.currentActiveCall.set(false)
  menuOpen.set(false)
  friendsStore.set({})
  profileStore.set(undefined)
}