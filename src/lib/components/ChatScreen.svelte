<script lang="ts">
  import { Icon } from "@steeze-ui/svelte-icon";
  import { PaperAirplane, Phone, User } from "@steeze-ui/heroicons";
  import { onDestroy } from "svelte";
  import * as dayjs from "dayjs";
  import { friendRTCStore, myProfileStore, screenStore, friendChannelStore } from "../stores";
  import { getGun } from "../db";
  import { get, type Unsubscriber } from "svelte/store";
  import * as _ from "lodash";
  import CallScreen from "./CallScreen.svelte";
  import NavButton from "./NavButton.svelte";
  import { SortedArray } from '@shlappas/sorted-array'
  import type { GroupNode } from "../circle-channel";
  export let friend: FriendProfile;
  
  const { pair } = getGun();
  let myProfile = $myProfileStore!
  let profileUnsub: Unsubscriber = myProfileStore.subscribe(v => v && (myProfile = v))
  let chats = new SortedArray<ChatMessageGun>((a, b) => b.ts - a.ts)
    
  let profilePathMap: Map<string, FriendProfile>;
  let isWebRTC: boolean
  let channel: GroupNode
  let previousFriend: FriendProfile;
  let previousChannel: GroupNode
  $: {
    if (previousChannel) {
      previousChannel.off("recv-chat", insertMsg)
    }
    channel = ($friendChannelStore)[friend.pub]
    channel.readAll()
      .then(v => {
        channel.on("recv-chat", insertMsg)
        for (const [key, message] of v) {
          insertMsg(message)
        }
      })
    isWebRTC = !!$friendRTCStore.get(friend.pub)
    previousFriend = friend
    previousChannel = channel
  }
  friendRTCStore.subscribe(v => isWebRTC = v.has(friend.pub))
  $: {
    profilePathMap = new Map([
      [friend.pub, friend],
      [pair.pub, myProfile]
    ])
  }
  $: onCall = get(screenStore.currentActiveCall);

  function insertMsg(msg: ChatMessageGun, key?: string, unread?: boolean, meta?: any, doRead?: () => void) {
    if (!msg.msg || !msg.ts || !msg.by || !profilePathMap.has(msg.by)) return
    if (doRead) doRead()
    chats.insert(msg)
    chats = chats
  }
  async function sendMessage() {
    if (!messageInput) return;
    const time = new Date();
    const msgData: ChatMessageGun = {
      msg: messageInput,
      ts: time.getTime(),
      by: pair.pub
    };
    channel.emit('send-chat', msgData)
    messageInput = "";
  }
  

  onDestroy(() => {
    if (profileUnsub)
      profileUnsub()
    channel.off("recv-chat", insertMsg)
  });

  let messageInput: string;
  let viewport: Element;
  let contents: Element;
  $: viewport, contents;
</script>

<div
  id="chat-screen"
  class="flex flex-col h-screen justify-end flex-1 w-full relative"
>
  <!-- Causes slow when unload -->
  <!-- <VirtualList items={chats} let:item={chat}> -->
  {#if onCall}
    <div id="call-section h-60 w-full overflow-y-hidden">
      <CallScreen friend={friend} />
    </div>
  {/if}
  <div bind:this={viewport} id="viewport" class="h-full overflow-y-auto flex flex-col-reverse pt-16 pb-2">
    <div bind:this={contents} id="contents" class="flex h-fit w-full flex-col-reverse">
      {#each [...chats.values()] as chat, i}
        {#if 
          i != chats.length-1
          && chat.by == (chats.get(i + 1)?.by)
          && (chat.ts - (chats.get(i + 1)?.ts??0)) < 60000
        }
          <div class="py-0.5 pr-8 flex flex-row w-full group hover:bg-base-200">
            <div
              class="w-20 shrink-0 flex justify-center text-xs text-transparent group-hover:text-base-content pt-1"
            >
              {dayjs.unix(chat.ts / 1000).format("hh:mm A")}
            </div>
            <div class="w-full min-w-0 inline-block break-words">
              {chat.msg}
            </div>
          </div>
        {:else}
          <div class="mt-2">
            <div class="flex flex-row items-start hover:bg-base-200 pb-1 pr-8">
              <div
                class="w-20 pt-2 h-10 flex shrink-0 items-center justify-center"
              >
                {#if profilePathMap.get(chat.by)?.picture}
                  <img
                    class="w-10 mask mask-circle mt-1"
                    alt={`${profilePathMap.get(chat.by)?.username} profile picture`}
                    src={profilePathMap.get(chat.by)?.picture}
                  />
                {:else}
                  <Icon src={User} theme="solid" class="color-gray-900" />
                {/if}
              </div>
              <div class="w-full min-w-0 inline-block break-words">
                <div class="flex flex-row gap-x-2 items-start">
                  <p class="font-semibold text-accent-content/80">
                    {profilePathMap.get(chat.by)?.username}
                  </p>
                  <p class="text-xs mt-1.5 text-base-content/50">
                    {dayjs.unix(chat.ts / 1000).format("DD/MM/YYYY hh:mm A")}
                  </p>
                </div>
                  {chat.msg}
              </div>
            </div>
          </div>
        {/if}
      {/each}
    </div>
  </div>
  <!-- </VirtualList> -->

  <!-- <Svrollbar
    initiallyVisible={true}
    {viewport}
    {contents}
  /> -->

  <div
    id="header"
    class="prose flex flex-row items-center {get(screenStore.currentActiveCall)
      ? 'top-60'
      : 'top-0'} h-14 w-[inherit] max-w-[inherit] py-4 px-2 backdrop-blur absolute shadow-lg bg-base-200/90"
  >
    <NavButton />
    {#if friend.username}
      <h4 class="m-0 ml-2"><strong>{friend.username}</strong></h4>
    {/if}
    <div class="w-2" />
    <button
      on:click={() => navigator.clipboard.writeText(friend.pub)}
      class="min-w-0 flex rounded-lg bg-base-300 h-fit translate-y-[1px] text-sm mt-.5"
    >
      <code class="truncate max-w-fit">{friend.pub.slice(0, 12)}...</code>
    </button>
    <button
      id="friendrtc"
      class={`ml-2 min-w-0 flex items-center justify-center rounded-lg bg-accent h-fit translate-y-[1px] text-sm mt-.5 transition-all ease-in-out duration-300 overflow-hidden ${ isWebRTC ? 'w-16' : 'w-0' }`}
    >
      <code class="text-base-300">WebRTC</code>
    </button>
    <div class="flex-1" />
    {#if !onCall}
      <button
        class="h-fit w-fit btn btn-outline btn-base btn-accent btn-xs p-3 !outline-none !border-none"
        on:click={() => {
          console.log(`Calling ${friend.username}...`);
          screenStore.currentActiveCall.set(true);
        }}
      >
        <Icon src={Phone} theme="solid" class="w-5 h-5 color-gray-900" />
      </button>
    {/if}
  </div>

  <!-- Input -->
  <div class="flex flex-row bg-transparent mx-3 pb-4 btn-group">
    <input
      type="text"
      placeholder="Message"
      class="flex-1 input input-bordered rounded-tr-none rounded-br-none"
      bind:value={messageInput}
      on:keydown={(e) => {
        if (e.key == "Enter") sendMessage();
      }}
    />
    <button class="btn btn-accent p-3" on:click|preventDefault={sendMessage}>
      <Icon
        src={PaperAirplane}
        theme="solid"
        class="color-gray-900 object-contain aspect-square"
      />
    </button>
  </div>
</div>

<!-- <style>
  #chat-screen #viewport {
    /* hide scrollbar */
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  #chat-screen #viewport::-webkit-scrollbar {
    /* hide scrollbar */
    display: none;
  }
</style> -->
