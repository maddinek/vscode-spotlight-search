export interface SearchOptions {
    query: string;
    isRegex: boolean;
    isCaseSensitive: boolean;
    isWholeWord: boolean;
    fileMask: string;        // e.g. "*.ts,*.tsx" — comma separated globs
    scope: SearchScope;
    contextLines: number;    // 0–5
    useIgnoreFiles: boolean; // respect .gitignore etc
}

export type SearchScope = 'workspace' | 'openFiles' | 'currentFile' | 'directory';

export interface MatchLocation {
    line: number;       // 0-based
    column: number;     // 0-based
    matchLength: number;
    lineText: string;
}

export interface ContextLine {
    line: number;   // 0-based
    text: string;
    isMatch: boolean;
}

export interface FileMatch {
    uri: string;           // vscode.Uri.toString()
    relativePath: string;
    matches: MatchLocation[];
    contextLines: ContextLine[];
}

// Messages sent from extension host to a webview
export type HostMessage =
    | { type: 'init'; options: SearchOptions }
    | { type: 'results-batch'; files: FileMatch[] }
    | { type: 'search-done'; fileCount: number; matchCount: number }
    | { type: 'search-error'; message: string }
    | { type: 'search-cancelled' };

// Messages sent from a webview to the extension host
export type WebviewMessage =
    | { type: 'search'; options: SearchOptions }
    | { type: 'cancel' }
    | { type: 'navigate'; uri: string; line: number; column: number }
    | { type: 'ready' };

export const DEFAULT_SEARCH_OPTIONS: SearchOptions = {
    query: '',
    isRegex: false,
    isCaseSensitive: false,
    isWholeWord: false,
    fileMask: '',
    scope: 'workspace',
    contextLines: 1,
    useIgnoreFiles: true,
};
