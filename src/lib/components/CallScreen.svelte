<script lang="ts" scope="module">
  import { Icon } from "@steeze-ui/svelte-icon";
  import {
    Phone,
    Mic,
    MicOff,
    Video,
    VideoOff,
    Settings,
  } from "@steeze-ui/feather-icons";
  import {
    profileStore,
    localStream as localStreamStore,
    screenStore,
    callExpanded,
    deviceLabels,
  } from "@src/lib/stores";
  import callProfiles from "../mock/profiles";
  import ProfileTile from "./ProfileTile.svelte";
  import NavButton from "./NavButton.svelte";
  import call from "@src/lib/call";
  import { onMount } from "svelte";
  import { get } from "svelte/store";

  let myProfile = $profileStore;
  let calleeProfiles: { [pub: string]: FriendProfile } = callProfiles;

  let isCameraOn: boolean = true;
  let isMicOn: boolean = true;
  let isAudioOnly: boolean = isMicOn && !isCameraOn;
  let fullScreen: boolean;
  let selectedMenu: string;
  let profileShow: number;

  let myVideoElement: HTMLMediaElement | null;
  let myAudioElement: HTMLMediaElement | null;
  let audiooutputGroup: HTMLElement | null;
  let audioinputGroup: HTMLElement | null;
  let videoinputGroup: HTMLElement | null;
  let selectedDeviceLabels: Set<string> = new Set();

  screenStore.selectedChatMenu.subscribe((v) => (selectedMenu = v));
  callExpanded.subscribe((v) => {
    fullScreen = v;
    profileShow = v ? 8 : 4;
  });
  $: callExpanded.set(selectedMenu === ":calls:");
  $: audiooutputGroup, audioinputGroup, videoinputGroup;

  function startcall() {
    call.startCapture({
      audio: isMicOn,
      video: isCameraOn,
    } as MediaStreamConstraints);
    const stream = get(localStreamStore);
    if (stream) {
      stream.getTracks().forEach((track) => {
        if (!!track) selectedDeviceLabels.add(track.label);
      });
    }
    navigator.mediaDevices.ondevicechange = (ev) => {
      getDevices();
      updateElement();
      if (stream) {
        stream.getTracks().forEach((track) => {
          if (!!track) selectedDeviceLabels.add(track.label);
        });
      }
    };
    getDevices();
  }
  function endcall() {
    call.endCapture(myProfile?.pub);
    isCameraOn = false;
    isMicOn = false;
    updateElement();
    // clear all media stream
  }
  function toggleCamera() {
    isCameraOn = !isCameraOn;
    updateElement();
  }
  function toggleMic() {
    isMicOn = !isMicOn;
    updateElement();
  }
  function updateElement() {
    call.updateCapture({
      audio: isMicOn,
      video: isCameraOn,
    } as MediaStreamConstraints);
    if (myVideoElement) {
      myVideoElement.hidden = !isCameraOn;
      myVideoElement.srcObject = $localStreamStore;
    }
    if (myAudioElement) {
      myAudioElement.hidden = !isAudioOnly;
      myAudioElement.srcObject = $localStreamStore;
    }
  }
  function addDeviceElem(device: MediaDeviceInfo) {
    const existingElem = document.getElementById(device.label);
    if (existingElem) {
      return;
    }
    const entry = document.createElement("div");
    entry.classList.add("form-control");
    entry.id = device.label;
    entry.innerHTML = `
        <label class="label cursor-pointer">
          <span class="label-text">${device.label}</span>
          <input
            type="radio"
            name="${device.kind}"
            class="radio checked:bg-accent"
            checked=${selectedDeviceLabels.has(device.label)}
          />
        </label>`;

    if (device.kind === "audioinput") {
      audioinputGroup?.appendChild(entry);
    } else if (device.kind === "videoinput") {
      videoinputGroup?.appendChild(entry);
    } else if (device.kind === "audiooutput") {
      audiooutputGroup?.appendChild(entry);
    }
  }
  function getDevices() {
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        const newList = devices.map((device) => device.label);
        const removeList = $deviceLabels.filter(
          (label) => newList.indexOf(label) < 0,
        );
        devices.forEach((device: MediaDeviceInfo) => {
          addDeviceElem(device);
        });
        removeList.forEach((oldLabel) => {
          document.getElementById(oldLabel)!.remove();
        });
        deviceLabels.set(devices.map((item) => item.label));
      })
      .catch((err) => `Unable to emumerate devices\n${err}`);
  }
  function onSettingsSaved(e: Event) {}

  onMount(() => {
    myVideoElement = <HTMLMediaElement | null>(
      document.getElementById(`userVideo-${myProfile!.pub}`)
    );
    myAudioElement = <HTMLMediaElement | null>(
      document.getElementById(`userAudio-${myProfile!.pub}`)
    );

    if (myVideoElement)
      localStreamStore.subscribe((v) => (myVideoElement.srcObject = v));
    if (myAudioElement)
      localStreamStore.subscribe((v) => (myAudioElement.srcObject = v));

    startcall();
  });
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
    {#if myProfile}
      <ProfileTile profile={myProfile} {myProfile} />
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
    <button class="btn btn-error btn-circle p-3" on:click={endcall}
      ><Icon src={Phone} theme="solid" /></button
    >
    <button
      class="btn {isMicOn ? 'btn-accent' : 'btn-error'} btn-circle p-3"
      on:click={toggleMic}
      ><Icon src={isMicOn ? Mic : MicOff} theme="solid" /></button
    >
    <button
      class="btn {isCameraOn ? 'btn-accent' : 'btn-error'} btn-circle p-3"
      on:click={toggleCamera}
      ><Icon src={isCameraOn ? Video : VideoOff} theme="solid" /></button
    >
    <label for="media-settings" class="btn btn-accent btn-circle p-3">
      <Icon src={Settings} />
    </label>
  </div>
  <!-- Buttons -->

  <input type="checkbox" id="media-settings" class="modal-toggle" />
  <!-- Modal -->
  <label for="media-settings" class="modal modal-bottom sm:modal-middle">
    <label for="" class="modal-box relative">
      <form
        class="form-group bg-base-200 p-4"
        on:submit|preventDefault={onSettingsSaved}
      >
        <div>
          <h3>Audio Input</h3>
          <div bind:this={audioinputGroup} />
        </div>
        <div class="divider" />
        <div>
          <h3>Audio Output</h3>
          <div bind:this={audiooutputGroup} />
        </div>
        <div class="divider" />
        <div>
          <h3>Video Input</h3>
          <div bind:this={videoinputGroup} />
        </div>
      </form>
    </label>
  </label>
</div>
