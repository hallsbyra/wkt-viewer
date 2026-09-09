import * as vscode from 'vscode'
import { type MsgFromWebview, type MsgToWebview, type SourceDocument, type ViewingScope } from '@wkt-viewer/shared'
import { filterTokensForScope } from './scope.js'
import { ViewingSession } from './viewingSession.js'
import { extractWkt } from './wkt.js'

export const DEFAULT_MAX_GEOMETRIES = 500
const SETTINGS_SECTION = 'wktViewer'
const MAX_GEOMETRIES_SETTING = 'maxGeometries'

export function activate(context: vscode.ExtensionContext) {
    let currentPanel: vscode.WebviewPanel | undefined
    let lastTextEditor: vscode.TextEditor | undefined
    let displayedDocumentUri: string | undefined
    let fitId = 0
    const selectionVersions = new WeakMap<vscode.TextEditor, number>()
    const session = new ViewingSession(source => {
        const editor = currentEditor()
        if (editor && editor.document.uri.toString() === source.uri && editor.document.version === source.version) {
            postCurrent(editor.document, true)
        }
    })

    const currentEditor = () => lastTextEditor ?? vscode.window.activeTextEditor

    const postSelection = (editor: vscode.TextEditor) => {
        if (!currentPanel) return
        const selection = editor.selections[0]
        postMessageToWebview(currentPanel, {
            command: 'select',
            source: sourceFor(editor.document),
            start: editor.document.offsetAt(selection.start),
            end: editor.document.offsetAt(selection.end),
        })
    }

    const postCurrent = (document: vscode.TextDocument, forceFit = false) => {
        if (!currentPanel) return

        const { scope, locked } = session.getView(document.uri.toString())
        const areaLineRange = getAreaLineRange(document, scope)
        const tokens = filterTokensForScope(extractWkt(document.getText()), scope, getMaxGeometries())

        postMessageToWebview(currentPanel, {
            command: 'update',
            wkt: tokens,
            source: sourceFor(document),
            scope,
            areaLocked: locked,
            areaLineRange,
            fitId: forceFit ? ++fitId : fitId,
        })
        displayedDocumentUri = document.uri.toString()
    }

    const handleWebviewMessage = (message: MsgFromWebview) => {
        const editor = currentEditor()
        if (!currentPanel || !editor) return

        const source = sourceFor(editor.document)
        if ('source' in message && !isCurrentSource(message, source)) return
        session.cancelPendingSelection()

        if (message.command === 'ready') {
            postCurrent(editor.document, true)
        } else if (message.command === 'select') {
            // The resulting Command event highlights the geometry but never follows it.
            selectTextInEditor(editor, message.start, message.end)
        } else if (message.command === 'fitAll') {
            postCurrent(editor.document, true)
        } else if (message.command === 'selectArea') {
            const scope = session.getView(source.uri).scope
            if (scope.kind === 'area') selectTextInEditor(editor, scope.start, scope.end)
        } else if (message.command === 'setAreaLocked') {
            session.setAreaLocked(source.uri, message.locked)
            postCurrent(editor.document)
        }
    }

    context.subscriptions.push(
        session,
        vscode.workspace.onDidChangeTextDocument(event => {
            const key = event.document.uri.toString()
            session.updateDocument(key, event.contentChanges)

            if (currentPanel && currentEditor()?.document === event.document) {
                postCurrent(event.document)
            }
        }),
        vscode.workspace.onDidCloseTextDocument(document => session.closeDocument(document.uri.toString())),
        vscode.window.onDidChangeActiveTextEditor(editor => {
            session.cancelPendingSelection()
            if (!currentPanel || !editor) return

            lastTextEditor = editor
            selectionVersions.set(editor, editor.document.version)
            const changedDocument = displayedDocumentUri !== editor.document.uri.toString()
            postCurrent(editor.document, changedDocument)
        }),
        vscode.window.onDidChangeTextEditorSelection(event => {
            if (!currentPanel || event.textEditor !== currentEditor()) return

            lastTextEditor = event.textEditor
            const selection = event.selections[0]
            const document = event.textEditor.document
            const documentChanged = selectionVersions.get(event.textEditor) !== document.version
            selectionVersions.set(event.textEditor, document.version)
            // Typing and arrow-key navigation move an empty selection without choosing an area.
            const userInitiated = event.kind === vscode.TextEditorSelectionChangeKind.Mouse
                || (event.kind === vscode.TextEditorSelectionChangeKind.Keyboard && !selection.isEmpty && !documentChanged)
            session.selectionChanged(sourceFor(document), document.offsetAt(selection.start), document.offsetAt(selection.end), userInitiated)
            postSelection(event.textEditor)
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
            if (lastTextEditor) {
                selectionVersions.set(lastTextEditor, lastTextEditor.document.version)
                const selection = lastTextEditor.selections[0]
                session.initializeFromSelection(
                    sourceFor(lastTextEditor.document),
                    lastTextEditor.document.offsetAt(selection.start),
                    lastTextEditor.document.offsetAt(selection.end),
                )
            }
            const targetColumn = lastTextEditor?.viewColumn !== undefined
                ? lastTextEditor.viewColumn + 1
                : vscode.ViewColumn.Beside
            currentPanel = vscode.window.createWebviewPanel('wktViewer', 'WKT Viewer', targetColumn, {
                enableScripts: true,
                localResourceRoots: [context.extensionUri],
            })

            setWebviewContent(currentPanel, context)
            currentPanel.webview.onDidReceiveMessage(handleWebviewMessage, undefined, context.subscriptions)
            currentPanel.onDidDispose(() => {
                session.cancelPendingSelection()
                currentPanel = undefined
                displayedDocumentUri = undefined
            }, null, context.subscriptions)
        })
    )
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
    const isDevelopment = context.extensionMode === vscode.ExtensionMode.Development

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
