<script lang="ts">
  import { Icon } from "@steeze-ui/svelte-icon";
  import { User } from "@steeze-ui/heroicons";
  import type { CallPeer, CallStreamKind } from "../call";
  import { onDestroy, onMount } from "svelte";

  export let callPeer: CallPeer
  export let profile: FriendProfile | undefined
  // export let me: boolean


  let videoMuted: boolean = callPeer.isVideoMuted || true
  function setVideoMuted(mute: boolean) {
    videoMuted = mute
  }
  let audioMuted: boolean = callPeer.isAudioMuted || true
  function setAudioMuted(mute: boolean) {
    audioMuted = mute
  }

  let audioStreams: Map<string, MediaStream> = new Map()
  let videoStreams: Map<string, MediaStream> = new Map()
  function addStreams(stream: MediaStream, kind: CallStreamKind) {
    let tracks = stream.getTracks()
    if (kind === "cam" && tracks.length > 0) {
      tracks.forEach(v => {
        if (v.kind === "audio") audioStreams.set(stream.id, stream)
        else videoStreams.set(stream.id, stream)
      })
      audioStreams = audioStreams
      videoStreams = videoStreams
    }
  }
  $: {
    console.log(audioStreams, videoStreams)
  }
  function removeStreams(stream: MediaStream, kind: CallStreamKind) {
    if (kind === "cam") {
      stream.getTracks().forEach(v => {
        if (v.kind === "audio") audioStreams.delete(stream.id)
        else videoStreams.delete(stream.id)
      })
    }
  }
  callPeer.getStreamByKind("cam")
    .forEach(stream => addStreams(stream, "cam"))

  onMount(() => {
    callPeer.on("videoMute", setVideoMuted)
    callPeer.on("audioMute", setAudioMuted)
    callPeer.on("addStream", addStreams)
    callPeer.on("removeStream", removeStreams)
  })

  onDestroy(() => {
    callPeer.off("videoMute", setVideoMuted)
    callPeer.off("audioMute", setAudioMuted)
    callPeer.off("addStream", addStreams)
    callPeer.off("removeStream", removeStreams)
  })
  
  function useMedia(node: HTMLMediaElement, stream: MediaStream) {
    node.srcObject = stream
    return {}
  }

  function onLoadMediaEl(stream: MediaStream) {
    return function ({currentTarget}: Event & {currentTarget: EventTarget & Element}) {
      console.log(currentTarget)
      ;(currentTarget as HTMLMediaElement).srcObject = stream
    }
  }

  let videoElement: HTMLMediaElement
  let audioElement: HTMLMediaElement

</script>

<div class="rounded-md flex flex-col items-center justify-center bg-base-200">
  <div class="flex flex-row justify-center items-center h-36 w-48">
    
    {#each [...audioStreams] as [streamId, stream]}
      <audio
        id="userAudio-{callPeer.callId}-{streamId}"
        autoplay
        playsinline
        bind:this={audioElement}
        muted={audioMuted}
        use:useMedia={stream}
      />
    {/each}
    
    {#if videoMuted}
      {#if profile && profile.picture.length !== 0}
        <img
          class="w-14 object-cover mask mask-circle"
          src={profile?.picture}
          alt="{profile?.username} profile picture"
        />
      {:else}
        <div
          class="w-14 mask mask-circle bg-base-100"
        >
          <Icon src={User} alt="{profile?.username || callPeer.callId} no profile picture" />
        </div>
      {/if}
    {:else}
      {#each [...videoStreams] as [streamId, stream]}
        <video
          id="userVideo-{callPeer.callId}-{streamId}"
          autoplay
          playsinline
          bind:this={videoElement}
          hidden={videoMuted}
          muted
          use:useMedia={stream}
        />
      {/each}
    {/if}
  </div>
  <strong class="prose relative bottom-2">{profile?.username || callPeer.callId}</strong>
</div>
