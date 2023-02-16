<script>
  import auth from "@src/lib/auth";
</script>

{#if localStorage.getItem("currentUser")}
  <script>
    import auth from "@src/lib/auth";
  </script>

  <div class="prose p-8 rounded-2xl bg-base-300/60 backdrop-blur">
    <h1>Protected Route Example</h1>
    <p>with +layout.svelte</p>
    <button
      class="btn btn-accent"
      on:click|stopPropagation={() => {
        auth.logout();
      }}>LOGOUT</button
    >
  </div>
{/if}
