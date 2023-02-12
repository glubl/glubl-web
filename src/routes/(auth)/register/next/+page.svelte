<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { keypair } from "../stores";

  let loggedIn = !!localStorage.getItem("loggedIn");
  onMount(() => !loggedIn && goto("/login"));

  const filename = "keypair.txt";
  const onDownload = () => {
    const blob = new Blob([$keypair], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = filename;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url); // Object URLs should be revoked after use
  };
</script>

<div class="card w-96 bg-base-300 shadow-xl backdrop-blur">
  <div class="card-body prose prose-sm sm:prose-base gap-y-3">
    <h3>Save this keypair.txt. Do not share it with anyone.</h3>
    <button
      on:click={() => {
        onDownload();
        goto("/home");
      }}>Download</button
    >
  </div>
</div>
