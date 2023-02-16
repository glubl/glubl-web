<script lang="ts">
  import { goto } from "$app/navigation";
  import AuthCard from "../AuthCard.svelte";

  let currentUser = localStorage.getItem("currentUser")
  currentUser && goto("/home");
</script>

{#if !currentUser}
  <AuthCard type="Login" />
{/if}
