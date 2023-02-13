<script lang="ts">
  import { goto } from "$app/navigation";
  import auth from "@lib/auth";
  import Downloader from "./Downloader.svelte";

  let loggedIn = !!localStorage.getItem("loggedIn");
  loggedIn && goto("/home");

  let username: string;
  let keypair: string;
  $: keypair;
</script>

<div class="card w-96 bg-base-300 shadow-xl backdrop-blur">
  <div class="card-body prose prose-sm sm:prose-base gap-y-3">
    {#if !keypair}
      <h1>Register</h1>
      <input
        bind:value={username}
        type="text"
        placeholder="Username"
        class="input w-full max-w-xs"
      />
      <button
        class="btn btn-accent"
        on:click={async () => {
          const res = await auth.register(username);
          keypair = res;
        }}>Register</button
      >
      <p class="place-self-end">
        Have an account? <a data-sveltekit-preload-code="hover" href="/login"
          >Login</a
        >
      </p>
    {:else}
      <Downloader data={{ keypair }} />
    {/if}
  </div>
</div>
