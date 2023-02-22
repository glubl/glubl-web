<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { friendData, friendMessages, userData } from "@src/lib/mock/users";
  import ChatScreen from "$lib/components/ChatScreen.svelte";

  let me = userData
  let friends = friendData
  let selected = Object.keys(friendData)[0]

</script>

<div class="drawer drawer-mobile">
  <input id="friend-list" type="checkbox" class="drawer-toggle" />
  <div class="drawer-content flex flex-col items-center justify-center">
    <ChatScreen friend={selected} />
  </div>
  <div class="drawer-side">
    <label for="friend-list" class="drawer-overlay" />
    <ul class="menu menu-compact p-4 w-80 bg-base-300 text-base-content">
      <!-- Profile -->
      <div class="pb-4 px-2 rounded-lg justify-start h-fit">
        <div class="flex flex-row gap-4">
          <div class="avatar online">
            <div class="w-14 mask mask-squircle">
              <img src={me.profilePicture} alt="" />
            </div>
          </div>
          <div class="flex flex-col justify-center">
            <div class="font-extrabold">{me.name}</div>
            <div class="text-base-content/70 text-sm">{me.id}</div>
          </div>
        </div>
      </div>

      <!-- Friends -->
      {#each Object.entries(friends) as [id, friend]}
        <li class="pb-1">
          <a
            {id}
            href={`/chat`}
            on:click={async () => {
              selected = id;
              invalidateAll()
            }}
            data-friend-id={id}
            class={`!rounded-md py-1 px-2 gap-x-2 flex flex-row items-center ${
              id == selected ? "active" : ""
            }`}
          >
            <div class="avatar online">
              <div class="w-8 mask mask-squircle">
                <img src={friend.profilePicture} alt="" />
              </div>
            </div>
            <p class="text-md font-semibold m-0 flex">
              {friend.name}
            </p>
          </a>
        </li>
      {/each}
    </ul>
  </div>
</div>
