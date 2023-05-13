<script lang="ts">
  import { menuOpen } from "../stores";
  import { Bars3 } from "@steeze-ui/heroicons";
  import { Icon } from "@steeze-ui/svelte-icon";

  function onMenuClick() {
    menuOpen.update((v) => !v);
  }
</script>

<div
  class="h-fit w-fit btn btn-outline btn-base btn-sm drawer-button lg:hidden p-2 !outline-none !border-none"
  on:click={onMenuClick}
  on:keypress
>
  <Icon src={Bars3} theme="solid" class="color-gray-900 w-6 h-6" />
</div>
