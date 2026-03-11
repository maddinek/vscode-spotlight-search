import * as vscode from 'vscode';
import { FileMatch, HostMessage, WebviewMessage } from '../types';
import { getNonce, getWebviewUri, buildCsp } from './WebviewUtils';

export class ResultsPanelManager implements vscode.WebviewViewProvider {
    static readonly viewType = 'intellijSearch.resultsView';

    private view?: vscode.WebviewView;

    constructor(private readonly extensionUri: vscode.Uri) {}

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this.view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri],
        };

        webviewView.webview.html = this.getHtml(webviewView.webview);

        webviewView.webview.onDidReceiveMessage((msg: WebviewMessage) => {
            if (msg.type === 'navigate') {
                this.navigateTo(msg.uri, msg.line, msg.column);
            }
        });
    }

    async showAndClear(_queryLabel: string): Promise<void> {
        await vscode.commands.executeCommand('intellijSearch.resultsView.focus');
        // Wait for resolveWebviewView to be called if the panel was just opened
        if (!this.view) {
            await new Promise<void>(resolve => {
                const interval = setInterval(() => {
                    if (this.view) { clearInterval(interval); resolve(); }
                }, 50);
                setTimeout(() => { clearInterval(interval); resolve(); }, 2000);
            });
        }
        this.post({ type: 'search-cancelled' });
    }

    postBatch(files: FileMatch[]): void {
        this.post({ type: 'results-batch', files });
    }

    postDone(summary: { fileCount: number; matchCount: number }): void {
        this.post({ type: 'search-done', fileCount: summary.fileCount, matchCount: summary.matchCount });
    }

    postError(message: string): void {
        vscode.window.showErrorMessage(`IntelliJ Search: ${message}`);
        this.post({ type: 'search-error', message });
    }

    postCancelled(): void {
        this.post({ type: 'search-cancelled' });
    }

    private post(msg: HostMessage): void {
        this.view?.webview.postMessage(msg);
    }

    private async navigateTo(uri: string, line: number, column: number): Promise<void> {
        try {
            const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(uri));
            const pos = new vscode.Position(line, column);
            await vscode.window.showTextDocument(doc, {
                selection: new vscode.Range(pos, pos),
                preserveFocus: false,
            });
        } catch (err) {
            vscode.window.showErrorMessage(`Cannot open file: ${err}`);
        }
    }

    private getHtml(webview: vscode.Webview): string {
        const nonce = getNonce();
        const scriptUri = getWebviewUri(webview, this.extensionUri, 'dist', 'webview-results.js');
        const csp = buildCsp(webview, nonce);

        const css = getResultsCss();

        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Find in Path Results</title>
  <style nonce="${nonce}">${css}</style>
</head>
<body>
  <div id="header" class="header hidden"></div>
  <div id="results" class="results-container"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }
}

function getResultsCss(): string {
    return `
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: var(--vscode-editor-background);
  color: var(--vscode-editor-foreground);
  font-family: var(--vscode-editor-font-family, monospace);
  font-size: var(--vscode-editor-font-size, 12px);
  overflow-y: auto;
}

.header {
  padding: 4px 8px;
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
  border-bottom: 1px solid var(--vscode-panel-border, #444);
  background: var(--vscode-sideBar-background, var(--vscode-editor-background));
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 8px;
}

.header.hidden { display: none; }

.header .count { font-weight: 600; color: var(--vscode-editor-foreground); }
.header .query { color: var(--vscode-textLink-foreground); font-style: italic; }
.header .searching { color: var(--vscode-notificationsInfoIcon-foreground); }

.results-container { padding: 4px 0; }

.file-group { margin-bottom: 2px; }

.file-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  cursor: pointer;
  user-select: none;
  background: var(--vscode-sideBar-background, var(--vscode-editor-background));
  border-top: 1px solid var(--vscode-panel-border, transparent);
  position: sticky;
  top: 26px;
  z-index: 5;
}

.file-header:hover { background: var(--vscode-list-hoverBackground); }

.file-header .arrow { font-size: 10px; color: var(--vscode-descriptionForeground); transition: transform 0.1s; }
.file-header.collapsed .arrow { transform: rotate(-90deg); }
.file-header .filename { color: var(--vscode-textLink-foreground); font-weight: 600; }
.file-header .filepath { color: var(--vscode-descriptionForeground); font-size: 11px; margin-left: 2px; }
.file-header .file-count { color: var(--vscode-descriptionForeground); font-size: 11px; margin-left: auto; }

.file-matches { }
.file-matches.collapsed { display: none; }

.match-row, .context-row {
  display: flex;
  align-items: baseline;
  padding: 1px 8px 1px 28px;
  cursor: pointer;
  white-space: pre;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.5;
}

.match-row:hover { background: var(--vscode-list-hoverBackground); }
.match-row:active { background: var(--vscode-list-activeSelectionBackground); }

.context-row {
  color: var(--vscode-descriptionForeground);
  cursor: default;
  opacity: 0.7;
}

.line-num {
  color: var(--vscode-editorLineNumber-foreground);
  min-width: 40px;
  text-align: right;
  padding-right: 10px;
  font-size: 11px;
  flex-shrink: 0;
  user-select: none;
}

.line-text { flex: 1; overflow: hidden; text-overflow: ellipsis; }

.match { background: var(--vscode-editor-findMatchHighlightBackground, rgba(234,92,0,0.33)); border-radius: 2px; }

.empty-state {
  padding: 24px 16px;
  color: var(--vscode-descriptionForeground);
  text-align: center;
  font-style: italic;
}

.error-state {
  padding: 12px 16px;
  color: var(--vscode-errorForeground);
}

.truncation-warning {
  padding: 6px 16px;
  color: var(--vscode-notificationsWarningIcon-foreground);
  font-size: 11px;
  background: var(--vscode-inputValidation-warningBackground, rgba(255,200,0,0.1));
  border-top: 1px solid var(--vscode-panel-border, #444);
}

/* Virtual scroller — rows are absolutely positioned */
.file-header,
.match-row,
.context-row {
  height: 22px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.limit-hit {
  color: var(--vscode-notificationsWarningIcon-foreground, #cca700);
  font-size: 11px;
}
`;
}
