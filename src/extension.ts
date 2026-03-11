import * as vscode from 'vscode';
import { SearchStateManager } from './state/SearchStateManager';
import { SearchEngine } from './search/SearchEngine';
import { SearchDialogPanel } from './panels/SearchDialogPanel';
import { ResultsPanelManager } from './panels/ResultsPanelManager';

export function activate(context: vscode.ExtensionContext): void {
    const stateManager = new SearchStateManager(context.workspaceState);
    const engine = new SearchEngine();
const resultsPanel = new ResultsPanelManager(context.extensionUri);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(ResultsPanelManager.viewType, resultsPanel)
    );

    // Wire up search handlers once — not inside the command, to avoid stacking listeners
    let dialog: SearchDialogPanel | undefined;

    const openCommand = vscode.commands.registerCommand('intellijSearch.open', () => {
        const isNew = !dialog;
        dialog = SearchDialogPanel.createOrShow(context, stateManager);

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
                            vscode.window.showInformationMessage(`IntelliJ Search: No results found for "${options.query}"`);
                        }
                    },
                    (message) => resultsPanel.postError(message)
                );
            });

            dialog.onCancel(() => {
                engine.cancel();
                resultsPanel.postCancelled();
            });

            // Reset dialog ref when it's closed so next open re-attaches
            dialog.onDispose(() => { dialog = undefined; });
        }
    });

    context.subscriptions.push(openCommand, engine);
}

export function deactivate(): void {
    // nothing
}
