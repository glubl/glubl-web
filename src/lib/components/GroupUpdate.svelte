<script lang="ts">
  import { dummyGroupUpdate } from "../mock/groups"
  import { UserPlus, Key, Check } from "@steeze-ui/heroicons"
  import { Icon } from "@steeze-ui/svelte-icon"
  import NavButton from "./NavButton.svelte"

  let updates = dummyGroupUpdate
  $: updates
</script>

<div class="flex flex-col space-y-2" id="group-update">
  <div
    id="header"
    class="prose flex flex-row items-center h-14 w-[inherit] max-w-[inherit] py-4 px-2 backdrop-blur shadow-lg bg-base-200/90"
  >
    <NavButton />
    <h4 class="m-0 ml-2 prose"><strong>Group updates</strong></h4>
    <div class="w-2" />
  </div>
  <div class="content p-4 space-y-2">
    {#each updates as update}
        <div class="flex flex-row items-center">
            <Icon class="mr-2 w-6 h-6" src={update.action === "add" ? UserPlus : Key}/>
            <span class="mr-2">{update.action === "add" ? "Invite" : "Group update"}</span>
            <span>from {update.groupName}</span>
            <span class="flex-1"></span>
            <button class="btn btn-accent btn-circle btn-outline"><Icon class="w-6 h-6" src={Check}/></button>
        </div>
    {/each}
  </div>
</div>
