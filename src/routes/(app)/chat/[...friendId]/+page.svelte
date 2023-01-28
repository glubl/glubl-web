<script lang="ts">
  import { Svrollbar } from 'svrollbar';
  import type { PageData } from './$types';
  import { Icon } from '@steeze-ui/svelte-icon';
  import { PaperAirplane, Bars3 } from '@steeze-ui/heroicons';
  import { onMount } from 'svelte';

  export let data: PageData;
  export let viewport: Element;
  export let contents: Element;
</script>

<style>
  #chat-viewport {
    /* hide scrollbar */
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  #chat-viewport::-webkit-scrollbar {
    /* hide scrollbar */
    display: none;
  }
  #chat-screen > :global(.v-scrollbar) {
    transform: translateY(16px);
  }
</style>

<div id="chat-screen" class="flex flex-col h-screen justify-end flex-1 w-full relative">

  <!-- Chat -->   
  <div bind:this={viewport} id="chat-viewport" class="w-full overflow-scroll relative">
    <div bind:this={contents} id="chat-contents" class="w-full px-4 pb-8 pt-20">
      {#each Object.entries(data.chats) as [ts, chat]}
        <div class="chat chat-start">
          <div class="chat-image avatar">
            <div class="w-10 rounded-full">
              <img alt={`${chat.by.name} profile picture`} src="{chat.by.profilePicture}" />
            </div>
          </div>
          <div class="chat-bubble">{chat.message}</div>
        </div>
      {/each}
    </div>
  </div>

  <Svrollbar 
    margin={{top: 60, right: 2}} 
    initiallyVisible={true} 
    alwaysVisible={false} 
    {viewport} 
    {contents} 
  />
  
  <div class="prose flex flex-row items-center gap-x-4 w-[inherit] max-w-[inherit] py-4 px-4 backdrop-blur absolute shadow-lg top-0 bg-base-200/90">
    <label for="friend-list" class="h-fit w-fit btn btn-outline btn-base btn-sm drawer-button lg:hidden p-2 !outline-none !border-none">
      <Icon src="{Bars3}" theme='solid' class='color-gray-900 w-6 h-6' />
    </label>
    <strong class="text-lg">{data.friend.name}</strong>
    <div class="flex rounded-lg bg-base-300 h-fit translate-y-[1px]">
      <code>{data.friend.id}</code>
    </div>
  </div>
  
  <!-- Input -->
  <div class="flex flex-row gap-x-2 bg-transparent mx-3 -translate-y-3">
    <input type="text" placeholder="Message" class="flex-1 input input-bordered" />
    <div class="btn btn-accent p-3">
      <Icon src="{PaperAirplane}" theme='solid' class='color-gray-900 object-contain aspect-square' />
    </div>
  </div>
</div>
