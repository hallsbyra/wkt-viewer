import * as assert from 'assert'
import * as vscode from 'vscode'
import { DEFAULT_MAX_GEOMETRIES, normalizeMaxGeometries } from '../extension.js'

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

	test('contributes max geometry setting', async () => {
		const extension = vscode.extensions.getExtension('halls-byra.wkt-viewer')
		assert.ok(extension, 'Expected VS Code to load the root WKT Viewer extension')

		const setting = extension.packageJSON.contributes.configuration.properties['wktViewer.maxGeometries']
		assert.strictEqual(setting.type, 'integer')
		assert.strictEqual(setting.default, DEFAULT_MAX_GEOMETRIES)
		assert.strictEqual(setting.minimum, 1)
	})

	test('normalizes max geometry setting values', () => {
		assert.strictEqual(normalizeMaxGeometries(25), 25)
		assert.strictEqual(normalizeMaxGeometries(25.9), 25)
		assert.strictEqual(normalizeMaxGeometries(0), DEFAULT_MAX_GEOMETRIES)
		assert.strictEqual(normalizeMaxGeometries(undefined), DEFAULT_MAX_GEOMETRIES)
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
