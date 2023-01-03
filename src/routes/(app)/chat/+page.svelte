<script lang="ts">
  import type { PageData } from './$types';
  import { Icon } from '@steeze-ui/svelte-icon';
  import { PaperAirplane, Bars3 } from '@steeze-ui/heroicons';

  export let data: PageData;
  let selectedFriend = "";
  function setSelectedFriend(f) {
    console.log(f)
    selectedFriend = f;
  }
</script>

<div class="drawer drawer-mobile">
  <input id="friend-list" type="checkbox" class="drawer-toggle" />
  <div class="drawer-content flex flex-col items-center justify-center">
    <div class="h-screen p-4 flex flex-col justify-end flex-1 w-full gap-y-4">


      <!-- Chat list -->
      <div class="flex flex-col-reverse max-h-full overflow-y-auto">
        {#each Object.entries(data.chats[selectedFriend] || {}) as [ts, chat]}
          <div class="chat chat-start">
            <div class="chat-image avatar">
              <div class="w-10 rounded-full">
                <img src="https://placeimg.com/192/192/people" />
              </div>
            </div>
            <div class="chat-bubble">{chat.message}</div>
          </div>
        {/each}
      </div>


      <!-- Input -->
      <div class="flex flex-row w-full gap-x-2">
        <label for="friend-list" class="btn btn-primary drawer-button lg:hidden">
          <Icon src="{Bars3}" theme='solid' class='color-gray-900 w-5' />
        </label>
        <input type="text" placeholder="Message" class="input input-bordered flex-1" />
        <div class="btn btn-accent">
          <Icon src="{PaperAirplane}" theme='solid' class='color-gray-900 w-5' />
        </div>
      </div>


    </div>
  </div> 
  <div class="drawer-side">
    <label for="friend-list" class="drawer-overlay"></label> 
    <ul class="menu p-4 w-80 bg-base-300 text-base-content">
      
      
      <!-- Profile -->
      <div class="py-6 px-4 rounded rounded-lg justify-start h-fit">
        <div class="flex flex-row gap-4">
          <div class="avatar online">
            <div class="w-14 mask mask-squircle">
              <img src="https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?cs=srgb&dl=pexels-pixabay-220453.jpg" alt="">
            </div>
          </div>
          <div class="flex flex-col">
            <div class="font-extrabold">Andrew McDonald</div>
            <div class="text-base-content/70 text-sm">andrew#6969</div>
          </div>
        </div>
      </div>


      <!-- Friends -->
      {#each Object.entries(data.friends) as [id, friend] }
        <li>
          <a href="" on:click={setSelectedFriend(id)}>
            <div class="avatar online">
              <div class="w-8 mask mask-squircle">
                <img src="{friend.profilePicture}" alt="">
              </div>
            </div>
            {friend.name}
          </a>
        </li>
      {/each}


    </ul>
  </div>
</div>