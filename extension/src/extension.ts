import * as vscode from 'vscode'
import { type MsgFromWebview, type MsgToWebview, type SourceDocument, type ViewingScope } from '@wkt-viewer/shared'
import { filterTokensForScope, updateScopeForChanges } from './scope.js'
import { extractWkt } from './wkt.js'

export const DEFAULT_MAX_GEOMETRIES = 500
const SETTINGS_SECTION = 'wktViewer'
const MAX_GEOMETRIES_SETTING = 'maxGeometries'

export function activate(context: vscode.ExtensionContext) {
    let currentPanel: vscode.WebviewPanel | undefined
    let lastTextEditor: vscode.TextEditor | undefined
    let displayedDocumentUri: string | undefined
    let fitId = 0
    const scopes = new Map<string, ViewingScope>()

    const currentEditor = () => lastTextEditor ?? vscode.window.activeTextEditor
    const scopeFor = (document: vscode.TextDocument): ViewingScope =>
        scopes.get(document.uri.toString()) ?? { kind: 'document' }

    const postCurrent = (document: vscode.TextDocument, forceFit = false) => {
        if (!currentPanel) return

        const editor = currentEditor()
        const scope = scopeFor(document)
        const selection = editor?.document === document ? editor.selections[0] : undefined
        const captureAvailable = selection !== undefined && !selection.isEmpty
        const areaLineRange = getAreaLineRange(document, scope)
        const tokens = filterTokensForScope(extractWkt(document.getText()), scope, getMaxGeometries())

        postMessageToWebview(currentPanel, {
            command: 'update',
            wkt: tokens,
            source: sourceFor(document),
            scope,
            captureAvailable,
            areaLineRange,
            fitId: forceFit ? ++fitId : fitId,
        })
        displayedDocumentUri = document.uri.toString()
    }

    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(event => {
            const key = event.document.uri.toString()
            const previousScope = scopes.get(key)
            if (previousScope) {
                scopes.set(key, updateScopeForChanges(previousScope, event.contentChanges))
            }

            if (currentPanel && currentEditor()?.document === event.document) {
                postCurrent(event.document)
            }
        }),
        vscode.workspace.onDidCloseTextDocument(document => scopes.delete(document.uri.toString())),
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (!currentPanel || !editor) return

            lastTextEditor = editor
            const changedDocument = displayedDocumentUri !== editor.document.uri.toString()
            postCurrent(editor.document, changedDocument)
        }),
        vscode.window.onDidChangeTextEditorSelection(event => {
            if (!currentPanel || event.textEditor !== currentEditor()) return

            lastTextEditor = event.textEditor
            const selection = event.selections[0]
            const document = event.textEditor.document
            postMessageToWebview(currentPanel, {
                command: 'select',
                source: sourceFor(document),
                start: document.offsetAt(selection.start),
                end: document.offsetAt(selection.end),
                captureAvailable: !selection.isEmpty,
            })
        }),
        vscode.workspace.onDidChangeConfiguration(event => {
            if (!event.affectsConfiguration(`${SETTINGS_SECTION}.${MAX_GEOMETRIES_SETTING}`)) return

            const editor = currentEditor()
            if (editor) postCurrent(editor.document)
        }),
        vscode.commands.registerCommand('wktViewer.start', () => {
            if (currentPanel) {
                currentPanel.reveal(currentPanel.viewColumn ?? vscode.ViewColumn.Beside)
                return
            }

            lastTextEditor = vscode.window.activeTextEditor
            const targetColumn = lastTextEditor?.viewColumn !== undefined
                ? lastTextEditor.viewColumn + 1
                : vscode.ViewColumn.Beside
            currentPanel = vscode.window.createWebviewPanel('wktViewer', 'WKT Viewer', targetColumn, {
                enableScripts: true,
                localResourceRoots: [context.extensionUri],
            })

            setWebviewContent(currentPanel, context)
            currentPanel.webview.onDidReceiveMessage(message => {
                handleWebviewMessage(message, currentPanel, currentEditor(), scopes, postCurrent)
            }, undefined, context.subscriptions)
            currentPanel.onDidDispose(() => {
                currentPanel = undefined
                displayedDocumentUri = undefined
            }, null, context.subscriptions)
        })
    )
}

function handleWebviewMessage(
    message: MsgFromWebview,
    panel: vscode.WebviewPanel | undefined,
    editor: vscode.TextEditor | undefined,
    scopes: Map<string, ViewingScope>,
    postCurrent: (document: vscode.TextDocument, forceFit?: boolean) => void,
) {
    if (!panel || !editor) return

    const source = sourceFor(editor.document)
    if ('source' in message && !isCurrentSource(message, source)) return

    if (message.command === 'ready') {
        postCurrent(editor.document, true)
    } else if (message.command === 'select') {
        selectTextInEditor(editor, message.start, message.end)
    } else if (message.command === 'captureArea') {
        const selection = editor.selections[0]
        if (selection.isEmpty) return

        scopes.set(source.uri, {
            kind: 'area',
            start: editor.document.offsetAt(selection.start),
            end: editor.document.offsetAt(selection.end),
        })
        postCurrent(editor.document, true)
    } else if (message.command === 'showDocument') {
        scopes.delete(source.uri)
        postCurrent(editor.document, true)
    } else if (message.command === 'fitAll') {
        postCurrent(editor.document, true)
    }
}

function sourceFor(document: vscode.TextDocument): SourceDocument {
    return {
        uri: document.uri.toString(),
        version: document.version,
        filename: document.uri.path.split('/').pop() ?? document.fileName,
    }
}

function isCurrentSource(message: Exclude<MsgFromWebview, { command: 'ready' }>, source: SourceDocument) {
    return message.source.uri === source.uri
        && (message.command !== 'select' || message.source.version === source.version)
}

function getAreaLineRange(document: vscode.TextDocument, scope: ViewingScope) {
    if (scope.kind !== 'area') return undefined

    return {
        start: document.positionAt(scope.start).line + 1,
        end: document.positionAt(Math.max(scope.start, scope.end - 1)).line + 1,
    }
}

function setWebviewContent(panel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
    const isDevelopment = process.env.VSCODE_DEBUG === 'true'
        || process.env.NODE_ENV === 'development'
        || context.extensionMode === vscode.ExtensionMode.Development

    if (isDevelopment) {
        panel.webview.html = getDevWebviewContent()
        return
    }

    const webviewDistUri = vscode.Uri.joinPath(context.extensionUri, 'webview', 'dist')
    const styleUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(webviewDistUri, 'assets', 'index.css')).toString()
    const scriptUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(webviewDistUri, 'assets', 'index.js')).toString()
    panel.webview.html = getProdWebviewContent(panel.webview.cspSource, styleUri, scriptUri)
}

function getDevWebviewContent(): string {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="Content-Security-Policy"
                content="default-src 'none'; script-src http://localhost:3000 'unsafe-inline'; style-src http://localhost:3000 'unsafe-inline'; connect-src http://localhost:3000 ws://localhost:3000; img-src data: https: http://localhost:3000 'self';">
        </head>
        <body>
            <div id="root"></div>
            <script type="module" src="http://localhost:3000/src/main.tsx"></script>
        </body>
        </html>
    `
}

export function getProdWebviewContent(cspSource: string, styleUri: string, scriptUri: string): string {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="Content-Security-Policy"
                content="default-src 'none'; script-src ${cspSource}; style-src ${cspSource} 'unsafe-inline'; img-src ${cspSource} data: https:;">
            <link rel="stylesheet" type="text/css" href="${styleUri}">
        </head>
        <body>
            <div id="root"></div>
            <script type="module" src="${scriptUri}"></script>
        </body>
        </html>
    `
}

function getMaxGeometries(): number {
    const configured = vscode.workspace.getConfiguration(SETTINGS_SECTION).get<number>(MAX_GEOMETRIES_SETTING)
    return normalizeMaxGeometries(configured)
}

export function normalizeMaxGeometries(value: unknown): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) {
        return DEFAULT_MAX_GEOMETRIES
    }
    return Math.floor(value)
}

function selectTextInEditor(editor: vscode.TextEditor, start: number, end: number) {
    const startPosition = editor.document.positionAt(start)
    const endPosition = editor.document.positionAt(end)
    const range = new vscode.Range(startPosition, endPosition)
    editor.selection = new vscode.Selection(startPosition, endPosition)
    editor.revealRange(range, vscode.TextEditorRevealType.InCenter)
}

function postMessageToWebview(panel: vscode.WebviewPanel, message: MsgToWebview) {
    void panel.webview.postMessage(message)
}

export function deactivate() { }
