<script lang="ts" scope="module">
  import { Icon } from "@steeze-ui/svelte-icon";
  import {
    Phone,
    Mic,
    MicOff,
    Camera,
    CameraOff,
  } from "@steeze-ui/feather-icons";
  import {
    profileStore,
    localStream,
    remoteStream,
    screenStore,
    callExpanded,
  } from "../stores";
  import callProfiles from "../mock/profiles";
  import ProfileTile from "./ProfileTile.svelte";
  import NavButton from "./NavButton.svelte";

  let myProfile = $profileStore;
  let calleeProfiles: { [pub: string]: FriendProfile } = callProfiles;
  let isCameraOn: boolean = false;
  let isMicOn: boolean = true;
  let fullScreen: boolean;
  let selectedMenu: string;
  let profileShow: number;
  screenStore.selectedChatMenu.subscribe((v) => (selectedMenu = v));
  callExpanded.subscribe((v) => {
    fullScreen = v;
    profileShow = v ? 8 : 4;
  });
  $: callExpanded.set(selectedMenu === ":calls:");
  function startcall() {
    // toggle call (and media stream)
    // call.start()
    toggleCamera();
    toggleMic();
    return "call object";
  }
  function endcall() {
    // call.endCall()
    isCameraOn = false;
    isMicOn = false;
    // clear all media stream
  }
  const toggleCamera = () => {
    isCameraOn = !isCameraOn;
    if (isCameraOn) {
      // call.startCam();
    }
  };
  const toggleMic = () => (isMicOn = !isMicOn);
</script>

<div
  class="flex flex-col flex-1 space-y-2 {fullScreen
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
    class="px-4 {fullScreen
      ? 'place-self-center flex-1 grid md:grid-cols-3 grid-cols-2 md:auto-rows-[200px] auto-rows-[120px] gap-2 overflow-x-hidden overflow-y-auto'
      : 'flex flex-row h-full w-full space-x-2 overflow-x-auto'}"
  >
    {#if myProfile}
      <ProfileTile profile={myProfile} />
    {/if}
    {#each Object.entries(calleeProfiles).slice(0, profileShow) as [key, profile]}
      <ProfileTile {profile} />
    {/each}

    {#if Object.entries(calleeProfiles).length > profileShow}
      <div
        class="flex flex-col justify-center items-center rounded-md bg-base-200"
      >
        <strong class="prose w-48 text-center">
          + {Object.entries(calleeProfiles).length - profileShow}
        </strong>
      </div>
    {/if}
  </div>
  <!-- Room participants tiles -->

  <!-- Buttons -->
  <div
    class="flex flex-row space-x-4 justify-center {fullScreen
      ? 'pb-8 pt-2 sticky bottom-0 rounded-t-2xl bg-base-200'
      : 'rounded-2xl'}"
  >
    <button class="btn btn-error btn-circle p-3" on:click={startcall}
      ><Icon src={Phone} theme="solid" /></button
    >
    <button
      class="btn {isMicOn ? 'btn-accent' : 'btn-error'} btn-circle p-3"
      on:click={endcall}
      ><Icon src={isMicOn ? Mic : MicOff} theme="solid" /></button
    >
    <button
      class="btn {isCameraOn ? 'btn-accent' : 'btn-error'} btn-circle p-3"
      on:click={toggleCamera}
      ><Icon src={isCameraOn ? Camera : CameraOff} theme="solid" /></button
    >
  </div>
  <!-- Buttons -->
</div>
