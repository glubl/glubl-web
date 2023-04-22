<script lang="ts">
  import { Icon } from "@steeze-ui/svelte-icon";
  import { User } from "@steeze-ui/heroicons";
  import {
    localStreams,
    myProfileStore
  } from "../stores";
  import { get } from "svelte/store";
  import type { MediaController } from "../call";

  export let profile: FriendProfile;

  let myProfile: FriendProfile | undefined
  $: myProfile = $myProfileStore
  myProfileStore.subscribe((p) => myProfile = p)

  let controller = profile.pub === myProfile?.pub ? get(localStreams.call) : undefined
  let videoMuted: boolean = controller?.isVideoMuted || true
  let audioMuted: boolean = controller?.isAudioMuted || true
  if (controller) controller
    .on("userMedia", (m) => stream = m)
    .on("videoMute", (m) => videoMuted = m)
    .on("audioMute", (m) => audioMuted = m)
  
  let stream = controller?.userMedia

  let videoElement: HTMLMediaElement
  $: if(videoElement && profile.pub === myProfile?.pub) videoElement.srcObject = stream ? stream : null
  // $: if (videoElement)
  //   videoElement.hidden = !stream || stream?.getVideoTracks().length === 0;
  // $: if (audioElement)
  //   audioElement.hidden = !stream || stream?.getAudioTracks().length === 0;
</script>

<div class="rounded-md flex flex-col items-center justify-center bg-base-200">
  <div class="flex flex-row justify-center items-center h-36 w-48">
    <video
      id="userVideo-{profile.pub}"
      autoplay
      playsinline
      bind:this={videoElement}
      hidden={videoMuted}
    >
      <track kind="captions" />
    </video>
   
    <!-- <audio
      id="userAudio-{profile.pub}"
      autoplay
      playsinline
      bind:this={audioElement}
    /> -->
    {#if videoMuted}
      {#if profile.picture.length !== 0}
        <img
          class="w-14 object-cover mask mask-circle"
          src={profile.picture}
          alt="{profile.username} profile picture"
        />
      {:else}
        <div
          class="w-14 mask mask-circle bg-base-100"
        >
          <Icon src={User} alt="{profile.username} no profile picture" />
        </div>
      {/if}
    {/if}
  </div>
  <strong class="prose relative bottom-2">{profile.username}</strong>
</div>
