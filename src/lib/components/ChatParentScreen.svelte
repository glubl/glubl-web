<script lang="ts">
  import { get } from "svelte/store";
  import { onMount } from "svelte";
  import { friendsStore, screenStore } from "../stores";
  import AddFriend from "./AddFriend.svelte";
  import ChatScreen from "./ChatScreen.svelte";
  
  let selectedMenu: string
  let friends: { [pub: string]: FriendProfile } = {}
  $: friend = friends[selectedMenu]
  onMount(() => {
    screenStore.selectedChatMenu.subscribe(v => selectedMenu = v)
    friendsStore.subscribe(v => friends = v)
  })
</script>

<div class="w-full h-full">
  {#if selectedMenu === ":addFriend:" || !friend}
    <AddFriend />
  {:else}
    <ChatScreen friend={friend} />
  {/if}
</div>

