import * as vscode from 'vscode';
import { SearchScope } from '../types';

export class ScopeResolver {
    async resolvePaths(scope: SearchScope): Promise<string[]> {
        switch (scope) {
            case 'workspace':
                return (vscode.workspace.workspaceFolders ?? []).map(f => f.uri.fsPath);

            case 'openFiles':
                return this.getOpenFilePaths();

            case 'currentFile': {
                const active = vscode.window.activeTextEditor?.document.uri.fsPath;
                return active ? [active] : [];
            }

            case 'directory': {
                const dirs = await vscode.window.showOpenDialog({
                    canSelectFiles: false,
                    canSelectFolders: true,
                    canSelectMany: false,
                    openLabel: 'Search in folder',
                });
                return dirs ? [dirs[0].fsPath] : [];
            }
        }
    }

    private getOpenFilePaths(): string[] {
        const paths: string[] = [];
        for (const group of vscode.window.tabGroups.all) {
            for (const tab of group.tabs) {
                if (tab.input instanceof vscode.TabInputText) {
                    paths.push(tab.input.uri.fsPath);
                }
            }
        }
        return paths;
    }
}
