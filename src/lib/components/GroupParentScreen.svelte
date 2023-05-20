<script lang="ts">
  import { onMount } from "svelte";
  import { groupsStore, screenStore } from "../stores";
  import NewGroup from "./NewGroup.svelte";
  import GroupScreen from "./GroupScreen.svelte";
  import type { Group } from "../mls/group";
  import dummyGroups from "../mock/groups";

  let selectedMenu: string | undefined;
  let groups: { [id: string]: Partial<Group> } = dummyGroups;
  let group: Partial<Group> | undefined;
  $: selectedMenu;

  onMount(async () => {
    screenStore.selectedGroupMenu.subscribe((v) => (selectedMenu = v));
    screenStore.selectedGroup.subscribe((v) => (group = v));
    groupsStore.subscribe((v) => (groups = v));
  });
</script>

<div class="w-full h-full">
  {#if selectedMenu === ":new:" && !group}
    <NewGroup />
  {:else}
    <GroupScreen {group} />
  {/if}
</div>
