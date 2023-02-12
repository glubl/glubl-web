<script lang="ts">
  import { goto } from "$app/navigation";
  import auth from "@lib/auth";
  import { onMount } from "svelte";
  import { keypair } from "./stores";

  let loggedIn = !!localStorage.getItem("loggedIn");
  onMount(() => loggedIn && goto("/home"));

  let username: string;
</script>

<div class="card w-96 bg-base-300 shadow-xl backdrop-blur">
  <div class="card-body prose prose-sm sm:prose-base gap-y-3">
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
        keypair.set(res);
        goto("/register/next");
      }}>Register</button
    >
    <p class="place-self-end">
      Have an account? <a data-sveltekit-preload-code="hover" href="/login"
        >Login</a
      >
    </p>
  </div>
</div>
