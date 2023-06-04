<script lang="ts">
  import auth from "@src/lib/auth";
  import { friendsStore } from "@src/lib/stores";
  import NavButton from "@src/lib/components/NavButton.svelte";
  import { get } from "svelte/store";
  import { Icon } from "@steeze-ui/svelte-icon";
  import { User } from "@steeze-ui/heroicons";
  import { onDestroy } from "svelte";
  import { createGroup } from "../groups";

  type Option = FriendProfile & {
    checked: boolean;
  };
  function friendsToOption(f: { [pub: string]: FriendProfile }) {
    return Object.fromEntries(
      Object.entries(get(friendsStore))
        .map(([k, v]) => [k, {...v, checked: false}])
    )
  }
  let selectedFriends: { [pub: string]: Option } = friendsToOption(get(friendsStore))
  let selFUnsub = friendsStore.subscribe(v => selectedFriends = friendsToOption(v))

  let groupname: string = "";
  let errorMsg: string = "";
  let filter: string = ""

  async function onSubmit() {
    if (!groupname) {
      errorMsg = "Group name cannot be empty.";
      return
    }
    try {
      await createGroup(groupname, Object.values(selectedFriends).filter(v => v.checked).map<Profile>(v => {delete (v as any).checked; return v}))
    } catch (error) {
      errorMsg = ''+error
      return
    }
    Object.values(selectedFriends).filter((v) => v.checked = false);
    selectedFriends = selectedFriends
    groupname = ""
    errorMsg = ""
    filter = ""
  }
  $: errorMsg;
  $: groupname;
  $: selectedFriends;
  $: filter

  onDestroy(() => {
    selFUnsub()
  })
  
</script>

<div id="new-group" class="flex flex-col items-stretch h-screen flex-1 w-full relative">
  <div
    id="header"
    class="prose flex flex-row items-center h-14 w-[inherit] max-w-[inherit] py-4 px-2 backdrop-blur shadow-lg bg-base-200/90"
  >
    <NavButton />
    <h4 class="m-0 ml-2 prose"><strong>Create Group</strong></h4>
    <div class="w-2" />
  </div>
  <div class="screen-content p-6 flex flex-col flex-1">
    <div class="flex flex-row p-2 btn-group ">
      <input
        type="text"
        placeholder="Group Name"
        class="flex-1 input input-bordered"
        bind:value={groupname}
      />
    </div>
    <div class="divider my-0 mx-2 mt-4">Group Members</div>
    <div class="flex flex-row btn-group ">
      <input
        type="text"
        placeholder="Filter friend..."
        class="flex-1 input h-10 !outline-none border-transparent focus:border-transparent focus:ring-0"
        bind:value={filter}
      />
    </div>
    <div id="viewport" class="h-full overflow-y-auto flex flex-col pb-2">
      <div id="contents" class="flex h-fit w-full flex-col">
        <div class="flex flex-col px-2 items-stretch">
          {#each Object.values(selectedFriends).filter(v => v.checked) as fren (fren.pub)}
            <button
              id={fren.pub}
              on:click|preventDefault={() => {
                fren.checked = false
              }}
              class={`min-w-0 !rounded-md my-1 px-4 py-2 gap-x-1 transition-colors duration-200 flex flex-row items-center active:bg-base-content/20 no-underline  ${
                fren.checked
                  ? "bg-accent"
                  : "active:bg-accent-focus hover:bg-accent/50"
              }`}
            >
              <div class="avatar">
                <div class="w-6 mask mask-squircle">
                  {#if fren.picture}
                    <img class="m-0" src={fren.picture} alt="" />
                  {:else}
                    <Icon src={User} theme="solid" class="text-secondary-content" />
                  {/if}
                </div>
              </div>
              <div class="truncate w-full text-secondary-content text-sm font-normal pb-0.5 text-left ml-2">
                {fren.username || fren.pub}
              </div>
            </button>
          {/each}
        </div>
        
        <div class="flex flex-col px-2 items-stretch">
          {#each Object.values(selectedFriends).filter(v => !v.checked).filter(v => v.username.startsWith(filter)) as fren (fren.pub)}
            <button
              id={fren.pub}
              on:click|preventDefault={() => {
                fren.checked = true
              }}
              class={`min-w-0 !rounded-md my-1 px-4 py-2 gap-x-1 transition-colors duration-200 flex flex-row items-center active:bg-base-content/20 no-underline  ${
                fren.checked
                  ? "bg-accent"
                  : "active:bg-accent-focus hover:bg-accent/50"
              }`}
            >
              <div class="avatar">
                <div class="w-6 mask mask-squircle">
                  {#if fren.picture}
                    <img class="m-0" src={fren.picture} alt="" />
                  {:else}
                    <Icon src={User} theme="solid" class="text-secondary-content" />
                  {/if}
                </div>
              </div>
              <div class="truncate w-full text-secondary-content text-sm font-normal pb-0.5 text-left ml-2">
                {fren.username || fren.pub}
              </div>
            </button>
          {/each}
        </div>
      </div>
    </div>
    <!-- <form on:submit|preventDefault={onSubmit} class="flex flex-col w-full">
      <div class="form-control flex flex-col w-full max-w-sm">
        <-- svelte-ignore a11y-label-has-associated-control --
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
        <-- svelte-ignore a11y-label-has-associated-control --
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
      
    </form> -->
    <div>
      {#if errorMsg}
      <p class="text-error">
        { errorMsg }
      </p>
      {/if}
      <button
        class="btn btn-primary  w-full mt-2 { (!groupname || (Object.values(selectedFriends).filter(v => v.checked).length == 0)) ? 'btn-disabled' : ''}"
        type="submit"
        on:click={onSubmit}>Create</button
      >
    </div>
  </div>
</div>
