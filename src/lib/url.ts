import { goto } from '$app/navigation'
import { derived, writable, type Readable } from 'svelte/store'
import { canAuthenticate } from './auth'

const href = writable<string | undefined>()

if (typeof(window) !== 'undefined') {
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
  updateHref()
}


export default derived(href, ($href) => $href ? new URL($href) : undefined)

