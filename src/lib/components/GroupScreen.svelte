<script lang="ts">
  import { Icon } from "@steeze-ui/svelte-icon";
  import { PaperAirplane, User, Users } from "@steeze-ui/heroicons";
  import { onDestroy } from "svelte";
  import * as dayjs from "dayjs";
  import { friendsStore, myProfileStore, screenStore } from "../stores";
  import { getGun } from "../db";
  import { get, type Unsubscriber } from "svelte/store";
  import * as _ from "lodash";
  import NavButton from "./NavButton.svelte";
  import { SortedArray } from '@shlappas/sorted-array'
  import type { GroupNode } from "../circle-channel";
  
  export let group: GroupNode;
  let previousGroup: GroupNode

  const { pair } = getGun();
  let myProfile = $myProfileStore!
  let friends = $friendsStore
  let profileUnsub: Unsubscriber = myProfileStore.subscribe(v => v && (myProfile = v))
  let friendUnsub: Unsubscriber = friendsStore.subscribe(v => friends = v)
  
  let chatMap: {[id: string]: SortedArray<ChatMessageGun>} = {}
  $: {
    if (previousGroup) {
      previousGroup.off("recv-chat", insertMsg)
    }
    let fut: Promise<Map<string, any>>
    if (!chatMap[group.id!]) {
      fut = group.readAll()
      chatMap[group.id!] = new SortedArray<ChatMessageGun>((a, b) => b.ts - a.ts)
    } else {
      fut = group.read()
    }
    fut.then(v => {
      group.on("recv-chat", insertMsg)
      for (const [key, message] of v) {
        insertMsg(message)
      }
    })
    previousGroup = group
  }

  function insertMsg(msg: ChatMessageGun, key?: string, unread?: boolean, meta?: any, doRead?: () => void) {
    if (!msg.msg || !msg.ts || !msg.by) return
    if (doRead) doRead()
    ;(chatMap[group.id!]??=new SortedArray<ChatMessageGun>((a, b) => b.ts - a.ts)).insert(msg)
  }
  async function sendMessage() {
    if (!messageInput) return;
    const time = new Date();
    const msgData: ChatMessageGun = {
      msg: messageInput,
      ts: time.getTime(),
      by: pair.pub
    };
    group.emit('send-chat', msgData)
    messageInput = "";
  }

  onDestroy(() => {
    profileUnsub()
    friendUnsub()
    group.off("recv-chat", insertMsg)
  });

  let messageInput: string;
  let viewport: Element;
  let contents: Element;
  let startCall: () => void
  let stopCall: () => void
  $: viewport, contents;

  let checkedMembers: { pub: string; epub: string, checked: boolean, username?: string}[]
  $: {
    checkedMembers = [...group.members.values()].map(v => {
      let f = friends[v.pub]
      if (f) return { ...f, checked: true }
      return {...v, checked: true}
    })
  }
</script>


<div
  id="chat-screen"
  class="flex flex-row-reverse h-screen flex-1 w-full relative"
>
  <div class="flex flex-col min-w-0 items-center h-screen bg-base-200 shadow-lg z-50 w-80">
    <div class="bg-base-100 mt-12 rounded-full overflow-hidden">
      <Icon
        src={Users}
        theme="solid"
        class=" object-contain aspect-square flex h-28 p-2"
      />
    </div>
    <p class="mt-2 font-bold text-3xl">{group.metadata.name}</p>
    <button
      on:click={() => navigator.clipboard.writeText(group.id||'')}
      class="mt-1 px-2 py-1 min-w-0 flex rounded-lg bg-base-300 h-fit translate-y-[1px] text-sm"
    >
      <code class="truncate max-w-fit text-xs">{group.id||''}</code>
    </button>
    <div class="divider mx-8">Members</div>

    <div id="viewport" class="h-full overflow-y-auto flex flex-col pb-2">
      <div id="contents" class="flex w-full flex-col">
        <div class="flex flex-col flex-1 px-2">
          {#each checkedMembers as mem (mem.pub)}
            <!-- <button
              id={mem.pub}
              on:click|preventDefault={() => {
                mem.checked = false
              }}
              class={`min-w-0 flex flex-row flex-1 !rounded-md my-1 px-4 py-2 gap-x-1 transition-colors duration-200 items-center active:bg-base-content/20 no-underline  ${
                mem.checked
                  ? "bg-accent"
                  : "active:bg-accent-focus hover:bg-accent/50"
              }`}
            >
              <div class="avatar">
                <div class="w-6 mask mask-squircle">
                  <Icon src={User} theme="solid" class="text-secondary-content" />
                </div>
              </div>
              <div class="flex flex-1 text-ellipsis truncate overflow-hidden text-secondary-content text-sm font-normal pb-0.5 text-left ml-2 ">
                {mem.username || mem.pub}
              </div>
            </button> -->
            <div class="flex flex-row items-center min-w-0">
              <div class="min-w-0 w-full flex flex-col flex-1 gap-y-2 items-start overflow-hidden">
                <code class="truncate overflow-hidden flex flex-1 text-sm py-1 px-2 rounded-lg bg-base-300">{mem.username || mem.pub}</code>
              </div>
            </div>
          {/each}
        </div>
        
        <!-- <div class="flex flex-col px-2 items-stretch">
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
        </div> -->
      </div>
    </div>


  </div>
  <div class="flex flex-col h-screen flex-1 relative">
    <div
      id="header"
      class="prose flex flex-row items-center {get(screenStore.currentActiveCall)
        ? 'top-60'
        : 'top-0'} h-14 w-[inherit] max-w-[inherit] py-4 px-2 shadow-lg bg-base-200"
      >
      <NavButton />
      {#if group.metadata?.name}
        <h4 class="m-0 ml-2"><strong>{group.metadata?.name}</strong></h4>
      {/if}
      <div class="w-2" />
      <button
        on:click={() => navigator.clipboard.writeText(group.id||'')}
        class="min-w-0 flex rounded-lg bg-base-300 h-fit translate-y-[1px] text-sm mt-.5"
      >
        <code class="truncate max-w-fit">{group.id||''}...</code>
      </button>
      <div class="flex-1" />
      <button
        on:click={() => {}}
        class="flex h-10 w-10 px-2 py-2 text-accent hover:text-accent-content hover:bg-accent active:bg-accent-focus rounded-lg transition-colors duration-200"
      >
        <Icon
          src={Users}
          theme="solid"
          class=" object-contain aspect-square flex "
        />
      </button>
    </div>
    {#if group.id}
      <div bind:this={viewport} id="viewport" class="h-full overflow-y-auto flex flex-col-reverse pt-2 pb-2">
        <div bind:this={contents} id="contents" class="flex h-fit w-full flex-col-reverse">
          {#each [...(chatMap[group.id||'']).values()] as chat, i}
            {#if 
              i != chatMap[group.id||''].length-1
              && chat.by == (chatMap[group.id||''].get(i + 1)?.by)
              && (chat.ts - (chatMap[group.id||''].get(i + 1)?.ts??0)) < 60000
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
                    <!-- {#if profilePathMap.get(chat.by)?.picture}
                      <img
                        class="w-10 mask mask-circle mt-1"
                        alt={`${profilePathMap.get(chat.by)?.username} profile picture`}
                        src={profilePathMap.get(chat.by)?.picture}
                      />
                    {:else}
                    {/if} -->
                    <Icon src={User} theme="solid" class="color-gray-900" />
                  </div>
                  <div class="w-full min-w-0 inline-block break-words">
                    <div class="flex flex-row gap-x-2 items-start">
                      <p class="font-semibold text-accent-content/80">
                        <!-- {profilePathMap.get(chat.by)?.username} -->
                        {chat.by.slice(0,12)}
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
    {/if}
  </div>
  
</div>
