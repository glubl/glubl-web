import type { Profile } from "./types"
import type { ISEAPair } from "gun"
import { writable } from "svelte/store"

var currentUser = writable<Profile>()
var settings = writable<any>()
var loggedIn = writable<boolean>(false)
var key = writable<ISEAPair>()

export { currentUser, settings, loggedIn, key }
