<script lang="ts" scope="module">
  import { Icon } from "@steeze-ui/svelte-icon";
  import {
    PhoneMissed,
    PhoneCall,
    Mic,
    MicOff,
    Video,
    VideoOff,
  } from "@steeze-ui/feather-icons";
  import {
    myProfileStore,
    localStreams,
    screenStore,
    callExpanded,
  } from "@src/lib/stores";
  import ProfileTile from "./ProfileTile.svelte";
  import NavButton from "./NavButton.svelte";
  import { onDestroy } from "svelte";
  import { get } from "svelte/store";
  import type { CallPeer, CallPeerState } from "../call";
  import { getGun } from "../db";
  import type { GunOptions } from "gun";
  import type { RTCPeer } from "../webrtc";

  export let friend: FriendProfile
  let myProfile = $myProfileStore;


  const { gun, SEA, pair } = getGun()
  let mesh = (gun._.opt as GunOptions).mesh!
  let rtcPeer: RTCPeer | undefined
  function fetchRTCPeer() {
    let rtc: RTCPeer = ((gun._.opt as GunOptions).peers||{})[friend.pub]?.rtc?.rtc
    if (rtc !== rtcPeer)
      rtcPeer = rtc
  }
  fetchRTCPeer()
  let controller = get(localStreams.call)
  const callId = "REE"//[friend.pub, pair.pub].sort().join("")
  let isCameraOn: boolean = !controller.isVideoMuted;
  function setCameraOn(mute: boolean) {
    isCameraOn = !mute
  }
  let isMicOn: boolean = !controller.isAudioMuted;
  function setMicOn(mute: boolean) {
    isMicOn = !mute
  }
  let isOngoing: boolean = controller.isOnGoing
  function stateChange(state: CallPeerState) {
    isOngoing = controller.isOnGoing
  }
  let myPeer: CallPeer | undefined
  $: {
    if (isOngoing) myPeer = controller as CallPeer
    else myPeer = undefined
  }
  let friendPeer: CallPeer | undefined = controller.peers[friend.pub]
  function onAddPeer(peer: CallPeer) {
    if (peer.peerId !== friend.pub) return
    friendPeer = peer
  }
  function onRemovePeer(peer: CallPeer) {
    if (peer.peerId !== friend.pub) return
    friendPeer = undefined
  }

  // let onDataChannelFn = (dc: RTCDataChannel) => {
  //   console.log(!rtcPeer, !myPeer, dc.label !== myPeer?.channelName, rtcPeer?.isDataChannelExists(dc.label))
  //   if (!rtcPeer || !myPeer || dc.label !== myPeer.channelName || rtcPeer.isDataChannelExists(dc.label)) return
  //   controller.addPeer(friend.pub, rtcPeer)
  // }

  // $: {
  //   if (rtcPeer) {
  //     rtcPeer.on("data-channel", onDataChannelFn)
  //   }
  // }

  $: {
    controller.on("statechange", stateChange)
    controller.on("videoMute", setCameraOn)
    controller.on("audioMute", setMicOn)
    controller.on("addPeer", onAddPeer)
    controller.on("removePeer", onRemovePeer)
  }

  onDestroy(() => {
    controller.off("videoMute", setCameraOn)
    controller.off("audioMute", setMicOn)
    controller.off("statechange", stateChange)
    controller.off("addPeer", onAddPeer)
    controller.off("removePeer", onRemovePeer)
  })

  const sendBroadcast = (peerId: string) => {
    let gunPeer = ((gun._.opt as GunOptions).peers||{})[friend.pub]
    if (!gunPeer) {
      console.warn("Peer", friend.pub, "doesn't exists")
      return
    }
    mesh.say({peerId: peerId, dam: callId}, gunPeer)
  }

  function startCall() {
    if (controller.state !== "closed") return
    fetchRTCPeer()
    if (!rtcPeer) {
      console.error("RTC peer don't exists")
      return
    }
    controller.on("broadcastsend", sendBroadcast)
    let stateChange = (sate: CallPeerState, reason?: string) => {
      if (sate !== "closed") return
      controller.off("broadcastsend", sendBroadcast)
      controller.off("statechange", stateChange)
      delete mesh.hear[callId]
    }
    controller.on("statechange", stateChange)
    mesh.hear[callId] = (msg, peer) => {
      let {peerId, dam} = msg
      if (peer.id !== friend.pub) {
        console.warn("unknown broadcast", peer.id)
        return
      }
      if (!peerId || peerId !== friend.pub) {
        console.warn("invalid peerid", peerId, friend.pub)
        return
      }
      if (!rtcPeer) {
        console.warn("no rtcpeer")
        return
      }
      if (peerId in controller.peers) {
        console.warn("peer exists")
        return
      }
      controller.addPeer(peerId, rtcPeer)
      sendBroadcast(pair.pub)
    }
    controller.start(callId, pair.pub)
  }

  function stopCall() {
    if (controller.state === "closed") return
    controller.stop() 
  }

  let fullScreen: boolean;
  let selectedMenu: string;
  let profileShow: number;

  screenStore.selectedChatMenu.subscribe((v) => (selectedMenu = v));
  callExpanded.subscribe((v) => {
    fullScreen = v;
    profileShow = v ? 8 : 4;
  });

  $: callExpanded.set(selectedMenu === ":calls:");
</script>

<div
  class="flex flex-col flex-1 ${fullScreen
    ? ''
    : 'bg-base-300 w-full h-60 py-2'}"
>
  {#if fullScreen}
    <div
      id="header"
      class="flex flex-row items-center h-14 py-4 px-2 backdrop-blur shadow-lg bg-base-200"
    >
      <NavButton />
    </div>
  {/if}

  <!-- Room participants tiles -->
  <div
    class="m-4 {fullScreen
      ? 'place-self-center flex-1 grid md:grid-cols-3 grid-cols-2 md:auto-rows-[200px] auto-rows-[120px] gap-2 overflow-x-hidden overflow-y-auto'
      : 'flex flex-row h-full w-full space-x-2 overflow-x-auto'}"
  >
    <!-- Room participants tiles -->
    {#if myPeer}
       <ProfileTile callPeer={myPeer} profile={myProfile} />
    {/if} 
    {#if friendPeer}
      <ProfileTile callPeer={friendPeer} profile={friend} />
    {/if}
  </div>
  

  <!-- Buttons -->
  <div
    class="flex flex-row space-x-4 justify-center {fullScreen
      ? 'py-4 md:py-8 sticky bottom-0 rounded-t-2xl bg-base-200'
      : 'rounded-2xl'}"
  >
    {#if isOngoing}
       <!-- content here -->
       <button class="btn btn-error btn-circle p-3" on:click={stopCall}
         ><Icon src={PhoneMissed} theme="solid" /></button
       >
    {:else}
      <button class="btn btn-accent btn-circle p-3" on:click={startCall}
        ><Icon src={PhoneCall} theme="solid" /></button
      >
    {/if}
    <button
      class="btn {isMicOn ? 'btn-accent' : 'btn-error'} btn-circle p-3"
      on:click={() => controller.toggleAudio()}
      ><Icon src={isMicOn ? Mic : MicOff} theme="solid" /></button
    >
    <button
      class="btn {isCameraOn ? 'btn-accent' : 'btn-error'} btn-circle p-3"
      on:click={() => controller.toggleVideo()}
      ><Icon src={isCameraOn ? Video : VideoOff} theme="solid" /></button
    >
  </div>
  <!-- Buttons -->
</div>
