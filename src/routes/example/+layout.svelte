<script context="module">
  import { protectedRedirect, user } from "@lib/auth";

  if (!user.is) {
    protectedRedirect();
  }
</script>

<slot />
