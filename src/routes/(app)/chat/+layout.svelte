<script lang="ts">
  import type { LayoutData } from './$types';

  export let data: LayoutData;
  $: selectedFriend = data.selected
</script>

<div class="drawer drawer-mobile">
  <input id="friend-list" type="checkbox" class="drawer-toggle" />
  <div class="drawer-content flex flex-col items-center justify-center">
    <slot />
  </div> 
  <div class="drawer-side">
    <label for="friend-list" class="drawer-overlay"></label> 
    <ul class="menu menu-compact p-4 w-80 bg-base-300 text-base-content">
      
      
      <!-- Profile -->
      <div class="pb-4 px-2 rounded-lg justify-start h-fit">
        <div class="flex flex-row gap-4">
          <div class="avatar online">
            <div class="w-14 mask mask-squircle">
              <img src="https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?cs=srgb&dl=pexels-pixabay-220453.jpg" alt="">
            </div>
          </div>
          <div class="flex flex-col justify-center">
            <div class="font-extrabold">Andrew McDonald</div>
            <div class="text-base-content/70 text-sm">andrew#6969</div>
          </div>
        </div>
      </div>


      <!-- Friends -->
      {#each Object.entries(data.friends) as [id, friend] }
        <li class="pb-1">
          <a href={`/chat/${id.replace(/#/g, '%23')}`} class={`!rounded-md py-1 px-2 gap-x-2 flex flex-row items-center ${id == selectedFriend ? "active" : ""}`}>
            <div class="avatar online">
              <div class="w-8 mask mask-squircle">
                <img src="{friend.profilePicture}" alt="">
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