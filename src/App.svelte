<script>
  const vscode = acquireVsCodeApi();

  let preview = $state("")
  window.addEventListener("message", event => {
    preview = event.data
  })
</script>

<h1>This is a svelte extension</h1>
<button onclick={() => {
  vscode.postMessage({
    command: "searchFile",
    search: "settings"
  });
}}>Click Me</button>

<h2>Here is preview </h2>
<pre>
  {@html preview}
</pre>