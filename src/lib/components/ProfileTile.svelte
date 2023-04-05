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
  let videoElement: HTMLMediaElement | null;
  let audioElement: HTMLMediaElement | null;

  screenStore.selectedChatMenu.subscribe((v) => (selectedMenu = v));
  callExpanded.subscribe((v) => (expanded = v));
  $: callExpanded.set(selectedMenu === ":calls:");
  $: stream = !!myProfile ? $localStream : $remoteStreamMap[profile.pub];
  $: if (videoElement)
    videoElement.hidden = !stream || stream?.getVideoTracks().length === 0;
  $: if (audioElement)
    audioElement.hidden = !stream || stream?.getAudioTracks().length === 0;
</script>

<div class="rounded-md flex flex-col items-center justify-center bg-base-200">
  <div class="flex flex-row justify-center items-center h-36 w-48">
    <video
      id="userVideo-{profile.pub}"
      autoplay
      playsinline
      bind:this={videoElement}
    >
      <track kind="captions" />
    </video>
    <audio
      id="userAudio-{profile.pub}"
      autoplay
      playsinline
      bind:this={audioElement}
    />
    {#key videoElement && videoElement.hidden}
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
    {/key}
  </div>
  <strong class="prose relative bottom-2">{profile.username}</strong>
</div>
