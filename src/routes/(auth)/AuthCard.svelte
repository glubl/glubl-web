<script lang="ts">
  import { goto } from "$app/navigation";
  import auth from "@lib/auth";
  import Downloader from "./register/Downloader.svelte";

  export let type: string = "Login" || "Register";
  let inputValue: string;
  let keypair: string;
  let errorMsg: string;
  $: keypair, errorMsg;

  let onLogin = () => {
    auth.login(inputValue).then(
      () => goto("/home"),
      (err) => (errorMsg = "Wrong user"),
    );
  };
  let onRegister = () => {
    auth.register(inputValue).then(
      (res) => (keypair = res),
      (err) => (errorMsg = err.message),
    );
  };
</script>

<div class="card w-96 bg-base-300 shadow-xl backdrop-blur">
  <div class="card-body prose prose-sm sm:prose-base gap-y-3">
    {#if !keypair}
      <h1>{type}</h1>
      <input
        required
        bind:value={inputValue}
        type="text"
        placeholder={type === "Login" ? "Keypair string" : "Username"}
        class={`input w-full max-w-xs ${errorMsg && "input-error"}`}
        on:focus={() => {
          if (inputValue && errorMsg) {
            inputValue = "";
            errorMsg = "";
          }
        }}
        on:keydown={(key) => {
          if (key.code === "Enter" && !errorMsg) {
            type === "Login" ? onLogin() : onRegister();
          }
        }}
      />
      {#if errorMsg}
        <span class="">{errorMsg}</span>
      {/if}
      <button
        class="btn btn-accent"
        on:click={type === "Login" ? onLogin : onRegister}>{type}</button
      >
      {#if type === "Login"}
        <p class="place-self-end">
          Don't have account? <a
            data-sveltekit-preload-code="hover"
            href="/register">Register</a
          >
        </p>
      {:else if type === "Register"}
        <p class="place-self-end">
          Have an account? <a data-sveltekit-preload-code="hover" href="/login"
            >Login</a
          >
        </p>
      {/if}
    {:else}
      <Downloader data={{ keypair }} />
    {/if}
  </div>
</div>
