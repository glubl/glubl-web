<script lang="ts">
  import { onMount } from "svelte";
  import { groupStore, screenStore } from "../stores";
  import NewGroup from "./NewGroup.svelte";
  import GroupScreen from "./GroupScreen.svelte";
  import dummyGroups from "../mock/groups";
  import GroupUpdate from "./GroupUpdate.svelte";
  import type { GroupNode } from "../circle-channel";

  let selectedMenu: string = ":uodate:"
  let groups: { [id: string]: any } = dummyGroups;
  let group: GroupNode | undefined;
  $: selectedMenu

  onMount(async () => {
    screenStore.selectedGroupMenu.subscribe((v) => (selectedMenu = v));
    screenStore.selectedGroup.subscribe((v) => (group = v));
    groupStore.subscribe((v) => (groups = v));
  });
</script>

<div class="w-full h-full">
  {#if group}
    <GroupScreen {group} />
  {:else}
     <NewGroup />
  {/if}
</div>
