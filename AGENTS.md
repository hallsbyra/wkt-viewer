# AGENTS.md

## Project Shape

The repository root is the VS Code extension root. The root `package.json` owns extension metadata, contributed commands, scripts, and publishing.

- `extension/`: VS Code backend. Do not treat this as the extension root.
- `webview/`: React, Vite, and Leaflet frontend.
- `shared/`: TypeScript contracts shared across the extension/webview boundary.

Put cross-boundary message and data types in `shared/src`.

## Agent Workflow

Run commands from the repository root.

- Install: `npm ci`
- Build and lint: `npm run build`
- Test: `npm test`
- Package: `npm run package`

For code, build, packaging, or manifest changes, run all relevant verification before finishing. For docs-only changes, no test run is required.

## Test Notes

Extension tests are configured from the root through `.vscode-test.mjs`.

Do not run `vscode-test` from `extension/`; that folder is only a workspace package.

## Packaging Notes

`npm run package` runs `vscode:prepublish`, which cleans and rebuilds all workspaces before creating the VSIX.

Keep `.vscodeignore` strict. Tests, source maps, TypeScript sources, workspace internals, and release automation files should not ship.

## Commits

Follow the commit policy in [README.md](./README.md#contributing).

Use `build:` for build, CI, packaging, and workflow changes. Do not use `ci:` in this repository.
