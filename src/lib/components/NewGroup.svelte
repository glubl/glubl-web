<script lang="ts">
  import auth from "@src/lib/auth";
  import { onMount } from "svelte";
  import { friendsStore } from "@src/lib/stores";
  import { getGun } from "@src/lib/db";
  import NavButton from "@src/lib/components/NavButton.svelte";
  import type { KeyPackage } from "@src/lib/mls/keypackage";

  type Option = FriendProfile & {
    checked: boolean;
  };
  let selectedFriends: { [pub: string]: Option } = {};
  let groupname: string;
  let errorMsg: string = "";
  let myKeyPackage: KeyPackage;

  function getKeyPackage() {
    auth.getProfile().then((res) => (myKeyPackage = res["keyPackage"]));
  }
  function onSubmit() {
    if (!groupname && Object.entries(selectedFriends).length === 0) {
      errorMsg = "Group name cannot be empty.";
    }
    console.log(Object.values(selectedFriends).filter((v) => v.checked));
  }
  $: errorMsg;
  $: groupname;
  $: selectedFriends;
  onMount(async () => {
    friendsStore.subscribe((v) => {
      for (const [key, value] of Object.entries(v)) {
        selectedFriends[key] = { ...value, checked: false };
      }
    });
    getKeyPackage();
  });
</script>

<div id="new-group" class="flex flex-col items-stretch">
  <div
    id="header"
    class="prose flex flex-row items-center h-14 w-[inherit] max-w-[inherit] py-4 px-2 backdrop-blur shadow-lg bg-base-200/90"
  >
    <NavButton />
    <h4 class="m-0 ml-2 prose"><strong>Create Group</strong></h4>
    <div class="w-2" />
  </div>
  <div class="screen-content p-4">
    <form on:submit|preventDefault={onSubmit} class="flex flex-col w-full">
      <div class="form-control flex flex-col w-full max-w-sm">
        <!-- svelte-ignore a11y-label-has-associated-control -->
        <label class="label">
          <span class="label-text prose">Group name:</span>
        </label>
        <input
          bind:value={groupname}
          type="text"
          placeholder="Enter group name"
          class="input input-bordered w-full max-w-sm {errorMsg &&
            'input-error'}"
          on:focus={() => (errorMsg = "")}
        />
        <!-- svelte-ignore a11y-label-has-associated-control -->
        <label class="label">
          <span
            class="label-text text-error"
            contenteditable="true"
            bind:innerText={errorMsg}
          />
        </label>
      </div>
      <div class="form-control w-full mb-2">
        <div class="label label-text">Select Members:</div>
        {#each Object.entries(selectedFriends) as [pub, profile]}
          <label class="label cursor-pointer items-center justify-start">
            <input
              type="checkbox"
              class="checkbox checkbox-primary {profile.checked && 'checked'}"
              value={profile}
              bind:checked={profile.checked}
            />
            <span
              class="label-text w-fit px-2"
              contenteditable="true"
              bind:innerHTML={profile.username}
            />
            <code
              class="label-text truncate text-sm py-1 px-2 rounded-lg bg-base-300"
              contenteditable="true"
              bind:innerHTML={pub}
            />
          </label>
        {/each}
      </div>
      <button
        class="btn btn-primary"
        type="submit"
        on:click={() => {
          auth.getProfile().then((res) => console.log(res));
        }}>Create</button
      >
    </form>
  </div>
</div>
