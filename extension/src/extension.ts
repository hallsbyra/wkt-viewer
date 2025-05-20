import * as vscode from 'vscode'
import { extractWkt } from './wkt.js'
import * as path from 'path'

export function activate(context: vscode.ExtensionContext) {
    console.log('Activating WKT Viewer extension')
    let currentPanel: vscode.WebviewPanel | undefined = undefined
    const savedShapes: string[] = []

    // Listen for text selection changes
    vscode.window.onDidChangeTextEditorSelection(event => {
        const editor = event.textEditor
        const selection = editor.document.getText(editor.selection)
        console.log('Selected text:', selection)

        if (currentPanel) {
            const wkt = extractWkt(selection)
            if (wkt.length > 0) {
                console.log('Sending WKT to webview:', wkt)
                currentPanel.webview.postMessage({ command: 'update', wkt })
            }
        }
    })

    // Register the command to open the WKT viewer
    const disposable = vscode.commands.registerCommand('wktViewer.start', () => {
        if (currentPanel) {
            currentPanel.reveal(currentPanel.viewColumn ?? vscode.ViewColumn.Beside)
        } else {
            const activeCol = vscode.window.activeTextEditor?.viewColumn
            const targetCol = activeCol !== undefined ? activeCol + 1 : vscode.ViewColumn.Beside
            currentPanel = vscode.window.createWebviewPanel(
                'wktViewer',
                'WKT Viewer',
                targetCol,
                {
                    enableScripts: true,
                    localResourceRoots: [
                        // vscode.Uri.file(path.join(context.extensionPath, 'webview', 'dist')),
                        // vscode.Uri.file(path.join(context.extensionPath, 'webview')),
                        // vscode.Uri.file(context.extensionPath),
                        context.extensionUri,
                    ]
                }
            )

            // Check if in development mode (set via launch.json or fallback)
            const isDevelopment = process.env.VSCODE_DEBUG === 'true' || process.env.NODE_ENV === 'development' || context.extensionMode === vscode.ExtensionMode.Development
            if (isDevelopment) {
                // currentPanel.webview.html = getProdWebviewContent(currentPanel.webview.cspSource, currentPanel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'webview', 'dist'))).toString())
                currentPanel.webview.html = getDevWebviewContent()
            } else {
                currentPanel.webview.html = getProdWebviewContent(currentPanel.webview.cspSource, currentPanel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'webview', 'dist'))).toString())
            }

            // Send a test message to the webview
            currentPanel.webview.postMessage({ command: 'test', message: 'Hello from the extension!' })

            // Handle messages from the webview
            currentPanel.webview.onDidReceiveMessage(
                message => {
                    switch (message.command) {
                        case 'save':
                            savedShapes.push(message.wkt)
                            vscode.window.showInformationMessage('Shape saved!')
                            break
                    }
                },
                undefined,
                context.subscriptions
            )

            currentPanel.onDidDispose(() => {
                console.log('Webview panel disposed')
                currentPanel = undefined
            }, null, context.subscriptions)
        }
    })

    context.subscriptions.push(disposable)
}

function getDevWebviewContent(): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" 
              content="default-src 'none'; 
              script-src http://localhost:3000 'unsafe-inline'; 
              style-src http://localhost:3000 'unsafe-inline'; 
              connect-src http://localhost:3000 ws://localhost:3000; 
              img-src data: https: http://localhost:3000 'self';">
      </head>
      <body>
        <div id="root"></div>
        <script type="module">
            import RefreshRuntime from "http://localhost:3000/@react-refresh"
            RefreshRuntime.injectIntoGlobalHook(window)
            window.$RefreshReg$ = () => {}
            window.$RefreshSig$ = () => (type) => type
            window.__vite_plugin_react_preamble_installed__ = true
        </script>
        <script type="module" src="http://localhost:3000/src/main.jsx"></script>
      </body>
      </html>
    `
}

function getProdWebviewContent(csp: string, uriBase: string): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta 
            http-equiv="Content-Security-Policy" 
            content="default-src 'none';
                     script-src 'self' vscode-resource:;
                     style-src 'self' vscode-resource:;
                     img-src 'self' vscode-resource:;">
        <link rel="stylesheet" type="text/css" href="${uriBase}/assets/index.css">                     
      </head>
      <body>
        <div id="root"></div>
        <script type="module" src="${uriBase}/assets/index.js"></script>
      </body>
      </html>
    `
}

export function deactivate() { }
