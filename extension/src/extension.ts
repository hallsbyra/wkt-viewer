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
    const scopes = new Map<string, ViewingScope>()
    let fitId = 0

    const currentEditor = () => lastTextEditor ?? vscode.window.activeTextEditor
    const sourceFor = (document: vscode.TextDocument): SourceDocument => ({ uri: document.uri.toString(), version: document.version, filename: document.uri.path.split('/').pop() ?? document.fileName })
    const scopeFor = (document: vscode.TextDocument): ViewingScope => scopes.get(document.uri.toString()) ?? { kind: 'document' }
    const postCurrent = (document: vscode.TextDocument, forceFit = false) => {
        if (!currentPanel) return
        const editor = currentEditor()
        const scope = scopeFor(document)
        const selection = editor?.document === document ? editor.selections[0] : undefined
        const captureAvailable = selection !== undefined && !selection.isEmpty
        const areaLineRange = scope.kind === 'area' ? { start: document.positionAt(scope.start).line + 1, end: document.positionAt(Math.max(scope.start, scope.end - 1)).line + 1 } : undefined
        const wkt = filterTokensForScope(extractWkt(document.getText()), scope, getMaxGeometries())
        postMessageToWebview(currentPanel, { command: 'update', wkt, source: sourceFor(document), scope, captureAvailable, areaLineRange, fitId: forceFit ? ++fitId : fitId })
    }

    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(event => {
            const key = event.document.uri.toString()
            const oldScope = scopes.get(key)
            if (oldScope) scopes.set(key, updateScopeForChanges(oldScope, event.contentChanges))
            if (currentPanel && currentEditor()?.document === event.document) postCurrent(event.document)
        }),
        vscode.workspace.onDidCloseTextDocument(document => scopes.delete(document.uri.toString())),
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (!currentPanel || !editor) return
            lastTextEditor = editor
            postCurrent(editor.document, true)
        }),
        vscode.window.onDidChangeTextEditorSelection(event => {
            if (!currentPanel || event.textEditor !== currentEditor()) return
            lastTextEditor = event.textEditor
            const selection = event.selections[0]
            const document = event.textEditor.document
            // Send the state update first so the following selection always wins in the webview.
            postCurrent(document)
            postMessageToWebview(currentPanel, { command: 'select', source: sourceFor(document), start: document.offsetAt(selection.start), end: document.offsetAt(selection.end), line: selection.start.line })
        }),
        vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration(`${SETTINGS_SECTION}.${MAX_GEOMETRIES_SETTING}`)) {
                const editor = currentEditor()
                if (editor) postCurrent(editor.document)
            }
        }),
        vscode.commands.registerCommand('wktViewer.start', () => {
            if (currentPanel) { currentPanel.reveal(currentPanel.viewColumn ?? vscode.ViewColumn.Beside); return }
            if (vscode.window.activeTextEditor) lastTextEditor = vscode.window.activeTextEditor
            const targetCol = lastTextEditor?.viewColumn !== undefined ? lastTextEditor.viewColumn + 1 : vscode.ViewColumn.Beside
            currentPanel = vscode.window.createWebviewPanel('wktViewer', 'WKT Viewer', targetCol, { enableScripts: true, localResourceRoots: [context.extensionUri] })
            const isDevelopment = process.env.VSCODE_DEBUG === 'true' || process.env.NODE_ENV === 'development' || context.extensionMode === vscode.ExtensionMode.Development
            if (isDevelopment) currentPanel.webview.html = getDevWebviewContent()
            else {
                const dist = vscode.Uri.joinPath(context.extensionUri, 'webview', 'dist')
                currentPanel.webview.html = getProdWebviewContent(currentPanel.webview.cspSource, currentPanel.webview.asWebviewUri(vscode.Uri.joinPath(dist, 'assets', 'index.css')).toString(), currentPanel.webview.asWebviewUri(vscode.Uri.joinPath(dist, 'assets', 'index.js')).toString())
            }
            currentPanel.webview.onDidReceiveMessage((message: MsgFromWebview) => {
                const editor = currentEditor()
                if (!editor || !currentPanel) return
                const source = sourceFor(editor.document)
                if ('source' in message && (message.source.uri !== source.uri || (message.command === 'select' && message.source.version !== source.version))) return
                if (message.command === 'ready') postCurrent(editor.document, true)
                else if (message.command === 'select') selectTextInEditor(editor, message.start, message.end)
                else if (message.command === 'captureArea') {
                    const selection = editor.selections[0]
                    if (!selection.isEmpty) {
                        scopes.set(source.uri, { kind: 'area', start: editor.document.offsetAt(selection.start), end: editor.document.offsetAt(selection.end) })
                        postCurrent(editor.document, true)
                    }
                } else if (message.command === 'showDocument') { scopes.delete(source.uri); postCurrent(editor.document, true) }
                else if (message.command === 'fitAll') postCurrent(editor.document, true)
            }, undefined, context.subscriptions)
            currentPanel.onDidDispose(() => { currentPanel = undefined }, null, context.subscriptions)
        })
    )
}

function getDevWebviewContent(): string { return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src http://localhost:3000 'unsafe-inline'; style-src http://localhost:3000 'unsafe-inline'; connect-src http://localhost:3000 ws://localhost:3000; img-src data: https: http://localhost:3000 'self';"></head><body><div id="root"></div><script type="module" src="http://localhost:3000/src/main.tsx"></script></body></html>` }
export function getProdWebviewContent(cspSource: string, styleUri: string, scriptUri: string): string { return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${cspSource}; style-src ${cspSource} 'unsafe-inline'; img-src ${cspSource} data: https:;"><link rel="stylesheet" type="text/css" href="${styleUri}"></head><body><div id="root"></div><script type="module" src="${scriptUri}"></script></body></html>` }
export function deactivate() { }
function getMaxGeometries(): number { return normalizeMaxGeometries(vscode.workspace.getConfiguration(SETTINGS_SECTION).get<number>(MAX_GEOMETRIES_SETTING)) }
export function normalizeMaxGeometries(value: unknown): number { return typeof value === 'number' && Number.isFinite(value) && value >= 1 ? Math.floor(value) : DEFAULT_MAX_GEOMETRIES }
function selectTextInEditor(editor: vscode.TextEditor, start: number, end: number) { const range = new vscode.Range(editor.document.positionAt(start), editor.document.positionAt(end)); editor.selection = new vscode.Selection(range.start, range.end); editor.revealRange(range, vscode.TextEditorRevealType.InCenter) }
function postMessageToWebview(panel: vscode.WebviewPanel, message: MsgToWebview) { void panel.webview.postMessage(message) }
