<script lang="ts" type="module">
  import { goto } from "$app/navigation";
  import auth from "@lib/auth";

  let loggedIn = !!localStorage.getItem("loggedIn");
  loggedIn && goto("/home");

  let pair: string;
</script>

{#if !loggedIn}
  <div class="card w-96 bg-base-300 shadow-xl backdrop-blur">
    <div class="card-body prose prose-sm sm:prose-base gap-y-3">
      <h1>Login</h1>
      <input
        bind:value={pair}
        type="text"
        placeholder="Private key"
        class="input w-full max-w-xs"
      />
      <button
        class="btn btn-accent"
        on:click={() => {
          auth.login(pair);
          goto("/home");
        }}>Login</button
      >
      <p class="place-self-end">
        Don't have account? <a
          data-sveltekit-preload-code="hover"
          href="/register">Register</a
        >
      </p>
    </div>
  </div>
{/if}
