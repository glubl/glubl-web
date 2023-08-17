<script lang="ts">
    import { User } from "@steeze-ui/heroicons";
    import { Icon } from "@steeze-ui/svelte-icon";
    import CodeButton from "./CodeButton.svelte";
    import { myProfileStore } from "../stores";
    import { onDestroy } from "svelte";
    import type { Unsubscriber } from "svelte/store";

    export let profile: Profile;
    let myProfile = $myProfileStore!
    let profileUnsub: Unsubscriber = myProfileStore.subscribe(v => v && (myProfile = v))
    onDestroy(() => profileUnsub())
</script>
<div class="avatar">
    <div class="w-6 mask mask-squircle">
        {#if profile.picture}
        <img class="m-0" src={profile.picture} alt="" />
        {:else}
        <Icon src={User} theme="solid" class="text-secondary-content" />
        {/if}
    </div>
</div>
<div class="truncate w-full pb-0.5 text-left ml-2">
{#if profile.username}
    <div class="my-auto text-sm {myProfile.pub == profile.pub ? 'font-bold' : ''}">{profile.username}</div>
{:else if profile.pub}
    <CodeButton text={profile.pub} style={myProfile.pub == profile.pub ? "font-bold bg-base-100" : ""} />
{/if}
</div>