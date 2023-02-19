<script lang="ts">
  export let user1: User | undefined;
  export let user2: User | undefined;
</script>

<div class="rounded-2xl h-full bg-base-300">
  <div class="flex flex-row w-full h-full justify-evenly py-2">
    <!-- This user -->
    <div class="h-full-w-full flex flex-col justify-end">
      <div class="card h-full w-32 mask mask-circle place-content-center">
        <img src={user1?.profilePicture} alt="{user1?.name} profile picture" />
      </div>
      <div class="text-center">{user1?.name}</div>
    </div>
    <div class="divider divider-horizontal">in call</div>

    <!-- Friend user -->
    <div class="h-full-w-full flex flex-col justify-end">
      <div class="card h-full w-32 mask mask-circle place-content-center">
        <img src={user2?.profilePicture} alt="{user2?.name} profile picture" />
      </div>
      <div class="text-center">{user2?.name}</div>
    </div>
  </div>
</div>
