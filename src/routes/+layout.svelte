<script lang="ts">
  import auth, { canAuthenticate } from "@src/lib/auth";
  import { onMount } from "svelte";
  import * as db from "@src/lib/gun";
  import * as friends from "@src/lib/friends";
  import "../style.css";
  import { goto, invalidate } from "$app/navigation";
  import urlStore from "@src/lib/url";
  import { get, writable } from "svelte/store";

  $: loaded = false

  urlStore.subscribe(u => {
    if (!u) return
    if (!canAuthenticate() && 
      !(u.pathname.startsWith("/login") || u.pathname.startsWith("/register")))
      goto("/login")
    else if (u.pathname == "/")
      goto("/app")
  })
  onMount(async () => {
    window.onunhandledrejection = async(e) => {
		  console.log('we got exception, but the app has crashed', e);
      e.preventDefault()
		}

    await db.init()

    if (canAuthenticate()) {
      await auth.login(localStorage.getItem("key")!)
    } else if (!window.location.pathname.startsWith("/login") && !window.location.pathname.startsWith("/register")) {
      await goto("/login", {invalidateAll: true})
    }

    loaded = true
  })
</script>

<div
  class="h-screen w-full bg-dotted from-base-300 to-base-100 flex flex-col items-center justify-center"
  style="background-size: 5px 5px;"
>
  {#if loaded}
    <slot />
  {:else}
    Loading
  {/if}
</div>
