import assert from 'assert'
import { getProdWebviewContent } from './extension.js'

suite('getProdWebviewContent', () => {
    test('uses VS Code webview CSP source and production asset URIs', () => {
        const cspSource = 'vscode-webview://wkt-viewer-test'
        const styleUri = `${cspSource}/webview/dist/assets/index.css`
        const scriptUri = `${cspSource}/webview/dist/assets/index.js`

        const html = getProdWebviewContent(cspSource, styleUri, scriptUri)

        assert.ok(html.includes('http-equiv="Content-Security-Policy"'))
        assert.ok(html.includes(`script-src ${cspSource};`))
        assert.ok(html.includes(`style-src ${cspSource} 'unsafe-inline';`))
        assert.ok(html.includes(`img-src ${cspSource} data: https:;`))
        assert.ok(html.includes(`href="${styleUri}"`))
        assert.ok(html.includes(`src="${scriptUri}"`))
        assert.ok(!html.includes('vscode-resource:'))
        assert.ok(!html.includes(`script-src 'self'`))
        assert.ok(!html.includes(`style-src 'self'`))
    })
})
