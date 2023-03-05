<script lang="ts">
  import auth from "@src/lib/auth";
  import { onMount } from "svelte";
  import "../style.css";
  onMount(() => {
    window.onunhandledrejection = async(e) => {
			// if (""+e.reason === "Error: Not authenticated") {
      //   e.preventDefault()
      //   await auth.logout()
      //   location.hash = ""
      //   location.assign("/login")
      //   return
      // }
		  console.log('we got exception, but the app has crashed', e);
		}
  })
</script>

<div
  class="h-screen w-full bg-dotted from-base-300 to-base-100 flex flex-col items-center justify-center"
  style="background-size: 5px 5px;"
>
  <slot />
</div>
