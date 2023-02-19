import {writable} from "svelte/store"

export const activeCallId = writable<string | null>(null)
export const selectedId = writable<string | null>(null)