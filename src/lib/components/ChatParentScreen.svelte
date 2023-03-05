<script lang="ts">
  import { chatStore } from "../stores";
  import AddFriend from "./AddFriend.svelte";
  import ChatScreen from "./ChatScreen.svelte";

  let selectedAddFriend = true
  chatStore.selectedAddFriend.subscribe(v => selectedAddFriend = v)
  let screen: typeof AddFriend | typeof ChatScreen
  $: console.log("sel", selectedAddFriend)
  $: screen = selectedAddFriend ? AddFriend : ChatScreen
</script>

<div class="w-full h-full">
  <svelte:component this={screen} />
</div>

