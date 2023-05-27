<script lang="ts">
  import { onMount } from "svelte";
  import { groupsStore, screenStore } from "../stores";
  import NewGroup from "./NewGroup.svelte";
  import GroupScreen from "./GroupScreen.svelte";
  import dummyGroups from "../mock/groups";
  import GroupUpdate from "./GroupUpdate.svelte";

  let selectedMenu: string = ":uodate:"
  let groups: { [id: string]: any } = dummyGroups;
  let group: any | undefined;
  $: selectedMenu

  onMount(async () => {
    screenStore.selectedGroupMenu.subscribe((v) => (selectedMenu = v));
    screenStore.selectedGroup.subscribe((v) => (group = v));
    groupsStore.subscribe((v) => (groups = v));
  });
</script>

<div class="w-full h-full">
  {#if selectedMenu === ":new:"}
    <NewGroup />
  {:else if selectedMenu === ":update:"}
    <GroupUpdate />
  {:else}
    <GroupScreen {group} />
  {/if}
</div>
