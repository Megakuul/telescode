import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import * as vscode from 'vscode';
import {
  listAction,
  listInput,
  listOutput,
  match,
  previewAction,
  previewInput,
  previewOutput,
  selectAction,
  selectInput,
} from './types.js';
import path, { resolve } from 'node:path';
import { Grep } from './grep.js';
import { Find } from './find.js';

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
      let activeChild: ChildProcessWithoutNullStreams | null = null;
      panel.webview.onDidReceiveMessage(msg => {
        switch (msg.type) {
          case listAction:
            if (activeChild) {
              activeChild.removeAllListeners();
              activeChild.stdout.removeAllListeners();
              activeChild.stderr.removeAllListeners();
              activeChild.kill('SIGKILL');
            }
            const input: listInput = msg.data;
            switch (input.mode) {
              case 'match':
                activeChild = list(
                  panel,
                  new Grep(
                    input.search,
                    searchPath.fsPath,
                    false,
                    config.get<string>('rgPath'),
                    10,
                  ),
                );
                break;
              case 'regex':
                activeChild = list(
                  panel,
                  new Grep(input.search, searchPath.fsPath, true, config.get<string>('rgPath'), 10),
                );
                break;
              case 'file':
                activeChild = list(
                  panel,
                  new Find(input.search, searchPath.fsPath, false, config.get<string>('fdPath')),
                );
                break;
              case 'global':
                activeChild = list(
                  panel,
                  new Find(input.search, searchPath.fsPath, true, config.get<string>('fdPath')),
                );
                break;
            }
            break;
          case previewAction:
            preview(panel, searchPath.fsPath, msg.data);
            break;
          case selectAction:
            select(panel, searchPath.fsPath, msg.data);
            break;
        }
      });
    }),
  );
}

export function deactivate() {}

interface engine {
  start(): ChildProcessWithoutNullStreams;
  process(input: string): boolean;
  results(): match[];
}

function list(panel: vscode.WebviewPanel, engine: engine): ChildProcessWithoutNullStreams {
  const proc = engine.start();
  proc.on('error', async err => {
    vscode.window.showErrorMessage(`node process failure: ${err}`);
  });
  proc.stderr.on('data', async err => {
    vscode.window.showErrorMessage(`telescode failure: ${err}`);
  });

  proc.stdout.on('data', async stdout => {
    try {
      if (!engine.process(stdout.toString())) {
        proc.kill('SIGKILL');
      }
    } catch (err) {
      vscode.window.showErrorMessage(`telescode failure: ${err}`);
    }
  });
  proc.on('close', async code => {
    panel.webview.postMessage({
      type: listAction,
      data: {
        command: `${proc?.spawnargs.join(' ')}`,
        matches: engine.results(),
      } satisfies listOutput,
    });
  });
  return proc;
}

async function preview(panel: vscode.WebviewPanel, searchPath: string, data: previewInput) {
  if (!data) return;
  try {
    let filepath = vscode.Uri.file(data.file);
    if (!data.file.startsWith('/')) {
      filepath = vscode.Uri.joinPath(vscode.Uri.file(searchPath), data.file);
    }
    const filestat = await vscode.workspace.fs.stat(filepath);
    if (filestat.size > 10_000_000) {
      panel.webview.postMessage({
        type: previewAction,
        data: {
          code: '# file is too fat for preview 🍟',
        } satisfies previewOutput,
      });
    } else {
      panel.webview.postMessage({
        type: previewAction,
        data: {
          code: (await vscode.workspace.fs.readFile(filepath)).toString(),
        } satisfies previewOutput,
      });
    }
  } catch (err: any) {
    vscode.window.showWarningMessage(`preview failed: ${err}`);
  }
}

async function select(panel: vscode.WebviewPanel, searchPath: string, data: selectInput) {
  try {
    let filepath = vscode.Uri.file(data.file);
    if (!data.file.startsWith('/')) {
      filepath = vscode.Uri.joinPath(vscode.Uri.file(searchPath), data.file);
    }
    const doc = await vscode.workspace.openTextDocument(filepath);
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
