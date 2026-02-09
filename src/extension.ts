import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('telescode.open', () => {
      const panel = vscode.window.createWebviewPanel(
        'Telescode',
        'Telescode',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
        },
      );

      let searchPath = vscode.Uri.file('/');
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (workspaceFolders && workspaceFolders.length > 0) {
        searchPath = workspaceFolders[0].uri;
      }
      const webUri = panel.webview.asWebviewUri(
        vscode.Uri.joinPath(context.extensionUri, 'dist', 'web'),
      );
      panel.webview.html = `
        <!doctype html>
        <html lang="en">
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <link rel="stylesheet" href="${webUri}/web.css" />
            <script type="module" src="${webUri}/web.js"></script>
          </head>
          <body>
            <div id="app"></div>
          </body>
        </html>
      `;
      const rgState: { proc: ChildProcessWithoutNullStreams | null } = { proc: null };
      panel.webview.onDidReceiveMessage(msg => {
        switch (msg.type) {
          case 'list':
            list(panel, rgState, searchPath, msg.data);
            break;
          case 'preview':
            preview(panel, searchPath, msg.data);
            break;
          case 'select':
            select(panel, searchPath, msg.data);
            break;
        }
      });
    }),
  );
}

export function deactivate() {}

interface listData {
  search: string;
}

async function list(
  panel: vscode.WebviewPanel,
  rgState: { proc: ChildProcessWithoutNullStreams | null },
  searchPath: vscode.Uri,
  data: listData,
) {
  if (rgState.proc) {
    rgState.proc.kill('SIGKILL');
  }

  let outputBuffer = '';
  rgState.proc = spawn(
    'rg',
    ['--json', '--no-messages', '--max-filesize=1M', '-M=1', '-F', data.search, searchPath.fsPath],
    {
      cwd: searchPath.fsPath,
    },
  );

  rgState.proc.on('close', async code => {
    let summary;
    const matches = [];
    for (const entry of outputBuffer.trim().split('\n')) {
      if (!entry) continue;
      try {
        const parsedEntry = JSON.parse(entry);
        switch (parsedEntry.type) {
          case 'match':
            if (matches.length > 20) continue;
            matches.push(parsedEntry);
            break;
          case 'summary':
            summary = parsedEntry;
            break;
          default:
            continue;
        }
      } catch (err: any) {
        vscode.window.showErrorMessage(err.cause);
      }
    }
    panel.webview.postMessage({
      type: 'list',
      data: {
        summary: summary,
        command: `${rgState.proc?.spawnargs.join(' ')}`,
        matches: matches,
      },
    });
  });
  rgState.proc.on('error', async err => {
    vscode.window.showErrorMessage(`node process failure: ${err}`);
  });
  rgState.proc.stderr.on('data', async err => {
    vscode.window.showErrorMessage(`telescode failure: ${err}`);
  });
  rgState.proc.stdout.on('data', async stdout => {
    outputBuffer += stdout.toString();
  });
}

interface previewData {
  file: string;
}

async function preview(panel: vscode.WebviewPanel, searchPath: vscode.Uri, data: previewData) {
  try {
    panel.webview.postMessage({
      type: 'preview',
      data: {
        code: (
          await vscode.workspace.fs.readFile(vscode.Uri.joinPath(searchPath, data.file))
        ).toString(),
        theme: vscode.window.activeColorTheme.kind.toString(),
      },
    });
  } catch (err: any) {
    vscode.window.showErrorMessage(`preview failed: ${err}`);
  }
}

interface selectData {
  file: string;
  line: number;
}

async function select(panel: vscode.WebviewPanel, searchPath: vscode.Uri, data: selectData) {
  try {
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(searchPath, data.file));
    const position = new vscode.Position(data.line, 0);
    await vscode.window.showTextDocument(doc, {
      selection: new vscode.Selection(position, position),
      preview: false,
      viewColumn: panel.viewColumn,
    });
    panel.dispose();
  } catch (err: any) {
    vscode.window.showErrorMessage(`select failed: ${err}`);
  }
}
