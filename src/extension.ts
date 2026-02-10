import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import * as vscode from 'vscode';
import {
  listAction,
  listInput,
  listOutput,
  previewAction,
  previewInput,
  previewOutput,
  rgMatch,
  selectAction,
  selectInput,
} from './types.js';
import path, { resolve } from 'node:path';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('telescode.open', () => {
      const config = vscode.workspace.getConfiguration('telescode');
      const panel = vscode.window.createWebviewPanel(
        'Telescode',
        'Telescode',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
        },
      );

      let searchPath = vscode.Uri.file('.');
      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor) {
        searchPath = vscode.Uri.file(path.dirname(activeEditor.document.uri.fsPath));
      }
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
          case listAction:
            list(config, panel, rgState, searchPath, msg.data);
            break;
          case previewAction:
            preview(panel, searchPath, msg.data);
            break;
          case selectAction:
            select(panel, searchPath, msg.data);
            break;
        }
      });
    }),
  );
}

export function deactivate() {}

async function list(
  config: vscode.WorkspaceConfiguration,
  panel: vscode.WebviewPanel,
  rgState: { proc: ChildProcessWithoutNullStreams | null },
  searchPath: vscode.Uri,
  data: listInput,
) {
  if (rgState.proc) {
    rgState.proc.removeAllListeners();
    rgState.proc.stdout.removeAllListeners();
    rgState.proc.stderr.removeAllListeners();
    rgState.proc.kill('SIGKILL');
  }

  rgState.proc = spawn(
    config.get<string>('rgPath') || 'rg',
    [
      '--json',
      '--no-messages',
      '--smart-case',
      '--max-filesize=1M',
      '-m=5',
      '-F',
      '--',
      data.search,
      '.',
    ],
    {
      cwd: searchPath.fsPath,
    },
  );

  rgState.proc.on('error', async err => {
    vscode.window.showErrorMessage(`node process failure: ${err}`);
  });
  rgState.proc.stderr.on('data', async err => {
    vscode.window.showErrorMessage(`telescode failure: ${err}`);
  });

  let outputBuffer = '';
  const matches: rgMatch[] = [];
  rgState.proc.stdout.on('data', async stdout => {
    outputBuffer += stdout.toString();
    const lines: string[] = outputBuffer.split('\n');
    if (lines.length < 2) {
      return;
    }
    if (matches.length > (config.get<number>('maxResults') ?? 20)) {
      rgState.proc?.kill('SIGKILL');
      return;
    }

    outputBuffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsedEntry: any = JSON.parse(line);
        if (parsedEntry.type === 'match') matches.push(parsedEntry);
      } catch (err: any) {
        vscode.window.showErrorMessage(err.cause);
      }
    }
  });
  rgState.proc.on('close', async code => {
    panel.webview.postMessage({
      type: listAction,
      data: {
        command: `${rgState.proc?.spawnargs.join(' ')}`,
        matches: matches,
      } satisfies listOutput,
    });
  });
}

async function preview(panel: vscode.WebviewPanel, searchPath: vscode.Uri, data: previewInput) {
  try {
    panel.webview.postMessage({
      type: previewAction,
      data: {
        code: (
          await vscode.workspace.fs.readFile(vscode.Uri.joinPath(searchPath, data.file))
        ).toString(),
        theme: vscode.window.activeColorTheme.kind.toString(),
      } satisfies previewOutput,
    });
  } catch (err: any) {
    vscode.window.showErrorMessage(`preview failed: ${err}`);
  }
}

async function select(panel: vscode.WebviewPanel, searchPath: vscode.Uri, data: selectInput) {
  try {
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(searchPath, data.file));
    const position = new vscode.Position(data.line - 1, data.column);
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
