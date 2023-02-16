<script lang="ts">
  import { goto } from "$app/navigation";

  export let data: any;

  const filename = "keypair.txt";
  const onDownload = () => {
    const blob = new Blob([data.keypair], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = filename;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url); // Object URLs should be revoked after use
  };
</script>

<h3>Save this keypair.txt. Do not share it with anyone.</h3>
<button
  on:click={() => {
    onDownload();
    goto("/home");
  }}>Download</button
>
