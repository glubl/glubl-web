<script lang="ts">
  import { screenStore, friendsStore, callExpanded, friendChannelStore } from "$lib/stores";
  import { Icon } from "@steeze-ui/svelte-icon";
  import { User, UserPlus, Phone } from "@steeze-ui/heroicons";
  import { onDestroy, onMount } from "svelte";
  import ProfileMenuItem from "./ProfileMenuItem.svelte";

  let friends = $friendsStore
  let friendChannels = $friendChannelStore
  let friendUnreads: {[pub: string]: { n: number, fn: (n: number) => void }} = {}
  let friendLastRead: {[pub: string]: { l: string, fn: (c: { lastRead: string }) => void }} = {}
  let fsUnsub = friendsStore.subscribe((v) => {
      friends = v;
    });
  let fcsUnsub = friendChannelStore.subscribe((v) => {
    friendChannels = v;
  })
  $: {
    for (const [k,v] of Object.entries(friendChannels)) {
      if (!(k in friendUnreads)) {
        v.on('num-reads', (friendUnreads[k] = {n:0, fn:(n:number) => {
          friendUnreads[k].n = n
        }} as any).fn)
      }
      if (!(k in friendLastRead)) {
        v.on('config', (friendLastRead[k] = {l: '', fn: (c: { lastRead?: string }) => {
          friendLastRead[k].l = c.lastRead || ''
          friendChannels = friendChannels
        }}).fn)
      }
    }
  }
  onDestroy(() => {
    fsUnsub()
    fcsUnsub()
  })
  function setLastRead(config: { config: string }) {
    friendChannels
  }
  let selectedMenu: string;
  $: selectedMenu = selectedMenu || (friends[0] || {}).pub || ":addFriend:";
  $: screenStore.selectedChatMenu.set(selectedMenu);
  $: callExpanded.set(selectedMenu === ":calls:");
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
      selectedMenu = ":addFriend:";
    }}
  >
    <Icon src={UserPlus} theme="solid" class="color-gray-900 w-5 h-5" />
    <p class="">Add Friend</p>
  </button>
  <!-- <button
    class={`text-sm !rounded-md my-1 h-8 mx-2 px-2 gap-x-2 transition-colors duration-200 flex flex-row items-center active:bg-base-content/20 no-underline ${
      selectedMenu === ":calls:"
        ? "active bg-base-100"
        : "hover:bg-base-100 bg-base-200"
    }`}
    on:click|preventDefault={() => {
      selectedMenu = ":calls:";
    }}
  >
    <Icon src={Phone} theme="solid" class="color-gray-900 w-5 h-5" />
    <p class="">Calls</p>
  </button> -->
  {#each Object.entries(friendLastRead).sort(([_,o1],[__,o2]) => (o1.l < o2.l) ? -1 : 1) as [pub]}
    <button
      id={pub}
      on:click|preventDefault={() => {
        selectedMenu = pub;
      }}
      data-friend-id={pub}
      class={`min-w-0 !rounded-md my-1 py-6 h-10 mx-2 px-2 gap-x-2 transition-colors duration-200 flex flex-row items-center active:bg-base-content/20 no-underline  ${
        pub == selectedMenu
          ? "active bg-base-100"
          : "hover:bg-base-100 bg-base-300"
      }`}
    >
      <ProfileMenuItem profile={friends[pub]}></ProfileMenuItem>
      <p class={`h-4 py-2.5 px-1.5 text-xs font-mono bg-accent text-accent-content rounded-full justify-self-end flex justify-center items-center ${ (friendUnreads[pub].n <= 0) && 'hidden' }`}>
        {friendUnreads[pub].n}
      </p>
    </button>
  {/each}
</div>
