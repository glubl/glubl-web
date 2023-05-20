<script lang="ts">
  import type { Group } from "../mls/group"
  import dummyGroups from "../mock/groups"
  import NavButton from "./NavButton.svelte"
  import { screenStore, manageOpen as manageOpenStore} from "../stores"
  import ManageGroup from "./ManageGroup.svelte"
  import { Icon } from "@steeze-ui/svelte-icon"
  import { ChevronDown, ChevronUp } from "@steeze-ui/heroicons"
  import { onMount } from "svelte";

  export let group: Partial<Group> | undefined
  let groupName: string | undefined
  let selectedGroup: Partial<Group> | undefined
  let manageOpen: boolean | undefined
  $: groupName = group?.groupId?.reduce((word, curr)=>word + String.fromCharCode(curr), "")
  $: selectedGroup
  onMount(() => {
    manageOpenStore.subscribe(v => manageOpen = v)
    screenStore.selectedGroup.subscribe(v => selectedGroup = v)
  })
</script>

<div id="group-chat-screen" class="flex flex-col h-screen justify-start flex-1 w-full relative">
  <div
    id="header"
    class="prose flex flex-row items-center top-0 h-14 w-[inherit] max-w-[inherit] py-4 px-2 backdrop-blur shadow-lg bg-base-200/90"
  >
    <NavButton />
    <div class="btn h-full btn-ghost w-fit h-6" on:click={() => manageOpen = false}><h4 class="m-0 strong">{groupName}</h4></div>
    <div class="flex-1" />
    <button class="btn h-full btn-ghost w-fit" on:click={() => manageOpen = !manageOpen}><span class="m-0 strong mr-2">Members</span><Icon size={"14"} src={manageOpen ? ChevronUp : ChevronDown}/></button>
  </div>
  <div id="contents">
    {#if manageOpen}
      <ManageGroup />
      {:else}
      <p class="prose">Empty chat</p>
    {/if}
  </div>
</div>
