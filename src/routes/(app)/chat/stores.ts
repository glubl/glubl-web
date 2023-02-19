import {writable} from "svelte/store"

export const activeCall = writable<string | null>(null)
export const selectedId = writable<string | null>(null)