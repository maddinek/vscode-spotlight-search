import * as vscode from 'vscode';
import { SearchStateManager } from './state/SearchStateManager';
import { SearchEngine } from './search/SearchEngine';
import { SearchDialogPanel } from './panels/SearchDialogPanel';
import { ResultsPanelManager } from './panels/ResultsPanelManager';
import { SearchOptions } from './types';

export function activate(context: vscode.ExtensionContext): void {
    const stateManager = new SearchStateManager(context.workspaceState);
    const engine = new SearchEngine();
    const resultsPanel = new ResultsPanelManager(context.extensionUri);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(ResultsPanelManager.viewType, resultsPanel)
    );

    let dialog: SearchDialogPanel | undefined;

    function openDialog(overrideOptions?: Partial<SearchOptions>): void {
        const isNew = !dialog;
        dialog = SearchDialogPanel.createOrShow(context, stateManager, overrideOptions);

        if (isNew) {
            dialog.onSearch(async (options) => {
                stateManager.save(options);
                await resultsPanel.showAndClear(options.query);

                await engine.search(
                    options,
                    (batch) => resultsPanel.postBatch(batch),
                    (summary) => {
                        resultsPanel.postDone(summary);
                        if (summary.matchCount === 0) {
                            vscode.window.showInformationMessage(`Spotlight Search: No results found for "${options.query}"`);
                        }
                    },
                    (message) => resultsPanel.postError(message)
                );
            });

            dialog.onCancel(() => {
                engine.cancel();
                resultsPanel.postCancelled();
            });

            dialog.onDispose(() => { dialog = undefined; });
        }
    }

    context.subscriptions.push(
        vscode.commands.registerCommand('intellijSearch.open', () => openDialog()),

        vscode.commands.registerCommand('intellijSearch.searchInFolder', (uri: vscode.Uri) => {
            openDialog({ scope: 'directory', directoryPath: uri.fsPath });
        }),

        vscode.commands.registerCommand('intellijSearch.searchInFile', (uri: vscode.Uri) => {
            openDialog({ scope: 'currentFile', directoryPath: uri.fsPath });
        }),

        engine
    );
}

export function deactivate(): void {
    // nothing
}
