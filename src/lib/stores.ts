import type { IGunInstance } from "gun"
import { writable, type Readable } from "svelte/store"
import { CallController } from "./call"
import type { Group } from "./mls/group"

export const screenStore = {
  selectedChatMenu: writable<string>(),
  selectedGroupMenu: writable<string | undefined>(),
  selectedFriendProfile: writable<FriendProfile | undefined>(),
  selectedGroup: writable<Partial<Group> | undefined>(),
  currentActiveCall: writable<boolean>(true)
}

export let localStreams: {[key: string]: Readable<CallController>} = {
  call: writable<CallController>(new CallController())
}
export let remoteStreams: {[key: string]: Readable<CallController>} = {}

// export const localStream = writable<MediaStream | null>(null)
// export const remoteStreamMap = writable<{[pub: string] : MediaStream | null}>({})
// export const deviceLabels = writable<string[]>([]);

export const menuOpen = writable(false)
export const manageOpen = writable(false)
export const callExpanded = writable(false)
export const gunStore = writable<IGunInstance<any>>()
export const localGunStore = writable<IGunInstance<any>>()
export const friendsStore = writable<{[pub: string]: FriendProfile}>({})
export const groupMembersStore = writable<{[pub: string]: FriendProfile}>({})
export const groupsStore = writable<{[id: string]: Partial<Group>}>({})
export const myProfileStore = writable<FriendProfile | undefined>()
export const callFriendStore = writable<{[pub: string]: FriendProfile}>({})

export function clear() {
  screenStore.selectedChatMenu.set("")
  screenStore.selectedFriendProfile.set(undefined)
  screenStore.currentActiveCall.set(false)
  menuOpen.set(false)
  friendsStore.set({})
  myProfileStore.set(undefined)
}