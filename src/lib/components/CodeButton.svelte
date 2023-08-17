<script lang="ts">
    export let text = ""
    export let style: string = "bg-base-300"
</script>
<button
    on:click={() => navigator.clipboard.writeText(text||'')}
    class="my-1 px-2 py-1 min-w-0 flex rounded-lg {style} h-fit translate-y-[1px] text-sm"
>
    <code class="truncate max-w-fit text-xs">{text||''}</code>
</button>