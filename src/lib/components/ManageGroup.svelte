<script lang="ts">
  import { Icon } from "@steeze-ui/svelte-icon";
  import { 
    PencilSquare, 
    XMark, 
    User, 
    Plus 
  } from "@steeze-ui/heroicons"
  import { onDestroy, onMount } from "svelte";
  import { friendsStore, groupMembersStore } from "@src/lib/stores";
  import type { Unsubscriber } from "svelte/store";
  import ProfileMenuItem from "./ProfileMenuItem.svelte";

  type Option = FriendProfile & {
    checked: boolean
    action: "add" | "remove" | undefined
  }
  export let group: any
  let members: {[pub: string]: Option}
  let friends: {[pub: string]: Option}
  // isRemoving: removing members, not isRemoving: adding members
  let isRemoving: boolean = true
  let isManaging: boolean
  let groupName: string
  let counter: number
  let unsubfriends: Unsubscriber;
  let unsubmembers: Unsubscriber;
  function resetSelection() {
    let newMembers = Object.entries(members).map(([pub, profile])=>{
      profile.action = undefined
      profile.checked = false
      return [pub, profile]
    })
    let newFriends = Object.entries(friends).map(([pub, profile])=>{
      profile.action = undefined
      profile.checked = false
      return [pub, profile]
    })
    members = Object.fromEntries(newMembers)
    friends = Object.fromEntries(newFriends)
  }
  function toggleRemoving() {
    isRemoving = !isRemoving
  }
  function zeroChanges(m: {[pub: string]: Option}, f: {[pub: string]: Option}) {
    let count: number = 0
    count += Object.entries(m)
      .reduce((count, curr) => (curr[1].checked ? count + 1: count), 0)
    count += Object.entries(f)
      .reduce((count, curr) => (curr[1].checked ? count + 1: count), 0)
    return count === 0
  }
  function onSubmit() {
    let selectedMember = Object.entries(members)
      .filter((v: [string, Option]) => v[1].checked)
      .map(v => { v[1].action = "remove"; return [v[0], v[1]] })
    let selectedFriend = Object.entries(friends)
      .filter((v: [string, Option]) => v[1].checked)
      .map(v => { v[1].action = "add"; return [v[0], v[1]] })
    let selected = {}
    Object.assign(selected, Object.fromEntries(selectedFriend), Object.fromEntries(selectedMember))
    console.log("selected:",selected)
  }
  $: members = {}
  $: friends = {}
  $: groupName = group?.groupId?.reduce((word, curr)=>word + String.fromCharCode(curr), "")
  onMount(() => {
    unsubmembers = friendsStore.subscribe((v)=>{
      Object.entries(v).map((v: [string, FriendProfile]) => {
        let newV: Option = {...v[1], checked: false, action: undefined}
        members[v[0]] = newV
      })
      members = members
    })
    unsubfriends = friendsStore.subscribe((v)=>{
      Object.entries(v).map((v: [string, FriendProfile]) => {
        let newV: Option = {...v[1], checked: false, action: undefined}
        friends[v[0]] = newV
      })
      friends = friends
    })
  })

  onDestroy(()=> {
    unsubfriends()
    unsubmembers()
  })
</script>

<div id="group-info" class="flex flex-col items-stretch p-4 space-y-4">
  <div class="flex w-full items-center">
    <h4 class="strong py-2 flex-1">{isRemoving ? "Members" : `Add friend to ${groupName}`}</h4>
    {#if isManaging}
      <div class="flex flex-row space-x-2">
        <button class="btn btn-accent flex-1 {isRemoving ? '' : 'btn-outline'}" on:click={toggleRemoving}>Remove member</button>
        <button class="btn btn-accent flex-1 {isRemoving ? 'btn-outline' : ''}" on:click={toggleRemoving}>Add member</button>
      </div>
    {:else}
      <button id="manage-group-btn" class="btn btn-accent flex-none prose {isManaging ? '' : 'btn-outline'}" on:click={()=> isManaging = !isManaging}>
        <Icon src={PencilSquare} theme="solid" class="w-6 h-6"/>MANAGE
      </button>
    {/if}
  </div>
    <div id="group-members" class="space-y-2">
      {#each isRemoving ? Object.entries(members) : Object.entries(friends) as [pub, profile]}
      <label class="flex flex-col label cursor-pointer items-stretch">
        <div class="flex flex-row space-x-2 h-fit items-center">
          <div class="flex flex-row"><ProfileMenuItem {profile}></ProfileMenuItem></div>
          <code class="label-text truncate text-sm py-1 px-2 rounded-lg bg-base-300" 
            contenteditable="true" 
          >{pub}</code>
          <div class="flex-1 shrink"></div>
          {#if isManaging}
            {#if isRemoving}
              <input
                type="checkbox"
                class="checkbox checkbox-primary {members[pub].checked ? 'checked' : 'false'}"
                value={members[pub]}
                bind:checked={members[pub].checked}
              />
              {:else}
              <input
                type="checkbox"
                class="checkbox checkbox-primary {friends[pub].checked ? 'checked' : 'false'}"
                value={friends[pub] }
                bind:checked={friends[pub].checked}
              />
            {/if}
          {/if}
        </div>
      </label>
    {/each}
    </div>
  {#if isManaging }
  <div class="flex flex-row">
    <button class="btn btn-error flex-1 h-6" on:click={() => {
      isManaging = false; resetSelection()
      }}>CANCEL</button>
    {#key counter}
      <button class="btn btn-accent flex-1 h-6" disabled={zeroChanges(members, friends)} on:click={onSubmit}>SAVE</button>
    {/key}
  </div>
  {/if}
</div>
