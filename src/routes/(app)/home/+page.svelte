<script>
  import { goto } from "$app/navigation";
  import auth from "@lib/auth";
</script>

{#if localStorage.getItem("currentUser")}
  <div class="prose p-8 rounded-2xl bg-base-300/60 backdrop-blur">
    <h1>Welcome to Glubl!</h1>
    <button
      class="btn btn-accent"
      on:click|stopPropagation={async () => {
        await auth.logout();
        goto("/login")
      }}>LOGOUT</button
    >
    <button
      class="btn btn-accent"
      on:click|stopPropagation={async () => {
        goto("/app")
      }}>APP</button
    >
  </div>
{/if}
