<script lang="ts">
  import { screenStore, friendsStore } from "$lib/stores"
  import { Icon } from "@steeze-ui/svelte-icon";
  import { User, UserPlus } from "@steeze-ui/heroicons";
  import { onMount } from "svelte";
  
  let friends: {[pub: string]: FriendProfile}
  $: friends = {}
  onMount(() => {   
    friendsStore.subscribe(v => {
      friends = v
    })
  })
  let selectedMenu: string
  $: selectedMenu = selectedMenu || (friends[0]||{}).pub || ":addFriend:";
  $: screenStore.selectedChatMenu.set(selectedMenu)
</script>

<div class="w-full h-full flex flex-col prose">
  <h4
    class="flex m-0 mb-1 mx-2 h-14 items-center px-2 border-b-base-100 border-b-2"
  >
    <strong>Direct Messages</strong>
  </h4>
  <button
    class={`text-sm !rounded-md my-1 h-8 mx-2 px-2 gap-x-2 transition-colors duration-200 flex flex-row items-center active:bg-base-content/20 no-underline ${
      !selectedMenu || selectedMenu === ":addFriend:"
        ? "active bg-base-100"
        : "hover:bg-base-100 bg-base-200"
    }`}
    on:click|preventDefault={() => {
      selectedMenu = ":addFriend:"
    }}
  >
    <Icon src={UserPlus} theme="solid" class="color-gray-900 w-5 h-5" />
    <p class="">Add Friend</p>
  </button>
  {#each Object.entries(friends) as [pubKey, friend], i}
    <button
      id={pubKey}
      on:click|preventDefault={() => {
        selectedMenu = pubKey;
      }}
      data-friend-id={pubKey}
      class={`min-w-0 !rounded-md my-1 py-6 h-10 mx-2 px-2 gap-x-2 transition-colors duration-200 flex flex-row items-center active:bg-base-content/20 no-underline  ${
        pubKey == selectedMenu
          ? "active bg-base-100"
          : "hover:bg-base-100 bg-base-300"
      }`}
    >
      <div class="avatar online">
        <div class="w-8 mask mask-squircle">
          {#if friend.picture}
             <img class="m-0" src={friend.picture} alt="" />
          {:else}
            <Icon src={User} theme="solid" class="color-gray-900" />
          {/if}
        </div>
      </div>
      <div class="truncate w-full text-md font-normal pb-0.5 text-left ml-2">
        {friend.username||friend.pub}
      </div>
    </button>
  {/each}
</div>