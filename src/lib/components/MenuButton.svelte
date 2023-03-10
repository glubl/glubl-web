<script lang="ts">
  import type { IconSource } from "@steeze-ui/heroicons/types";
  import { Icon } from "@steeze-ui/svelte-icon";

  export let icon: IconSource
  export let i: number
  export let selectedI: number
</script>

<button  
  class={`h-14 w-full p-4 items-center justify-center cursor-pointer active:bg-base-300 transition-all duration-200
    ${ i == selectedI ? "bg-base-300" : "hover:bg-base-100/50  bg-base-100"} 
    ${ i == selectedI - 1 ? "rounded-br-2xl" : i == selectedI + 1 ? "rounded-tr-2xl" : ""}
  `}
  on:click|preventDefault
>
  <Icon src={icon} theme="solid" class="color-gray-900" />
</button>