<script lang="ts">
  import { Icon } from "@steeze-ui/svelte-icon";
  import { User } from "@steeze-ui/heroicons";
  import { screenStore, callExpanded } from "../stores";

  export let profile: FriendProfile;
  export let mediaStream: MediaStream | undefined = undefined;
  let expanded: boolean;
  let selectedMenu: string;
  screenStore.selectedChatMenu.subscribe((v) => (selectedMenu = v));
  callExpanded.subscribe((v) => (expanded = v));
  $: callExpanded.set(selectedMenu === ":calls:");
  $: mediaStream;
</script>

<div class="rounded-md flex flex-col items-center justify-center bg-base-200">
  <div class="flex flex-row justify-center items-center p-2 w-48">
    {#if mediaStream}
      <video id="webcamVideo" autoplay playsinline>
        <track kind="captions" />
      </video>
    {:else if profile.picture.length !== 0}
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
  </div>
  <strong class="prose relative bottom-2">{profile.username}</strong>
</div>
