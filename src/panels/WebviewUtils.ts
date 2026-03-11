import * as crypto from 'crypto';
import * as vscode from 'vscode';

export function getNonce(): string {
    return crypto.randomBytes(16).toString('base64');
}

export function getWebviewUri(
    webview: vscode.Webview,
    extensionUri: vscode.Uri,
    ...pathSegments: string[]
): vscode.Uri {
    return webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, ...pathSegments));
}

export function buildCsp(webview: vscode.Webview, nonce: string): string {
    return [
        `default-src 'none'`,
        `script-src 'nonce-${nonce}'`,
        `style-src ${webview.cspSource} 'unsafe-inline'`,
        `font-src ${webview.cspSource}`,
        `img-src ${webview.cspSource} data:`,
    ].join('; ');
}
