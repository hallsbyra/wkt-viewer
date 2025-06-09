# WKT Viewer

Visualize WKT (Well Known Text) geometries in text files. Its main purpose is to assist debugging large log files containig WKT.

![Preview Image](preview.gif)

## Features

* Visualizes all found WKT in the current text editor.
* Highlights the "current" geometry as you navigate the text.
* Selects the corresponding text if you click on a geometry.


## Extension Settings

None for now.

## Known Issues

* There's a hard coded cap on the first 500 geometries found in the text. This should be a setting.
* No theme support.

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
