<script lang="ts">
  import { groupStore, screenStore } from "../stores"
  import { Icon } from "@steeze-ui/svelte-icon"
  import { Bell, UserGroup, PlusCircle } from "@steeze-ui/heroicons"
  import { onDestroy, onMount } from "svelte"
  import type { GroupNode } from "../circle-channel";
  import { filter } from "lodash";
  import { get } from "svelte/store";
  // import dummyGroups from "../mock/groups"

  let groups = $groupStore
  let selectedMenu: string = get(screenStore.selectedGroupMenu)
  let selectedGroup: GroupNode
  $: selectedGroup = groups[selectedMenu]
  $: screenStore.selectedGroup.set(selectedGroup)
  // onMount(() => {
  //   groupsStore.set(dummyGroups)
  //   groupsStore.subscribe((v) => (groups = v))
  // })
  let groupUnsub = groupStore.subscribe(v => groups = v)
  let groupMenuUnsub = screenStore.selectedGroupMenu.subscribe(v => selectedMenu = v)
  $: {
    Object.values(groups).forEach(g => {
      if (g.state !== 'initializing') return
      g.once('statechange', () => groups = groups)
    })
  }
  onDestroy(() => {
    groupUnsub()
  })
</script>

<div class="w-full h-full flex flex-col prose">
  <h4
    class="flex m-0 mb-1 mx-2 h-14 items-center px-2 border-b-base-100 border-b-2"
  >
    <strong>Group Messages</strong>
  </h4>
  <!-- <button
    class={`text-sm !rounded-md my-1 h-8 mx-2 px-2 gap-x-2 transition-colors duration-200 flex flex-row items-center active:bg-base-content/20 no-underline ${
      !selectedMenu || selectedMenu === ":update:"
        ? "active bg-base-100"
        : "hover:bg-base-100 bg-base-200"
    }`}
    on:click|preventDefault={() => {
      screenStore.selectedGroupMenu.set(":update:")
    }}
  >
    <Icon src={Bell} theme="solid" class="color-gray-900 w-5 h-5" />
    <p class="">Updates</p>
  </button> -->
  <button
    class={`text-sm !rounded-md my-1 h-8 mx-2 px-2 gap-x-2 transition-colors duration-200 flex flex-row items-center active:bg-base-content/20 no-underline ${
      selectedMenu === ":new:"
        ? "active bg-base-100"
        : "hover:bg-base-100 bg-base-200"
    }`}
    on:click|preventDefault={() => {
      screenStore.selectedGroupMenu.set(":new:")
    }}
  >
    <Icon src={PlusCircle} theme="solid" class="color-gray-900 w-5 h-5" />
    <p class="">New Group</p>
  </button>
  {#each Object.entries(groups).filter(([k, g]) => g.state === 'ready') as [id, group] (group.id)}
    <button
      on:click|preventDefault={() => {
        screenStore.selectedGroupMenu.set(group.id||":new:")
      }}
      data-group-id={group.id}
      class={`min-w-0 !rounded-md my-1 py-6 h-10 mx-2 px-2 gap-x-2 transition-colors duration-200 flex flex-row items-center active:bg-base-content/20 no-underline  ${
        group.id == selectedMenu
          ? "active bg-base-100"
          : "hover:bg-base-100 bg-base-300"
      }`}
    >
      <div class="w-8 mask mask-squircle">
        <Icon src={UserGroup} theme="solid" class="color-gray-900" />
      </div>
      <div class="truncate w-full text-md font-normal pb-0.5 text-left ml-2">
        { group.metadata?.name || group.id }
      </div>
    </button>
  {/each}
</div>
