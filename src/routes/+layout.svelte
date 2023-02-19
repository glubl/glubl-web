<script>
  import { protectedRedirect } from "@src/lib/auth";
  import "../style.css";
  protectedRedirect();
</script>

<div
  class="h-screen w-full bg-dotted from-base-300 to-base-100 flex flex-col items-center justify-center"
  style="background-size: 5px 5px;"
>
  <slot />
</div>
