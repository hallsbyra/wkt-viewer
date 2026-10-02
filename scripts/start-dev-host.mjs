import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { closeSync, openSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const workspace = fileURLToPath(new URL('../', import.meta.url))
const cache = join(workspace, '.vscode-test')
const statePath = join(cache, 'dev-host-launch.json')
const logPath = join(cache, 'dev-host-launch.log')
const port = 9333

async function inspectorTarget() {
    try {
        const response = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(1000) })
        const targets = await response.json()
        return Array.isArray(targets) ? targets.find(target => target.type === 'node') : undefined
    } catch {
        return undefined
    }
}

async function inspectorParentPid(target) {
    const socket = new WebSocket(target.webSocketDebuggerUrl)
    const signal = AbortSignal.timeout(1000)
    try {
        await once(socket, 'open', { signal })
        socket.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: 'process.ppid', returnByValue: true } }))
        const [message] = await once(socket, 'message', { signal })
        const mainPid = JSON.parse(message.data).result?.result?.value
        if (!Number.isInteger(mainPid) || mainPid < 1) throw new Error('Could not identify the inspector process.')
        return mainPid
    } finally {
        socket.close()
    }
}

async function start() {
    const executable = process.argv[2]
    if (!executable) throw new Error('Pass the VS Code executable path as the first argument.')

    const existing = await inspectorTarget()
    if (existing) {
        const state = await readFile(statePath, 'utf8').then(JSON.parse).catch(() => undefined)
        const mainPid = await inspectorParentPid(existing)
        // Reload Window changes the inspector target, but keeps the same VS Code parent.
        if (state?.targetId !== existing.id && state?.mainPid !== mainPid) throw new Error(`Inspector port ${port} is already used by another application.`)
    }

    await mkdir(cache, { recursive: true })
    const env = { ...process.env }
    // Do not inherit the parent extension host's Node/bootstrap/debugger injection.
    for (const key of Object.keys(env)) {
        if (key.startsWith('VSCODE_') || key === 'ELECTRON_RUN_AS_NODE' || key === 'NODE_OPTIONS') delete env[key]
    }

    const log = openSync(logPath, 'a')
    const child = spawn(executable, [
        '--new-window',
        '--disable-extensions',
        `--user-data-dir=${join(cache, 'dev-host-user-data')}`,
        `--extensions-dir=${join(cache, 'dev-host-extensions')}`,
        `--extensionDevelopmentPath=${workspace}`,
        `--inspect-extensions=${port}`,
        join(workspace, 'test.cs'),
    ], {
        cwd: workspace,
        env,
        detached: true,
        // This is the interactive development window, so it must be shown.
        windowsHide: false,
        stdio: ['ignore', log, log],
    })
    closeSync(log)
    let spawnError
    child.once('error', error => { spawnError = error })
    child.unref()

    const deadline = Date.now() + 30000
    while (Date.now() < deadline) {
        if (spawnError) throw spawnError
        if (child.exitCode !== null && child.exitCode !== 0) throw new Error(`VS Code exited with code ${child.exitCode}. See ${logPath}`)
        const target = await inspectorTarget()
        // VS Code reloads and brings forward an existing development window.
        // Wait for its new inspector, rather than attaching to the old process.
        if (target && target.id !== existing?.id) {
            const mainPid = await inspectorParentPid(target)
            await writeFile(statePath, JSON.stringify({ targetId: target.id, mainPid }))
            console.log(`WKT Viewer development host ready on port ${port}.`)
            return
        }
        await delay(200)
    }
    throw new Error(`Development host did not start its inspector on port ${port}. See ${logPath}`)
}

start().catch(error => {
    console.error(error.message)
    process.exitCode = 1
})
