import { goto } from '$app/navigation'
import { derived, writable } from 'svelte/store'
import { canAuthenticate } from './auth'

const href = writable(window.location.href)
const originalPushState = history.pushState
const originalReplaceState = history.replaceState
const updateHref = () => href.set(window.location.href)

history.pushState = function (...args: any) {
  originalPushState.apply(this, args)
  updateHref()
}

history.replaceState = function (...args: any) {
  originalReplaceState.apply(this, args)
  updateHref()
}

window.addEventListener('popstate', updateHref)
window.addEventListener('hashchange', updateHref)

const urlStore = derived(href, ($href) => new URL($href))
export default urlStore

