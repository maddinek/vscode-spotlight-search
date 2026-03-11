import * as vscode from 'vscode';
import { SearchOptions, WebviewMessage, HostMessage } from '../types';
import { SearchStateManager } from '../state/SearchStateManager';
import { getNonce, getWebviewUri, buildCsp } from './WebviewUtils';

export class SearchDialogPanel implements vscode.Disposable {
    static readonly viewType = 'intellijSearch.dialog';
    private static instance: SearchDialogPanel | undefined;

    private readonly panel: vscode.WebviewPanel;
    private readonly _onSearch = new vscode.EventEmitter<SearchOptions>();
    private readonly _onCancel = new vscode.EventEmitter<void>();
    private readonly _onDispose = new vscode.EventEmitter<void>();
    readonly onSearch = this._onSearch.event;
    readonly onCancel = this._onCancel.event;
    readonly onDispose = this._onDispose.event;
    private readonly disposables: vscode.Disposable[] = [];
    private pendingOverrides?: Partial<SearchOptions>;

    static createOrShow(
        context: vscode.ExtensionContext,
        stateManager: SearchStateManager,
        overrideOptions?: Partial<SearchOptions>
    ): SearchDialogPanel {
        if (SearchDialogPanel.instance) {
            SearchDialogPanel.instance.panel.reveal(vscode.ViewColumn.One);
            if (overrideOptions) {
                const base = stateManager.load();
                SearchDialogPanel.instance.post({ type: 'init', options: { ...base, ...overrideOptions } });
            }
            return SearchDialogPanel.instance;
        }
        const instance = new SearchDialogPanel(context, stateManager);
        instance.pendingOverrides = overrideOptions;
        SearchDialogPanel.instance = instance;
        return instance;
    }

    private constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly stateManager: SearchStateManager
    ) {
        this.panel = vscode.window.createWebviewPanel(
            SearchDialogPanel.viewType,
            'Find in Path',
            { viewColumn: vscode.ViewColumn.One, preserveFocus: false },
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [context.extensionUri],
            }
        );

        this.panel.webview.html = this.getHtml();

        this.panel.webview.onDidReceiveMessage(
            (msg: WebviewMessage) => this.handleMessage(msg),
            this,
            this.disposables
        );

        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    }

    private handleMessage(msg: WebviewMessage): void {
        switch (msg.type) {
            case 'ready': {
                const base = this.stateManager.load();
                const options = this.pendingOverrides ? { ...base, ...this.pendingOverrides } : base;
                this.pendingOverrides = undefined;
                this.post({ type: 'init', options });
                break;
            }
            case 'search':
                this._onSearch.fire(msg.options);
                break;
            case 'cancel':
                this._onCancel.fire();
                break;
        }
    }

    post(msg: HostMessage): void {
        this.panel.webview.postMessage(msg);
    }

    private getHtml(): string {
        const nonce = getNonce();
        const scriptUri = getWebviewUri(this.panel.webview, this.context.extensionUri, 'dist', 'webview-dialog.js');
        const csp = buildCsp(this.panel.webview, nonce);
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Find in Path</title>
  <style nonce="${nonce}">
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: var(--vscode-editor-background);
  color: var(--vscode-editor-foreground);
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  padding: 12px;
  min-height: 100vh;
}

.dialog {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 640px;
  margin: 0 auto;
}

.title-bar {
  font-size: 13px;
  font-weight: 600;
  color: var(--vscode-titleBar-activeForeground, var(--vscode-editor-foreground));
  padding-bottom: 4px;
  border-bottom: 1px solid var(--vscode-panel-border, #444);
  margin-bottom: 4px;
}

.field-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.field-row input[type="text"],
.field-row input[type="number"] {
  flex: 1;
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border, #555);
  padding: 4px 8px;
  font-size: var(--vscode-font-size);
  font-family: var(--vscode-editor-font-family, monospace);
  outline: none;
  border-radius: 2px;
}

.field-row input[type="text"]:focus,
.field-row input[type="number"]:focus {
  border-color: var(--vscode-focusBorder);
}

.toggles-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.toggle {
  background: var(--vscode-button-secondaryBackground, #3a3d41);
  color: var(--vscode-button-secondaryForeground, #ccc);
  border: 1px solid transparent;
  padding: 2px 8px;
  font-size: 11px;
  font-family: var(--vscode-editor-font-family, monospace);
  cursor: pointer;
  border-radius: 2px;
  min-width: 28px;
}

.toggle:hover {
  background: var(--vscode-button-secondaryHoverBackground, #45494e);
}

.toggle.active {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border-color: var(--vscode-focusBorder);
}

.separator {
  width: 1px;
  height: 16px;
  background: var(--vscode-panel-border, #444);
  margin: 0 4px;
}

.scope-row {
  flex-wrap: wrap;
}

.scope-row label {
  color: var(--vscode-descriptionForeground);
  font-size: 11px;
  white-space: nowrap;
}

.scope-row select {
  background: var(--vscode-dropdown-background);
  color: var(--vscode-dropdown-foreground);
  border: 1px solid var(--vscode-dropdown-border, #555);
  padding: 3px 6px;
  font-size: var(--vscode-font-size);
  border-radius: 2px;
  cursor: pointer;
}

.actions-row {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 4px;
}

button.primary {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: none;
  padding: 5px 16px;
  font-size: var(--vscode-font-size);
  cursor: pointer;
  border-radius: 2px;
}

button.primary:hover {
  background: var(--vscode-button-hoverBackground);
}

button:not(.toggle):not(.primary) {
  background: var(--vscode-button-secondaryBackground, #3a3d41);
  color: var(--vscode-button-secondaryForeground, #ccc);
  border: none;
  padding: 5px 16px;
  font-size: var(--vscode-font-size);
  cursor: pointer;
  border-radius: 2px;
}

button:not(.toggle):not(.primary):hover {
  background: var(--vscode-button-secondaryHoverBackground, #45494e);
}

.path-display {
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
  font-family: var(--vscode-editor-font-family, monospace);
  padding: 2px 6px;
  background: var(--vscode-input-background);
  border-radius: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: none;
}
.path-display.visible { display: block; }
  </style>
</head>
<body>
  <div id="app"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }

    dispose(): void {
        SearchDialogPanel.instance = undefined;
        this._onDispose.fire();
        this.panel.dispose();
        this._onSearch.dispose();
        this._onCancel.dispose();
        this._onDispose.dispose();
        this.disposables.forEach(d => d.dispose());
    }
}
