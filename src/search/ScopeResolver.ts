import * as vscode from 'vscode';
import { SearchOptions } from '../types';

export class ScopeResolver {
    async resolvePaths(options: SearchOptions): Promise<string[]> {
        switch (options.scope) {
            case 'workspace':
                return (vscode.workspace.workspaceFolders ?? []).map(f => f.uri.fsPath);

            case 'openFiles':
                return this.getOpenFilePaths();

            case 'currentFile': {
                const active = vscode.window.activeTextEditor?.document.uri.fsPath;
                return active ? [active] : [];
            }

            case 'directory': {
                if (options.directoryPath) {
                    return [options.directoryPath];
                }
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
