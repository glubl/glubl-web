<script lang="ts">
  import { Svrollbar } from "$lib/components/svrollbar";
  import { Icon } from "@steeze-ui/svelte-icon";
  import { PaperAirplane, Bars3, Phone } from "@steeze-ui/heroicons";
  import VirtualList from "@sveltejs/svelte-virtual-list";
  import { onMount } from "svelte";
  import * as dayjs from "dayjs";
  import { friendData as FRIEND_DATA, friendMessages as FRIEND_MESSAGES } from "@src/lib/mock/users";
  import { chatStore, friendsStore, menuOpen } from "../stores";
  import { getGun } from "../initGun";
  import type { IGunChain, IGunInstance, IGunOnEvent } from "gun";
  import auth from "../auth";
  import { DecriptionFail, SharedCreationFail } from "../errors";

  const {gun, SEA, user, pair} = getGun()

  function onMenuClick() {
    menuOpen.update(v => !v)
  }

  let friends:  {[pub: string]: FriendProfile} = {}
  friendsStore.subscribe(v => friends = v)

  let friend: FriendProfile
  chatStore.selectedFriend.subscribe(f => {
    friend = friends[f]
  })

  let mySpace: IGunChain<any>
  let theirSpace: IGunChain<any>
  let mySpaceCert: string
  let subEvent: IGunOnEvent
  let chatData: {[k: string]: any}
  let shared: string
  $: chatData = {};
  $: {
    (async () => {
      if (!!friend) {
        const sharedKey = await SEA.secret(friend.epub, pair)
        if (!sharedKey)
          throw new SharedCreationFail()
        shared = sharedKey

        const mySpacePath = await auth.getUserSpacePath(pair.pub, sharedKey)
        mySpace = gun.get("~"+friend.pub)
          .get("spaces")
          .get(mySpacePath)

        const theirSpacePath = await auth.getUserSpacePath(friend.pub, sharedKey)
        theirSpace = user
          .get("spaces")
          .get(theirSpacePath)

        mySpaceCert = await SEA.decrypt(await mySpace.get("certificate").then(), sharedKey)

        if (subEvent)
          subEvent.off()

        theirSpace.get("#messages").map().on(async (v, k, _, e) => {
          subEvent = e
          const soul = await SEA.decrypt(v, sharedKey)
          if (!soul)
            throw new DecriptionFail()
          const dataEnc = await gun.get(soul).then()
          if (!dataEnc)
            console.warn("No message on soul")
          const data = await SEA.decrypt(dataEnc as string, shared)
          if (!data)
            throw new DecriptionFail()
          chatData[k] = data
        })
      }
    })()
  }

  let messageInput: string
  async function sendMessage() {
    if (!messageInput) return
    const time = new Date()
    const msgData: ChatMessageGun = {
      msg: messageInput,
      ts: time.getTime(),
      by: pair.pub
    }
    const msgDataSig = await SEA.encrypt(msgData, shared)
    // const msgDataSig = await SEA.sign(msgDataEnc, pair)
    user.get("messages").set({d: msgDataSig}).once(async (v, k) => {
      const d = await SEA.encrypt(v._["#"], shared)
      const hash = await SEA.work(d, null, null, {name: "SHA-256"})
      const key = `${time.toISOString()}#${hash}`
      
      mySpace.get("#messages")
        .get(key)
        .put(d, undefined, {opt: {cert: mySpaceCert}})
      theirSpace.get("#messages")
        .get(key)
        .put(d, undefined, {opt: {cert: mySpaceCert}})
    })
  }
  
  let viewport: Element;
  let contents: Element;
  $: viewport, contents;

  $: chats = [
    "dummy",
    "dummy",
    "dummy",
    ...Object.values(chatData)
      // .sort((a, b) => a.ts - b.ts)
      .map((v: any, i) => {
        v.index = i + 3;
        return v;
      }),
    "dummy",
  ];

  onMount(() => {
    viewport = document.querySelector(
      "#chat-screen svelte-virtual-list-viewport",
    )!;
    contents = document.querySelector(
      "#chat-screen svelte-virtual-list-contents",
    )!;
    setTimeout(() => {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: "auto" });
    }, 1);
  });
</script>

<div
  id="chat-screen"
  class="flex flex-col h-screen justify-end flex-1 w-full relative"
>
  <VirtualList items={chats} let:item={chat}>
    {#if chat == "dummy"}
      <div class="pl-4">
        <div class="h-6" />
      </div>
    {:else if chat.ts - chats[chat.index - 1].ts < 60000}
      <div class="py-0.5 pr-8 flex flex-row w-full group hover:bg-base-200">
        <div
          class="w-20 shrink-0 flex justify-center text-xs text-transparent group-hover:text-base-content pt-1"
        >
          {dayjs.unix(chat.ts / 1000).format("hh:mm A")}
        </div>
        <div class="flex flex-row items-start gap-x-2">
          <div class="flex flex-col">
            {chat.message}
          </div>
        </div>
      </div>
    {:else}
      <div class="pr-8 hover:bg-base-200">
        <div class="flex flex-row items-start mt-4 pb-1">
          <div
            class="w-20 pt-2 h-10 flex shrink-0 items-center justify-center"
          >
            <img
              class="w-10 mask mask-circle mt-1"
              alt={`${chat.by.name} profile picture`}
              src={chat.by.profilePicture}
            />
          </div>
          <div class="flex flex-col">
            <div class="flex flex-row gap-x-2 items-start">
              <p class="font-semibold text-accent-content/80">
                {chat.by.name}
              </p>
              <p class="text-xs mt-1.5 text-base-content/50">
                {dayjs.unix(chat.ts / 1000).format("DD/MM/YYYY h:m A")}
              </p>
            </div>
            {chat.message}
          </div>
        </div>
      </div>
    {/if}
  </VirtualList>

  <Svrollbar
    initiallyVisible={true}
    {viewport}
    {contents}
    margin={{ top: 72, bottom: 10, right: 3 }}
  />

  <div
    id="header"
    class="prose flex flex-row items-center h-14 w-[inherit] max-w-[inherit] py-4 px-2 backdrop-blur absolute shadow-lg top-0 bg-base-200/90"
  >
    <div
      class="h-fit w-fit btn btn-outline btn-base btn-sm drawer-button lg:hidden p-2 !outline-none !border-none"
      on:click={onMenuClick}
      on:keypress
    >
      <Icon src={Bars3} theme="solid" class="color-gray-900 w-6 h-6" />
    </div>
    <h4 class="m-0 ml-2"><strong>{friend.username}</strong></h4>
    <div class="w-2"></div>
    <button on:click={() => navigator.clipboard.writeText(friend.pub)} class="flex rounded-lg bg-base-300 h-fit translate-y-[1px] text-sm mt-.5">
      <code>{friend.pub.slice(0, 17)}...</code>
    </button>
    <div class="flex-1" />
    <button
      class="h-fit w-fit btn btn-outline btn-base btn-accent btn-xs p-3 !outline-none !border-none"
      on:click={() => {
        console.log("Calling... ", friend.pub);
      }}
    >
      <Icon
        src={Phone}
        theme="solid"
        class="w-5 h-5 color-gray-900"
      />
    </button>
  </div>

  <!-- Input -->
  <div class="flex flex-row bg-transparent mx-3 pb-4 btn-group">
    <input
      type="text"
      placeholder="Message"
      class="flex-1 input input-bordered rounded-tr-none rounded-br-none"
      bind:value={messageInput}
    />
    <button class="btn btn-accent p-3"
      on:click|preventDefault={sendMessage}
    >
      <Icon
        src={PaperAirplane}
        theme="solid"
        class="color-gray-900 object-contain aspect-square"
      />
    </button>
  </div>
</div>

<style>
  #chat-screen :global(svelte-virtual-list-viewport) {
    /* hide scrollbar */
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  #chat-screen :global(svelte-virtual-list-viewport::-webkit-scrollbar) {
    /* hide scrollbar */
    display: none;
  }
  #chat-screen :global(svelte-virtual-list-contents) {
    padding-top: 200px;
  }
</style>
