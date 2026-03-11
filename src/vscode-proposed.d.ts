// Type declarations for VS Code proposed APIs not yet in @types/vscode.
// findTextInFiles has been available since VS Code 1.23 but remains in proposed API.

import * as vscode from 'vscode';

declare module 'vscode' {
    export interface TextSearchQuery {
        pattern: string;
        isRegex?: boolean;
        isCaseSensitive?: boolean;
        isWordMatch?: boolean;
    }

    export interface FindTextInFilesOptions {
        include?: GlobPattern;
        exclude?: GlobPattern;
        maxResults?: number;
        useIgnoreFiles?: boolean;
        useGlobalIgnoreFiles?: boolean;
        followSymlinks?: boolean;
        encoding?: string;
    }

    export interface TextSearchPreviewOptions {
        matchLines: number;
        charsPerLine: number;
    }

    export interface TextSearchMatchPreview {
        text: string;
        matches: Range | Range[];
    }

    export interface TextSearchMatch {
        uri: Uri;
        ranges: Range | Range[];
        preview: TextSearchMatchPreview;
    }

    export interface TextSearchComplete {
        limitHit?: boolean;
        resultCount: number;
    }

    export namespace workspace {
        export function findTextInFiles(
            query: TextSearchQuery,
            options: FindTextInFilesOptions,
            callback: (result: TextSearchMatch) => void,
            token?: CancellationToken
        ): Thenable<TextSearchComplete>;
    }
}
