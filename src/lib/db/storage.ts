import localforage from "localforage"

export const globalStorage = localforage.createInstance({
  name: "global",
  description: "Global Gun Storage"
})

export const localStorage = localforage.createInstance({
  name: "local",
  description: "Local Gun Storage"
})