<script lang="ts">
  import { untrack } from 'svelte';
  import { codeToHtml } from 'shiki';
  import { findOne } from 'filename2shiki';
  import {
    listAction,
    listInput,
    listType as mode,
    match,
    previewAction,
    previewInput,
    previewOutput,
    selectAction,
    selectInput,
  } from './types';

  const vscode = acquireVsCodeApi();

  let previewCode = $state('');
  let previewFile = $state('');
  let previewLine = $state(0);

  let matches: match[] = $state([]);

  let search = $state('');
  let searchString = $state('');
  let searchMode: mode = $state('match');
  let searchTimeout: ReturnType<typeof setTimeout>;
  $effect(() => {
    searchString = search;
    const blocks = searchString.split(':', 2);
    if (blocks.length === 2) {
      switch (blocks[0]) {
        case 'r':
          searchMode = 'regex';
          searchString = blocks[1];
          break;
        case 'f':
          searchMode = 'file';
          searchString = blocks[1];
          break;
        case 'g':
          searchMode = 'global';
          searchString = blocks[1];
          break;
        default:
          searchMode = 'match';
          break;
      }
    } else searchMode = 'match';

    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      matches = [];
      command = '';
      previewCode = '';
      if (!searchString) return;
      vscode.postMessage({
        type: listAction,
        data: {
          mode: untrack(() => searchMode),
          search: untrack(() => searchString),
        } satisfies listInput,
      });
    }, 100);
  });

  async function highlightPreview(input: previewOutput) {
    if (!search) return;

    const code = input.code
      .toString()
      .split('\n')
      .slice(Math.max(previewLine - 10, 0), previewLine + 10)
      .join('\n');

    const decorations = [];
    switch (searchMode) {
      case 'match':
        let lastPos = 0;
        while ((lastPos = String(code).indexOf(searchString, lastPos)) !== -1) {
          decorations.push({
            start: lastPos,
            end: lastPos + searchString.length,
            properties: { class: 'highlighted-match' },
          });
          lastPos += searchString.length;
        }
        break;
      case 'regex':
        const r = new RegExp(searchString, 'g');
        let match;
        while ((match = r.exec(code)) !== null) {
          decorations.push({
            start: match.index,
            end: match.index + match[0].length,
            properties: { class: 'highlighted-match' },
          });
          if (match.index === r.lastIndex) {
            r.lastIndex++;
          }
        }
        break;
    }
    const highlighted = await codeToHtml(code, {
      lang: findOne(previewFile),
      themes: {
        light: 'catppuccin-macchiato',
        dark: 'catppuccin-macchiato',
      },
      decorations: decorations,
    });
    previewCode = highlighted;
  }

  let command = $state('');

  window.addEventListener('message', event => {
    switch (event.data.type) {
      case listAction:
        matches = event.data.data.matches.slice(0, 10);
        command = event.data.data.command;
        preview();
        break;
      case previewAction:
        highlightPreview(event.data.data);
        break;
    }
  });

  function preview(file?: match) {
    if (!file) {
      if (matches.length > 0) {
        file = matches[0];
      } else return;
    }
    previewFile = file.path;
    previewLine = file.line;
    vscode.postMessage({
      type: previewAction,
      data: {
        file: previewFile,
      } satisfies previewInput,
    });
  }

  function select(file?: match) {
    if (!file) {
      if (matches.length > 0) {
        file = matches[0];
      } else return;
    }
    vscode.postMessage({
      type: selectAction,
      data: {
        file: file.path,
        line: file.line,
        column: file.col,
      } satisfies selectInput,
    });
  }

  let searchBox: HTMLElement | undefined = $state();

  window.addEventListener('keydown', event => {
    if (event.key === 'Tab' && matches.length < 1) {
      searchBox?.focus();
      event.preventDefault();
    } else if (event.key.length === 1 || event.key === 'Backspace') {
      searchBox?.focus();
    }
  });

  function focus(node: HTMLElement) {
    node.focus();
  }
</script>

<div class="w-full min-h-screen flex flex-col gap-4 items-center justify-center p-8">
  <pre class="h-100 w-full glass rounded-lg overflow-hidden" tabindex="-1" inert>
    {@html previewCode}
  </pre>
  <div class="w-full relative">
    {#if searchMode === 'match'}
      <p
        class="absolute top-1/2 translate-y-[-50%] glass p-2 rounded-sm right-3 z-10 text-indigo-500/80"
      >
        match
      </p>
    {:else if searchMode === 'regex'}
      <p
        class="absolute top-1/2 translate-y-[-50%] glass p-2 rounded-sm right-3 z-10 text-emerald-600/80"
      >
        regex
      </p>
    {:else if searchMode === 'file'}
      <p
        class="absolute top-1/2 translate-y-[-50%] glass p-2 rounded-sm right-3 z-10 text-amber-400/80"
      >
        file
      </p>
    {:else if searchMode === 'global'}
      <p
        class="absolute top-1/2 translate-y-[-50%] glass p-2 rounded-sm right-3 z-10 text-orange-500/80"
      >
        global
      </p>
    {/if}
    <input
      type="text"
      class="w-full glass rounded-lg p-2 text-2xl outline-none"
      placeholder="Search ('r:' regex 'f:' file 'g:' global file)"
      use:focus
      bind:this={searchBox}
      bind:value={search}
      onfocus={(e: any) => {
        e.target.setSelectionRange(e.target.value.length, e.target.value.length);
      }}
      onkeydown={e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          select();
        } else if (e.key === 'Tab' && e.shiftKey) {
          e.preventDefault(); // prevent vscode from escaping to its outer shell when tabbing
        }
      }}
    />
  </div>
  <ol class="flex flex-col gap-2 w-full h-full">
    {#each matches as match, i}
      <li>
        <button
          onfocus={() => preview(match)}
          onclick={() =>
            select({
              path: match.path,
              line: match.line,
              col: match.col,
            })}
          class="w-full text-start glass p-2 rounded-lg focus:opacity-100 outline-none {i === 0
            ? 'opacity-60'
            : 'opacity-50'}"
        >
          {match.path}{#if match.line}:{match.line}{/if}
        </button>
      </li>
    {/each}
  </ol>

  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <p
    onkeydown={e => {
      e.preventDefault();
      searchBox?.focus(); // stop vscode from escaping to its outer shell with the tabs
    }}
    tabindex="0"
    class="mt-auto text-slate-100/40 outline-none"
  >
    {command}
  </p>
</div>

<style>
  .glass {
    box-shadow:
      rgba(255, 255, 255, 0.05) 0px 6px 24px 0px,
      rgba(255, 255, 255, 0.08) 0px 0px 0px 1px;
    background-color: rgba(255, 255, 255, 0.01);
    backdrop-filter: blur(2px);
  }
  :global(.highlighted-match) {
    background-color: rgb(134, 64, 20, 0.7);
  }
  :global(pre.shiki) {
    padding: 1rem;
    overflow-x: auto;
    background-color: transparent !important;
  }
  :global(pre.shiki code) {
    background-color: transparent !important;
    padding: 0 !important;
    border: none !important;
    min-width: 100%;
  }
</style>
