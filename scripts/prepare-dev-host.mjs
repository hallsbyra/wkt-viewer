import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { downloadAndUnzipVSCode } from '@vscode/test-electron'

const version = '1.138.0'
const executable = join('.vscode-test', `vscode-win32-x64-archive-${version}`, 'Code.exe')

if (!existsSync(executable)) {
    await downloadAndUnzipVSCode(version)
}
