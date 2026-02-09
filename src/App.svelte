<script lang="ts">
  import {codeToHtml} from "shiki";
  import {findOne} from "filename2shiki"

  const vscode = acquireVsCodeApi();

  let previewCode = $state("")
  let previewFile = $state("")
  let previewLine = $state(0)

  let summary: any = $state(undefined)
  let command: string = $state("")
  let matches: any[] = $state([])

  let search = $state("")
  $effect(() => {
    if (!search) return
    vscode.postMessage({
      type: "list",
      data: {
        search: search
      }
    });
  })

  window.addEventListener("message", event => {
    switch (event.data.type) {
      case "list":
        summary = event.data.data.summary
        command = event.data.data.command
        matches = event.data.data.matches
        break;
      case "preview":
        (async () => {
          const highlighted = await codeToHtml(event.data.data.code, {
            lang: findOne(previewFile),
            theme: "catppuccin-macchiato",
          })
          previewCode = highlighted 
            .toString()
            .split('\n')
            .slice(Math.max(previewLine - 20, 0), previewLine + 20)
            .join('\n');
        })()
        break;
    }
  })

  function focus(node: HTMLElement) {
    node.focus()
  }

  function preview(file: string, line: number) {
    previewFile = file
    previewLine = line
    vscode.postMessage({
      type: "preview",
      data: {
        file: previewFile,
      }
    })
  }

  function select(file: string, line: number) {
    vscode.postMessage({
      type: "select",
      data: {
        file: file,
        line: line,
      }
    });
  }
</script>

<div class="w-full flex flex-col gap-4 items-center justify-center p-8">
  <pre class="h-1/3 w-full bg-slate-100/5 rounded-2xl overflow-hidden">
    {@html previewCode}
  </pre>
  <input class="w-full bg-slate-100/5 border-[1.5px] border-slate-50 rounded-xl p-2 text-2xl" placeholder="Search" use:focus bind:value={search} />
  <ol class="flex flex-col gap-2 w-full h-full">
    {#each matches as match}
      <li>
        <button onfocus={() => preview(match.data.path.text, match.data.line_number)} onclick={() => select(match.data.path.text, match.data.line_number)}
          class="w-full text-start bg-slate-100/5 p-2 rounded-xl border-[1.5px] border-slate-50/40 focus:border-slate-50">
          {match.data.path.text}:{match.data.line_number}
        </button>
      </li>
    {/each}
  </ol>
  <div class="flex flex-col">
    <p class="">{command}</p>
    {#if summary}
      <p class="">{summary.data.elapsed_total.human}</p>
      <p class="">{summary.data.stats.matches}/{summary.stats.searches}</p>
      <p class="">{summary.data.stats.bytes_searched} bytes</p>
    {/if}
  </div>
</div>