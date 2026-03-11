import { SearchOptions, SearchScope, HostMessage, WebviewMessage, DEFAULT_SEARCH_OPTIONS } from '../../src/types';

declare function acquireVsCodeApi(): {
    postMessage(msg: WebviewMessage): void;
    getState(): unknown;
    setState(state: unknown): void;
};

const vscode = acquireVsCodeApi();

function render(options: SearchOptions): void {
    document.getElementById('app')!.innerHTML = `
    <div class="dialog">
      <div class="title-bar">Find in Path</div>
      <div class="field-row">
        <input id="query" type="text" placeholder="Search text" value="${escHtml(options.query)}" spellcheck="false" autocomplete="off" />
      </div>
      <div class="toggles-row">
        <button id="btn-regex"     class="toggle ${options.isRegex ? 'active' : ''}"         title="Regex (Alt+R)">.*</button>
        <button id="btn-case"      class="toggle ${options.isCaseSensitive ? 'active' : ''}" title="Match case (Alt+C)">Aa</button>
        <button id="btn-word"      class="toggle ${options.isWholeWord ? 'active' : ''}"     title="Whole word (Alt+W)">W</button>
        <span class="separator"></span>
        <button id="btn-ignore"    class="toggle ${options.useIgnoreFiles ? 'active' : ''}"  title="Respect .gitignore">.gi</button>
      </div>
      <div class="field-row">
        <input id="fileMask" type="text" placeholder="File mask (e.g. *.ts,*.tsx)" value="${escHtml(options.fileMask)}" spellcheck="false" autocomplete="off" />
      </div>
      <div class="field-row scope-row">
        <label>Scope:</label>
        <select id="scope">
          <option value="workspace"    ${options.scope === 'workspace'    ? 'selected' : ''}>Whole project</option>
          <option value="openFiles"    ${options.scope === 'openFiles'    ? 'selected' : ''}>Open files</option>
          <option value="currentFile"  ${options.scope === 'currentFile'  ? 'selected' : ''}>Current file</option>
          <option value="directory"    ${options.scope === 'directory'    ? 'selected' : ''}>Directory...</option>
        </select>
        <label>Context lines:</label>
        <input id="contextLines" type="number" min="0" max="5" value="${options.contextLines}" style="width:42px" />
      </div>
      <div id="path-display" class="path-display${(options.scope === 'directory' || options.scope === 'currentFile') && options.directoryPath ? ' visible' : ''}">
        ${escHtml(options.directoryPath ?? '')}
      </div>
      <div class="actions-row">
        <button id="btn-find" class="primary">Find</button>
        <button id="btn-cancel">Cancel</button>
      </div>
    </div>
  `;

    // Wire up toggles
    const toggles: Array<[string, keyof SearchOptions]> = [
        ['btn-regex', 'isRegex'],
        ['btn-case', 'isCaseSensitive'],
        ['btn-word', 'isWholeWord'],
        ['btn-ignore', 'useIgnoreFiles'],
    ];
    for (const [id, key] of toggles) {
        document.getElementById(id)!.addEventListener('click', () => {
            (options as unknown as Record<string, unknown>)[key] = !(options as unknown as Record<string, unknown>)[key];
            document.getElementById(id)!.classList.toggle('active');
        });
    }

    // Wire up scope change — show/hide path display
    const scopeSelect = document.getElementById('scope') as HTMLSelectElement;
    const pathDisplay = document.getElementById('path-display') as HTMLDivElement;
    scopeSelect.addEventListener('change', () => {
        const scope = scopeSelect.value as SearchScope;
        if ((scope === 'directory' || scope === 'currentFile') && options.directoryPath) {
            pathDisplay.classList.add('visible');
        } else {
            pathDisplay.classList.remove('visible');
        }
    });

    // Wire up submit
    const submit = () => {
        const msg: WebviewMessage = {
            type: 'search',
            options: collectOptions(options),
        };
        vscode.postMessage(msg);
    };

    document.getElementById('btn-find')!.addEventListener('click', submit);
    document.getElementById('btn-cancel')!.addEventListener('click', () => {
        vscode.postMessage({ type: 'cancel' });
    });

    const queryInput = document.getElementById('query') as HTMLInputElement;
    queryInput.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter') { submit(); }
        if (e.key === 'Escape') { vscode.postMessage({ type: 'cancel' }); }
    });

    queryInput.focus();
    queryInput.select();
}

function collectOptions(base: SearchOptions): SearchOptions {
    return {
        ...base,
        query: (document.getElementById('query') as HTMLInputElement).value,
        fileMask: (document.getElementById('fileMask') as HTMLInputElement).value.trim(),
        scope: (document.getElementById('scope') as HTMLSelectElement).value as SearchScope,
        contextLines: parseInt((document.getElementById('contextLines') as HTMLInputElement).value, 10) || 0,
    };
}

function escHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Listen for messages from host
window.addEventListener('message', (event: MessageEvent) => {
    const msg = event.data as HostMessage;
    if (msg.type === 'init') {
        render(msg.options);
    }
});

// Signal ready
vscode.postMessage({ type: 'ready' });
// Render with defaults immediately so the UI isn't blank before init arrives
render({ ...DEFAULT_SEARCH_OPTIONS });
