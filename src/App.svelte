<script lang="ts">
  import { codeToHtml } from 'shiki';
  import { findOne } from 'filename2shiki';
  import {
    listAction,
    listInput,
    previewAction,
    previewInput,
    rgMatch,
    selectAction,
    selectInput,
  } from './types';

  const vscode = acquireVsCodeApi();

  let previewCode = $state('');
  let previewFile = $state('');
  let previewLine = $state(0);

  let matches: rgMatch[] = $state([]);

  let searchBox: HTMLElement | undefined = $state();
  let search = $state('');
  let searchTimeout: ReturnType<typeof setTimeout>;
  $effect(() => {
    if (!search) return;
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      matches = [];
      previewCode = '';
      vscode.postMessage({
        type: listAction,
        data: {
          search: search,
        } satisfies listInput,
      });
    }, 100);
  });

  window.addEventListener('keydown', event => {
    if (event.key === 'Tab' && matches.length < 1) {
      searchBox?.focus();
      event.preventDefault();
    } else if (event.key.length === 1) {
      searchBox?.focus();
    }
  });

  window.addEventListener('message', event => {
    switch (event.data.type) {
      case listAction:
        matches = event.data.data.matches.slice(0, 10);
        preview();
        break;
      case previewAction:
        (async () => {
          if (!search) return;

          const code = event.data.data.code
            .toString()
            .split('\n')
            .slice(Math.max(previewLine - 10, 0), previewLine + 10)
            .join('\n');

          const decorations = [];
          let lastPos = 0;
          while ((lastPos = String(code).indexOf(search, lastPos)) !== -1) {
            decorations.push({
              start: lastPos,
              end: lastPos + search.length,
              properties: { class: 'highlighted-match' },
            });
            lastPos += search.length;
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
        })();
        break;
    }
  });

  function focus(node: HTMLElement) {
    node.focus();
  }

  function preview(file?: { path: string; line: number }) {
    if (!file) {
      if (matches.length > 0) {
        file = { path: matches[0].data.path.text, line: matches[0].data.line_number ?? 0 };
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

  function select(file?: { path: string; line: number; col: number }) {
    if (!file) {
      if (matches.length > 0) {
        file = {
          path: matches[0].data.path.text,
          line: matches[0].data.line_number ?? 0,
          col: matches[0].data.submatches?.[0]?.start ?? 0,
        };
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
</script>

<div class="w-full flex flex-col gap-4 items-center justify-center p-8">
  <pre class="h-100 w-full glass rounded-lg overflow-hidden" tabindex="-1" inert>
    {@html previewCode}
  </pre>
  <input
    type="text"
    class="w-full glass rounded-lg p-2 text-2xl outline-none"
    placeholder="Search"
    use:focus
    bind:this={searchBox}
    bind:value={search}
    onkeydown={e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        select();
      }
    }}
  />
  <ol class="flex flex-col gap-2 w-full h-full">
    {#each matches as match, i}
      <li>
        <button
          onfocus={() => preview({ path: match.data.path.text, line: match.data.line_number ?? 0 })}
          onclick={() =>
            select({
              path: match.data.path.text,
              line: match.data.line_number ?? 0,
              col: match.data.submatches?.[0]?.start ?? 0,
            })}
          class="w-full text-start glass p-2 rounded-lg focus:opacity-100 outline-none {i === 0
            ? 'opacity-60'
            : 'opacity-50'}"
        >
          {match.data.path.text}:{match.data.line_number}
        </button>
      </li>
    {/each}
  </ol>
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
