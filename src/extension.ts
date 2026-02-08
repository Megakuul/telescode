import { codeToHtml } from 'shiki';
import * as vscode from 'vscode';
import { rgPath } from 'vscode-ripgrep';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('telescode.helloWorld', () => {
      vscode.window.showInformationMessage('Hello World from Dong!');
      const panel = vscode.window.createWebviewPanel(
        'Overlay',
        'myOverlay',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
        },
      );
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
            <script type="module" src="${webUri}/web.mjs"></script>
          </head>
          <body>
            <div id="app"></div>
          </body>
        </html>
      `;
      panel.webview.onDidReceiveMessage(msg => {
        switch (msg.command) {
          case 'searchFile':
            vscode.window.showInformationMessage(msg.search);
            const kind = vscode.window.activeColorTheme.kind;
            const themeName = kind === vscode.ColorThemeKind.Dark ? 'min-dark' : 'min-light';
            (async () => {
              const file = await vscode.workspace.fs.readFile(
                vscode.Uri.file('/home/linus/Documents/repos/telescode/vite.config.ts'),
              );
              panel.webview.postMessage(
                await codeToHtml(file.toString(), {
                  lang: 'typescript',
                  theme: themeName,
                }),
              );
            })();
            return;
        }
      });
    }),
  );
}

export function deactivate() {}
