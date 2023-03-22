<script lang="ts">
  import { Icon } from "@steeze-ui/svelte-icon";
  import { User } from "@steeze-ui/heroicons";
  import {
    screenStore,
    callExpanded,
    localStream,
    remoteStreamMap,
  } from "../stores";

  export let profile: FriendProfile;
  export let myProfile: FriendProfile | null = null;
  let expanded: boolean;
  let selectedMenu: string;
  screenStore.selectedChatMenu.subscribe((v) => (selectedMenu = v));
  callExpanded.subscribe((v) => (expanded = v));
  $: callExpanded.set(selectedMenu === ":calls:");
  $: stream = !!myProfile ? $localStream : $remoteStreamMap[profile.pub];
  $: console.log(!!myProfile, stream);
</script>

<div class="rounded-md flex flex-col items-center justify-center bg-base-200">
  <div class="flex flex-row justify-center items-center h-36 w-48">
    <video id="userVideo-{profile.pub}" hidden={!stream} autoplay playsinline>
      <track kind="captions" />
    </video>
    <audio id="userAudio-{profile.pub}" hidden={!stream} autoplay playsinline />
    {#if !stream}
      {#if profile.picture.length !== 0}
        <img
          class="{expanded
            ? 'md:w-28 w-14'
            : 'w-14'} object-cover mask mask-circle"
          src={profile.picture}
          alt="{profile.username} profile picture"
        />
      {:else}
        <div
          class="{expanded
            ? 'md:w-28 w-14'
            : 'w-14'} mask mask-circle bg-base-100"
        >
          <Icon src={User} alt="{profile.username} no profile picture" />
        </div>
      {/if}
    {/if}
  </div>
  <strong class="prose relative bottom-2">{profile.username}</strong>
</div>
