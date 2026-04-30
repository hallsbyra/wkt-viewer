import * as assert from 'assert'
import * as vscode from 'vscode'

suite('WKT Viewer extension', () => {
	teardown(async () => {
		await vscode.commands.executeCommand('workbench.action.closeAllEditors')
	})

	test('loads from the root extension manifest', async () => {
		const extension = vscode.extensions.getExtension('halls-byra.wkt-viewer')

		assert.ok(extension, 'Expected VS Code to load the root WKT Viewer extension')
		assert.strictEqual(extension.packageJSON.main, './extension/dist/extension.js')
		assert.deepStrictEqual(extension.packageJSON.engines, { vscode: '^1.99.0' })
	})

	test('registers and runs the Start WKT Viewer command', async () => {
		const extension = vscode.extensions.getExtension('halls-byra.wkt-viewer')
		assert.ok(extension, 'Expected VS Code to load the root WKT Viewer extension')

		await extension.activate()
		const commands = await vscode.commands.getCommands(true)

		assert.ok(commands.includes('wktViewer.start'), 'Expected wktViewer.start to be registered')
		await vscode.commands.executeCommand('wktViewer.start')
	})
})
