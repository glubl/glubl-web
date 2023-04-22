<script lang="ts">
  import { Bars3, Check } from "@steeze-ui/heroicons";
  import { Icon } from "@steeze-ui/svelte-icon";
  import dayjs from "dayjs";
  import { get } from "lodash";
  import { onMount } from "svelte";
  import { writable } from "svelte/store";
  import { addFriend, parseFriendRequest, sendFriendRequest } from "../friends";
  import { getGun } from "../db";
  import { friendsStore, menuOpen, myProfileStore } from "../stores";

  function onMenuClick() {
    menuOpen.update(v => !v)
  }

  const {gun, user, pair} = getGun()

  let friendsPub = new Set<string>()
  let incomingMap: {[pub: string]: Profile} = {}
  let incoming: Profile[]
  $: incoming = Object.values(incomingMap||{}).filter(v => !friendsPub.has(v.pub))

  onMount(async () => {
    if (!pair)
      return

    friendsStore.subscribe(v => {
      friendsPub = new Set<string>(Object.values(v||{}).map(vv => vv.pub))
    })
    gun.get("#fren-req")
      .get({".": {"*": `${pair.pub}|${dayjs().format("YYYY-MM-DD")}`}})
      .map()
      .once(async (v, k) => {
        // console.log(k, v)
        let req = await parseFriendRequest(v)
        if (friendsPub.has(req.pub)) return
        incomingMap[req.pub] = req
      })
  })

  let pubInput: string
  $: pubLoading = false

  let requestMenuSelected: "outgoing" | "incoming"
  $: requestMenuSelected = "incoming"

  $: errorMsg = ""

  function parsePub(t: string) {
    try {
      const pub = JSON.parse(pubInput) as {pub: string, epub: string}
      if (!pub.epub || !pub.pub) {
        const err = new Error("Invalid public pair: property 'pub' and 'epub' must exists")
        err.name = "InvalidPair"
        throw err
      }
      return pub
    } catch (e: any) {
      if (e.name == "SyntaxError") {
        errorMsg = "Invalid public pair: must be a JSON object with 'pub' and 'epub' property"
      } else if (e.name == "InvalidPair") {
        errorMsg = e.message
      } else {
        throw e
      }
    }
  }

</script>
<div class="flex flex-col w-full h-full">
  <div
    id="header"
    class="prose flex flex-row items-center h-14 w-[inherit] max-w-[inherit] py-4 px-2 backdrop-blur shadow-lg bg-base-200/90"
  >
    <div
      class="h-fit w-fit btn btn-outline btn-base btn-sm drawer-button lg:hidden p-2 !outline-none !border-none"
      on:click={onMenuClick}
      on:keypress
    >
      <Icon src={Bars3} theme="solid" class="color-gray-900 w-6 h-6" />
    </div>
    <h4 class="m-0 ml-2"><strong>Add Friend</strong></h4>
    <div class="w-2"></div>
  </div>

  <div class="h-2" />

  <div class="p-4 md:p-6 flex flex-col max-h-full overflow-y-auto">
    <div class="flex flex-row p-2 btn-group ">
      <input
        type="text"
        placeholder="Public Key"
        class="flex-1 input input-bordered rounded-tr-none rounded-br-none"
        bind:value={pubInput}
      />
      <button 
        class={`btn btn-accent p-3 ${pubLoading ? "loading" : ""}`}
        on:click|preventDefault={ async () => {
          pubLoading = true
          const pub = parsePub(pubInput)
          if (!pub) {
            pubLoading = false
            return
          }
          sendFriendRequest(pub)
            .then(
              () => pubInput = "",
              v => {
                console.error(v)
                errorMsg = v
              }
            )
            .then(() => pubLoading = false)
        }}
      >
        Send 
      </button>
    </div>
    <div class="h-6 p-2 pt-0 text-sm text-error">
      {errorMsg}
    </div>
    <div class="px-2 pt-0 h-10 text-lg">
      Incoming Requests
    </div>
    <div class="max-h-full  overflow-y-auto">
      {#each incoming as r}
          <!-- content here -->
        <div class="group/item py-3 px-4 mb-1 bg-base-100 hover:bg-base-300/50 rounded-xl flex flex-col items-center">
          <div class="w-full gap-x-2 mr-2 flex flex-1 flex-row items-center">
            <div class="min-w-0 w-full flex flex-col flex-1 gap-y-2 items-start">
              <strong class="ml-1"><p>{r.username}</p></strong>
              <code class="truncate max-w-fit w-full text-sm py-1 px-2 rounded-lg bg-base-300">{r.pub}</code>
            </div>
            <button 
              class="p-3 rounded-full bg-base-300/50 hover:bg-base-300"
              on:click|preventDefault={() => {
                const {pub, epub} = r
                addFriend({pub, epub})
              }}
            >
              <Icon src={Check} theme="solid" class="color-gray-900 w-6 h-6" />
            </button>
          </div>
        </div>
      {/each}
    </div>

    <p class="text-md">
      <strong></strong>
    </p>
  </div>
</div>