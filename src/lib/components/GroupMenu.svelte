<script lang="ts">
  import { screenStore, groupsStore } from "$lib/stores";
  import { Icon } from "@steeze-ui/svelte-icon";
  import { UserGroup, PlusCircle } from "@steeze-ui/heroicons";
  import { onMount } from "svelte";
  import type { Group } from "../mls/group";
  import dummyGroups from "../mock/groups";

  let groups: { [id: string]: Partial<Group> } = dummyGroups;
  let selectedMenu: string;
  $: groups;
  $: selectedMenu =
    selectedMenu ||
    (Object.entries(groups)[0][1] || {}).groupId?.reduce((word, curr)=>word + String.fromCharCode(curr), "") ||
    ":new:";
  $: screenStore.selectedGroupMenu.set(selectedMenu);
  onMount(() => {
    groupsStore.set(dummyGroups);
    groupsStore.subscribe((v) => (groups = v));
  });
</script>

<div class="w-full h-full flex flex-col prose">
  <h4
    class="flex m-0 mb-1 mx-2 h-14 items-center px-2 border-b-base-100 border-b-2"
  >
    <strong>Group Messages</strong>
  </h4>
  <button
    class={`text-sm !rounded-md my-1 h-8 mx-2 px-2 gap-x-2 transition-colors duration-200 flex flex-row items-center active:bg-base-content/20 no-underline ${
      !selectedMenu || selectedMenu === ":new:"
        ? "active bg-base-100"
        : "hover:bg-base-100 bg-base-200"
    }`}
    on:click|preventDefault={() => {
      selectedMenu = ":new:";
    }}
  >
    <Icon src={PlusCircle} theme="solid" class="color-gray-900 w-5 h-5" />
    <p class="">New Group</p>
  </button>
  {#each Object.entries(groups) as [id, group]}
    <button
      {id}
      on:click|preventDefault={() => {
        selectedMenu = id;
        screenStore.selectedGroup.set(group)
        screenStore.selectedGroupMenu.set(group.groupId.reduce((word, curr)=>word + String.fromCharCode(curr), ""))
        console.log(group);
      }}
      data-group-id={id}
      class={`min-w-0 !rounded-md my-1 py-6 h-10 mx-2 px-2 gap-x-2 transition-colors duration-200 flex flex-row items-center active:bg-base-content/20 no-underline  ${
        id == selectedMenu
          ? "active bg-base-100"
          : "hover:bg-base-100 bg-base-300"
      }`}
    >
      <div class="w-8 mask mask-squircle">
        <Icon src={UserGroup} theme="solid" class="color-gray-900" />
      </div>
      <div class="truncate w-full text-md font-normal pb-0.5 text-left ml-2">
        { group.groupId?.reduce((word, curr)=>word + String.fromCharCode(curr), "") }
      </div>
    </button>
  {/each}
</div>
