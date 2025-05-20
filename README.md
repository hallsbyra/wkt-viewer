# wkt-viewer README


## Features

TODO

## Requirements

TODO

## Extension Settings

TODO

## Known Issues

TODO


## Developing

To start developing and debugging this extension:

- <kbd>F5</kbd> — Launches the extension and starts the dev environment automatically.

To start the development environment without launching the extension:

- <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd> → **Start Dev Env** — Manually start the dev environment.

### Debugging the extension (Backend)
Just place breakpoints and <kbd>F5</kbd>.

### Debugging the Webview (React Frontend)

**Note:** VS Code cannot directly debug code running inside the webview (React frontend) using breakpoints in the editor.
To debug your React code:
1. Open the webview in your extension.
2. Open the Command Palette and run `Developer: Open Webview Developer Tools`.
3. Use Chrome DevTools to set breakpoints and debug your React code (source maps are supported).
