<script lang="ts">
  import { goto } from "$app/navigation";
  import {
    UserGroup,
    GlobeAlt,
    ChatBubbleBottomCenter,
    User,
    Cog8Tooth,
    ArrowLeft,
    ArrowRightCircle,
    ArrowRightOnRectangle,
  } from "@steeze-ui/heroicons";
  import type { IconSource } from "@steeze-ui/heroicons/types";
  import { Icon } from "@steeze-ui/svelte-icon";
  import type { SvelteComponent } from "svelte";

  import ChatScreen from "$lib/components/ChatScreen.svelte";
  import MenuButton from "$lib/components/MenuButton.svelte";
  import { menuOpen } from "@src/lib/stores";
  import ChatMenu from "@src/lib/components/ChatMenu.svelte";
  import ChatParentScreen from "@src/lib/components/ChatParentScreen.svelte";
  import auth from "@src/lib/auth";

  function onMenuClick() {
    menuOpen.update((v) => !v);
  }

  let isMenuOpen: boolean;
  menuOpen.subscribe((v) => (isMenuOpen = v));

  export let menuSelected: ["top" | "bottom", number] = ["top", 0];

  let topMenus: MenuScreen[];
  let bottomMenus: MenuScreen[];
  $: topMenus = [
    {
      name: "chats",
      icon: ChatBubbleBottomCenter,
      menuComponent: ChatMenu,
      contentComponent: ChatParentScreen,
      type: "top",
    },
    {
      name: "groups",
      icon: UserGroup,
      menuComponent: undefined,
      contentComponent: undefined,
      type: "top",
    },
    {
      name: "globals",
      icon: GlobeAlt,
      menuComponent: undefined,
      contentComponent: undefined,
      type: "top",
    },
  ];
  $: bottomMenus = [
    {
      name: "user",
      icon: User,
      menuComponent: undefined,
      contentComponent: undefined,
      type: "bottom",
    },
    {
      name: "settings",
      icon: Cog8Tooth,
      menuComponent: undefined,
      contentComponent: undefined,
      type: "bottom",
    },
    {
      name: "logout",
      icon: ArrowRightOnRectangle,
      menuComponent: undefined,
      contentComponent: undefined,
      type: "bottom",
    },
  ];

  $: backButton = `h-[60px] w-full p-4 items-center justify-center bg-base-100 transition-all duration-200 ${
    menuSelected[0] == "top" && menuSelected[1] == 0 ? "rounded-br-2xl" : ""
  }`;

  let menuSelectedComponent: MenuScreen;
  $: menuSelectedComponent = (() =>
    (menuSelected[0] == "top" ? topMenus : bottomMenus)[menuSelected[1]])();
</script>

<div class="drawer drawer-mobile">
  <input
    id="friend-list"
    type="checkbox"
    class="drawer-toggle"
    checked={isMenuOpen}
  />
  <div class="drawer-content flex flex-col items-center justify-center">
    {#if menuSelectedComponent.contentComponent}
      <svelte:component this={menuSelectedComponent.contentComponent} />
    {/if}
  </div>
  <div class="drawer-side overflow-y-hidden">
    <label
      for="friend-list"
      class="drawer-overlay"
      on:click|preventDefault={onMenuClick}
      on:keypress={onMenuClick}
    />
    <div class="flex flex-row bg-base-300 text-base-content shadow-lg w-fit">
      <div class="flex flex-col w-14 bg-base-300 h-full">
        {#if menuOpen}
          <button
            class={`${backButton} hover:bg-base-100/50 active:bg-base-300 cursor-pointer`}
            on:click={onMenuClick}
          >
            <Icon src={ArrowLeft} theme="solid" class="color-gray-900" />
          </button>
        {:else}
          <div class={backButton} />
        {/if}
        {#each topMenus as menu, i}
          <MenuButton
            icon={menu.icon}
            {i}
            selectedI={menuSelected[0] == "top"
              ? menuSelected[1]
              : menuSelected[1] + 1 + topMenus.length}
            on:click={() => (menuSelected = ["top", i])}
          />
        {/each}
        <div
          class={`flex-1 bg-base-100 transition-all duration-200 ${
            menuSelected[0] == "top" && menuSelected[1] == topMenus.length - 1
              ? "rounded-tr-2xl"
              : menuSelected[0] == "bottom" && menuSelected[1] == 0
              ? "rounded-br-2xl"
              : ""
          }`}
        />
        {#each bottomMenus as menu, i}
          <MenuButton
            icon={menu.icon}
            i={i + 1}
            selectedI={menuSelected[0] == "bottom"
              ? menuSelected[1] + 1
              : menuSelected[1] - topMenus.length}
            on:click={async () => {
              if (menu.name == "logout") {
                await auth.logout();
              } else menuSelected = ["bottom", i];
            }}
          />
        {/each}
      </div>

      <div class="h-full w-64">
        {#if menuSelectedComponent.menuComponent}
          <svelte:component this={menuSelectedComponent.menuComponent} />
        {/if}
      </div>
    </div>
  </div>
</div>
