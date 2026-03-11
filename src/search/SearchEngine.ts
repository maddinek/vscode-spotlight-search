import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { SearchOptions, FileMatch } from '../types';
import { ScopeResolver } from './ScopeResolver';

// ripgrep --json output types
interface RgBegin  { type: 'begin';   data: { path: { text: string } } }
interface RgMatch  { type: 'match';   data: { path: { text: string }; lines: { text: string }; line_number: number; submatches: Array<{ match: { text: string }; start: number; end: number }> } }
interface RgContext{ type: 'context'; data: { path: { text: string }; lines: { text: string }; line_number: number } }
interface RgEnd    { type: 'end';     data: { path: { text: string } } }
type RgEvent = RgBegin | RgMatch | RgContext | RgEnd | { type: string };

function findRgBin(): string {
    const candidates = [
        path.join(vscode.env.appRoot, 'node_modules', '@vscode', 'ripgrep', 'bin', 'rg'),
        path.join(vscode.env.appRoot, 'node_modules', 'vscode-ripgrep', 'bin', 'rg'),
    ];
    for (const c of candidates) {
        try { fs.accessSync(c, fs.constants.X_OK); return c; } catch {}
    }
    return 'rg'; // fall back to rg in PATH
}

function buildRgArgs(options: SearchOptions, searchPaths: string[], maxResults: number): string[] {
    const args: string[] = ['--json', '--no-heading'];

    args.push(options.isCaseSensitive ? '--case-sensitive' : '--ignore-case');
    if (!options.isRegex)    { args.push('--fixed-strings'); }
    if (options.isWholeWord) { args.push('--word-regexp'); }
    if (!options.useIgnoreFiles) { args.push('--no-ignore'); }
    if (options.contextLines > 0) { args.push('-C', String(options.contextLines)); }

    args.push('--max-count', String(maxResults));

    if (options.fileMask.trim()) {
        for (const mask of options.fileMask.split(',').map(m => m.trim()).filter(Boolean)) {
            args.push('--glob', mask.includes('/') ? mask : `**/${mask}`);
        }
    }

    args.push('--', options.query, ...searchPaths);
    return args;
}

export class SearchEngine implements vscode.Disposable {
    private proc?: cp.ChildProcess;
    private readonly scopeResolver = new ScopeResolver();

    async search(
        options: SearchOptions,
        onBatch: (files: FileMatch[]) => void,
        onDone: (summary: { fileCount: number; matchCount: number }) => void,
        onError: (message: string) => void
    ): Promise<void> {
        this.cancel();

        const searchPaths = await this.scopeResolver.resolvePaths(options.scope);
        if (searchPaths.length === 0) {
            onDone({ fileCount: 0, matchCount: 0 });
            return;
        }

        const config = vscode.workspace.getConfiguration('intellijSearch');
        const maxResults: number = config.get('maxResults', 5000);
        const rgBin = findRgBin();
        const args = buildRgArgs(options, searchPaths, maxResults);
        const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();

        return new Promise<void>((resolve) => {
            // fileMap holds all file results for the whole search
            const fileMap = new Map<string, FileMatch>();
            let totalMatches = 0;
            let cancelled = false;
            let lineBuffer = '';

            const getOrCreate = (filePath: string): FileMatch => {
                const uri = vscode.Uri.file(filePath).toString();
                if (!fileMap.has(uri)) {
                    fileMap.set(uri, {
                        uri,
                        relativePath: vscode.workspace.asRelativePath(filePath),
                        matches: [],
                        contextLines: [],
                    });
                }
                return fileMap.get(uri)!;
            };

            this.proc = cp.spawn(rgBin, args, { cwd });

            this.proc.stdout?.on('data', (chunk: Buffer) => {
                if (cancelled) { return; }
                lineBuffer += chunk.toString();
                const lines = lineBuffer.split('\n');
                lineBuffer = lines.pop() ?? '';

                for (const line of lines) {
                    if (!line.trim()) { continue; }
                    try {
                        const event = JSON.parse(line) as RgEvent;

                        if (event.type === 'match') {
                            const e = (event as RgMatch).data;
                            const fm = getOrCreate(e.path.text);
                            const lineText = e.lines.text.replace(/\n$/, '');
                            const lineNum = e.line_number - 1; // rg is 1-based
                            for (const sub of e.submatches) {
                                fm.matches.push({ line: lineNum, column: sub.start, matchLength: sub.end - sub.start, lineText });
                                totalMatches++;
                            }
                            if (!fm.contextLines.some(c => c.line === lineNum)) {
                                fm.contextLines.push({ line: lineNum, text: lineText, isMatch: true });
                            }

                        } else if (event.type === 'context') {
                            const e = (event as RgContext).data;
                            const fm = getOrCreate(e.path.text);
                            const lineNum = e.line_number - 1;
                            if (!fm.contextLines.some(c => c.line === lineNum)) {
                                fm.contextLines.push({ line: lineNum, text: e.lines.text.replace(/\n$/, ''), isMatch: false });
                            }

                        } else if (event.type === 'end') {
                            // File is complete — flush it immediately
                            const e = (event as RgEnd).data;
                            const uri = vscode.Uri.file(e.path.text).toString();
                            const fm = fileMap.get(uri);
                            if (fm && fm.matches.length > 0) {
                                // Sort context lines by line number before sending
                                fm.contextLines.sort((a, b) => a.line - b.line);
                                onBatch([fm]);
                            }
                        }
                    } catch { /* skip malformed JSON */ }
                }
            });

            this.proc.stderr?.on('data', (chunk: Buffer) => {
                console.error('[IntelliJ Search] rg stderr:', chunk.toString().trim());
            });

            this.proc.on('close', (_code) => {
                if (!cancelled) {
                    onDone({ fileCount: fileMap.size, matchCount: totalMatches });
                }
                resolve();
            });

            this.proc.on('error', (err) => {
                cancelled = true;
                onError(`Cannot run ripgrep: ${err.message}. Make sure 'rg' is installed or accessible.`);
                resolve();
            });
        });
    }

    cancel(): void {
        if (this.proc) {
            this.proc.kill();
            this.proc = undefined;
        }
    }

    dispose(): void {
        this.cancel();
    }
}
