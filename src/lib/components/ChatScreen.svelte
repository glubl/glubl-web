<script lang="ts">
  import { Svrollbar } from "$lib/components/svrollbar";
  import { Icon } from "@steeze-ui/svelte-icon";
  import { PaperAirplane, Phone, User } from "@steeze-ui/heroicons";
  import { onDestroy } from "svelte";
  import * as dayjs from "dayjs";
  import { screenStore, profileStore } from "../stores";
  import { getGun } from "../gun";
  import type {
    GunHookMessagePut,
    IGunChain,
    IGunInstance,
    IGunOnEvent,
  } from "gun";
  import { DecriptionFail, SharedCreationFail, VerifyFail } from "../errors";
  import auth from "../auth";
  import { get, type Unsubscriber } from "svelte/store";
  import * as _ from "lodash";
  import CallScreen from "./CallScreen.svelte";
  import NavButton from "./NavButton.svelte";

  export let friend: FriendProfile;

  const { gun, SEA, user, pair } = getGun();
  const uuidFn: (l?: number) => string = (gun as any).back("opt.uuid");

  let shared: string;
  let mySpacePath: string;
  let mySpace: IGunChain<any>;
  let theirSpacePath: string;
  let theirSpace: IGunChain<any>;
  let myE: IGunOnEvent | null;
  let theirE: IGunOnEvent | null;
  let chats: (ChatMessage & { index: number })[];
  let chatData: { [k: string]: ChatMessage } = {};
  let profileUnsub: Unsubscriber | null;
  let notOnCall: boolean;
  const refreshChat = _.debounce(
    () => {
      chats = [
        ...Object.values(chatData)
          .sort((a, b) => b.ts - a.ts)
          .map((v: any, i) => {
            v.index = i;
            return v;
          }),
      ];
    },
    100,
    { maxWait: 500 },
  );

  let profilePathMap: { [k: string]: FriendProfile } = {};
  $: profilePathMap[theirSpacePath] = friend;

  async function init(friend: FriendProfile) {
    reset();

    if (!friend.pub)
      throw new Error("Friend profile somehow doesn't have public key??");
    if (!pair.pub) throw new Error("Somehow you don't have public key????");

    let _ = await SEA.secret(friend.epub, pair);
    if (!_) throw new SharedCreationFail();
    shared = _;

    mySpacePath = await auth.getUserSpacePath(pair.pub, shared);
    mySpace = gun
      .get("~" + friend.pub)
      .get("spaces")
      .get(mySpacePath);
    profileUnsub = profileStore.subscribe((v) => {
      if (v) {
        profilePathMap[mySpacePath] = { ...v, space: mySpacePath };
      } else {
        console.warn("Somehow your profile is undefined???");
      }
    });

    theirSpacePath = await auth.getUserSpacePath(friend.pub, shared);
    theirSpace = user.get("spaces").get(theirSpacePath);

    theirSpace
      .get("messages")
      .map()
      .on((v, k, _, e) => {
        receiveMessage(v, k);
        theirE = e;
      });

    mySpace
      .get("messages")
      .map()
      .on((v, k, _, e) => {
        receiveMessage(v, k);
        myE = e;
      });
  }
  $: {
    if (friend) init(friend);
  }

  function reset() {
    if (myE) {
      myE.off();
      myE = null;
    }
    if (theirE) {
      theirE.off();
      theirE = null;
    }
    chats = [];
    chatData = {};
    if (profileUnsub) {
      profileUnsub();
      profileUnsub = null;
    }
  }

  onDestroy(() => {
    reset();
  });

  async function receiveMessage(v: { [k: string]: string }, k: string) {
    delete v._;
    const path = k.substring(k.indexOf("|") + 1);
    const profile = profilePathMap[path];
    if (!profile) {
      throw new Error("Unknown chat sender");
    }
    const enc = await SEA.verify(v.d, profile.pub);
    if (!enc) throw new VerifyFail();
    const data = await SEA.decrypt(enc, shared);
    if (!data) throw new DecriptionFail();

    data.by = profile;
    data.to = get(profileStore);

    chatData[k] = data;
    refreshChat();
  }

  let messageInput: string;
  async function sendMessage() {
    if (!messageInput) return;
    const time = new Date();
    const msgData: ChatMessageGun = {
      msg: messageInput,
      ts: time.getTime(),
      by: pair.pub,
      to: friend.pub,
    };
    const msgDataEnc = await SEA.encrypt(msgData, shared);
    const msgDataSig = await SEA.sign(msgDataEnc, pair);
    theirSpace
      .get("messages")
      .get(`${time.toISOString()}|${mySpacePath}`)
      .put({ d: msgDataSig });

    messageInput = "";
  }

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
  {#if get(screenStore.currentActiveCall)}
    <div id="call-section h-60 w-full overflow-y-hidden">
      <CallScreen />
    </div>
  {/if}
  <div
    bind:this={viewport}
    id="viewport"
    class="h-full overflow-y-auto flex flex-col-reverse pt-16 pb-2"
  >
    <div bind:this={contents} id="contents" class="flex h-fit flex-col-reverse">
      {#each chats ?? [] as chat}
        <!-- content here -->
        {#if chat.index != chats.length - 1 && chat.by.pub == chats[chat.index + 1].by?.pub && chat.ts - chats[chat.index + 1].ts < 60000}
          <div class="py-0.5 pr-8 flex flex-row w-full group hover:bg-base-200">
            <div
              class="w-20 shrink-0 flex justify-center text-xs text-transparent group-hover:text-base-content pt-1"
            >
              {dayjs.unix(chat.ts / 1000).format("hh:mm A")}
            </div>
            <div class="flex flex-row items-start gap-x-2">
              <div class="flex flex-col">
                {chat.msg}
              </div>
            </div>
          </div>
        {:else}
          <div class="mt-2">
            <div class="flex flex-row items-start hover:bg-base-200 pb-1 pr-8">
              <div
                class="w-20 pt-2 h-10 flex shrink-0 items-center justify-center"
              >
                {#if chat.by?.picture}
                  <img
                    class="w-10 mask mask-circle mt-1"
                    alt={`${chat.by.username} profile picture`}
                    src={chat.by.picture}
                  />
                {:else}
                  <Icon src={User} theme="solid" class="color-gray-900" />
                {/if}
              </div>
              <div class="flex flex-col">
                <div class="flex flex-row gap-x-2 items-start">
                  <p class="font-semibold text-accent-content/80">
                    {chat.by.username}
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
      <code class="truncate max-w-fit">{friend.pub.slice(0, 48)}...</code>
    </button>
    <div class="flex-1" />
    {#if notOnCall}
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
