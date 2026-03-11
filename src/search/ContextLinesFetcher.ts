import * as vscode from 'vscode';
import { FileMatch, ContextLine } from '../types';

// Simple LRU-ish cache: keep last 50 opened documents to avoid reopening on every batch
const docCache = new Map<string, vscode.TextDocument>();
const MAX_CACHE = 50;

async function getDoc(uri: vscode.Uri): Promise<vscode.TextDocument> {
    const key = uri.toString();
    if (docCache.has(key)) {
        return docCache.get(key)!;
    }
    const doc = await vscode.workspace.openTextDocument(uri);
    if (docCache.size >= MAX_CACHE) {
        // evict oldest entry
        const firstKey = docCache.keys().next().value as string;
        docCache.delete(firstKey);
    }
    docCache.set(key, doc);
    return doc;
}

export class ContextLinesFetcher {
    async enrich(files: FileMatch[], contextCount: number): Promise<FileMatch[]> {
        if (contextCount === 0) { return files; }

        return Promise.all(files.map(async (fm) => {
            try {
                const doc = await getDoc(vscode.Uri.parse(fm.uri));
                const lineCount = doc.lineCount;
                const matchLineNums = new Set(fm.matches.map(m => m.line));
                const needed = new Set<number>();

                for (const line of matchLineNums) {
                    for (let i = Math.max(0, line - contextCount);
                         i <= Math.min(lineCount - 1, line + contextCount);
                         i++) {
                        needed.add(i);
                    }
                }

                const contextLines: ContextLine[] = Array.from(needed)
                    .sort((a, b) => a - b)
                    .map(lineNum => ({
                        line: lineNum,
                        text: doc.lineAt(lineNum).text,
                        isMatch: matchLineNums.has(lineNum),
                    }));

                return { ...fm, contextLines };
            } catch {
                // If file can't be read, return as-is
                return fm;
            }
        }));
    }

    clearCache(): void {
        docCache.clear();
    }
}
