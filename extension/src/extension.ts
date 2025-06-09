import * as vscode from 'vscode'
import { extractWkt } from './wkt.js'
import * as path from 'path'
import { MsgFromWebview, MsgToWebview } from './public-types.js'

const MAX_WKTS = 500

export function activate(context: vscode.ExtensionContext) {
    console.log('Activating WKT Viewer extension')
    let currentPanel: vscode.WebviewPanel | undefined = undefined
    let lastTextEditor: vscode.TextEditor | undefined = undefined

    vscode.workspace.onDidChangeTextDocument(event => {
        if (currentPanel && event.document === vscode.window.activeTextEditor?.document) {
            postAllWkt(currentPanel, event.document)
        }
    })

    vscode.window.onDidChangeActiveTextEditor(editor => {
        if (currentPanel && editor) {
            lastTextEditor = editor
            postAllWkt(currentPanel, editor.document)
        }
    })

    vscode.window.onDidChangeTextEditorSelection(event => {
        if (currentPanel && event.textEditor === vscode.window.activeTextEditor) {
            const selection = event.selections[0]
            const start = event.textEditor.document.offsetAt(selection.start)
            const end = event.textEditor.document.offsetAt(selection.end)
            postMessageToWebview(currentPanel, { command: 'select', start, end, line: selection.start.line })
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
                        context.extensionUri,
                    ]
                }
            )

            // Check if in development mode (set via launch.json or fallback)
            const isDevelopment = process.env.VSCODE_DEBUG === 'true' || process.env.NODE_ENV === 'development' || context.extensionMode === vscode.ExtensionMode.Development
            if (isDevelopment) {
                currentPanel.webview.html = getDevWebviewContent()
            } else {
                currentPanel.webview.html = getProdWebviewContent(currentPanel.webview.cspSource, currentPanel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'webview', 'dist'))).toString())
            }

            // Handle messages from the webview
            currentPanel.webview.onDidReceiveMessage(
                (message: MsgFromWebview) => {
                    console.log('Webview message received', message)
                    if (message.command === 'select') {
                        selectTextInEditor(lastTextEditor, message.start, message.end)
                    } else {
                        console.warn(`Unknown message command: ${message.command}`)
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

function postAllWkt(panel: vscode.WebviewPanel, document: vscode.TextDocument) {
    const allText = document.getText()
    const wktArr = extractWkt(allText, MAX_WKTS)
    postMessageToWebview(panel, { command: 'update', wkt: wktArr })
}

function selectTextInEditor(editor: vscode.TextEditor | undefined, start: number, end: number) {
    if (!editor) return

    // Convert offsets to Positions
    const doc = editor.document
    const startPos = doc.positionAt(start)
    const endPos = doc.positionAt(end)

    // Create a Range
    const range = new vscode.Range(startPos, endPos)

    // Select the range and reveal it
    editor.selection = new vscode.Selection(startPos, endPos)
    editor.revealRange(range, vscode.TextEditorRevealType.InCenter)
}

function postMessageToWebview(panel: vscode.WebviewPanel, message: MsgToWebview) {
    console.log('Posting message to webview:', message)
    if (panel && panel.webview) {
        panel.webview.postMessage(message)
    } else {
        console.warn('Webview panel is not available')
    }
}