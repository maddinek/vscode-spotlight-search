import { FileMatch, HostMessage, WebviewMessage } from '../../src/types';
import { VirtualScroller, FlatRow } from './VirtualScroller';

declare function acquireVsCodeApi(): {
    postMessage(msg: WebviewMessage): void;
};

const vscode = acquireVsCodeApi();

// ── State ─────────────────────────────────────────────────────────────────────
let allFiles: FileMatch[] = [];
let totalMatches = 0;
let totalFiles = 0;
let isSearching = false;
let limitHit = false;
const collapsedFiles = new Set<string>();

// ── DOM refs ──────────────────────────────────────────────────────────────────
const header = document.getElementById('header')!;
const resultsContainer = document.getElementById('results')!;

// Make results container scrollable for virtual scroller
resultsContainer.style.overflow = 'auto';
resultsContainer.style.height = 'calc(100vh - 32px)';

// ── Virtual scroller ──────────────────────────────────────────────────────────
const scroller = new VirtualScroller(resultsContainer, renderFlatRow);

// ── Row building ──────────────────────────────────────────────────────────────
function buildRows(): FlatRow[] {
    const rows: FlatRow[] = [];
    allFiles.forEach((fm, fileIndex) => {
        rows.push({ type: 'file-header', fileIndex, uri: fm.uri });
        if (!collapsedFiles.has(fm.uri)) {
            if (fm.contextLines.length > 0) {
                fm.contextLines.forEach((_, itemIndex) => {
                    const ctx = fm.contextLines[itemIndex];
                    if (ctx.isMatch) {
                        rows.push({ type: 'match', fileIndex, itemIndex, uri: fm.uri });
                    } else {
                        rows.push({ type: 'context', fileIndex, itemIndex, uri: fm.uri });
                    }
                });
            } else {
                fm.matches.forEach((_, itemIndex) => {
                    rows.push({ type: 'match', fileIndex, itemIndex, uri: fm.uri });
                });
            }
        }
    });
    return rows;
}

function renderFlatRow(row: FlatRow, _index: number): HTMLElement {
    const fm = allFiles[row.fileIndex];
    if (!fm) { return document.createElement('div'); }

    if (row.type === 'file-header') {
        return renderFileHeader(fm);
    }
    if (row.type === 'context' && row.itemIndex !== undefined) {
        return renderContextRow(fm.contextLines[row.itemIndex]);
    }
    if (row.type === 'match' && row.itemIndex !== undefined) {
        if (fm.contextLines.length > 0) {
            const ctx = fm.contextLines[row.itemIndex];
            const match = fm.matches.find(m => m.line === ctx.line);
            if (match) { return renderMatchRow(fm, match, ctx.text); }
        } else {
            return renderMatchRow(fm, fm.matches[row.itemIndex], fm.matches[row.itemIndex].lineText);
        }
    }
    return document.createElement('div');
}

// ── Render helpers ────────────────────────────────────────────────────────────
function renderFileHeader(fm: FileMatch): HTMLElement {
    const parts = fm.relativePath.split('/');
    const filename = parts.pop() ?? fm.relativePath;
    const dir = parts.join('/');
    const isCollapsed = collapsedFiles.has(fm.uri);

    const el = document.createElement('div');
    el.className = `file-header${isCollapsed ? ' collapsed' : ''}`;
    el.innerHTML = `
      <span class="arrow">▾</span>
      <span class="filename">${escHtml(filename)}</span>
      ${dir ? `<span class="filepath">${escHtml(dir)}</span>` : ''}
      <span class="file-count">${fm.matches.length} match${fm.matches.length !== 1 ? 'es' : ''}</span>
    `;
    el.addEventListener('click', () => {
        if (collapsedFiles.has(fm.uri)) {
            collapsedFiles.delete(fm.uri);
        } else {
            collapsedFiles.add(fm.uri);
        }
        scroller.setRows(buildRows());
    });
    return el;
}

function renderMatchRow(fm: FileMatch, match: { line: number; column: number; matchLength: number }, lineText: string): HTMLElement {
    const row = document.createElement('div');
    row.className = 'match-row';

    const lineNum = document.createElement('span');
    lineNum.className = 'line-num';
    lineNum.textContent = String(match.line + 1);

    const lineTextEl = document.createElement('span');
    lineTextEl.className = 'line-text';

    const col = match.column;
    const len = match.matchLength;
    lineTextEl.innerHTML = `${escHtml(lineText.slice(0, col))}<span class="match">${escHtml(lineText.slice(col, col + len))}</span>${escHtml(lineText.slice(col + len))}`;

    row.appendChild(lineNum);
    row.appendChild(lineTextEl);
    row.addEventListener('click', () => {
        vscode.postMessage({ type: 'navigate', uri: fm.uri, line: match.line, column: match.column });
    });
    return row;
}

function renderContextRow(ctx: { line: number; text: string }): HTMLElement {
    const row = document.createElement('div');
    row.className = 'context-row';

    const lineNum = document.createElement('span');
    lineNum.className = 'line-num';
    lineNum.textContent = String(ctx.line + 1);

    const lineTextEl = document.createElement('span');
    lineTextEl.className = 'line-text';
    lineTextEl.textContent = ctx.text;

    row.appendChild(lineNum);
    row.appendChild(lineTextEl);
    return row;
}

function escHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Header ────────────────────────────────────────────────────────────────────
function updateHeader(): void {
    header.classList.remove('hidden');
    if (isSearching && totalFiles === 0) {
        header.innerHTML = `<span class="searching">Searching…</span>`;
    } else if (!isSearching && totalFiles === 0) {
        header.innerHTML = `<span>No results found</span>`;
    } else {
        const limitNote = limitHit ? ` <span class="limit-hit">(results capped)</span>` : '';
        header.innerHTML = `
          <span class="count">${totalMatches}</span> occurrence${totalMatches !== 1 ? 's' : ''} in
          <span class="count">${totalFiles}</span> file${totalFiles !== 1 ? 's' : ''}
          ${isSearching ? '<span class="searching"> — searching…</span>' : ''}
          ${limitNote}
        `;
    }

    // Truncation warning banner
    let warning = document.getElementById('truncation-warning');
    if (limitHit) {
        if (!warning) {
            warning = document.createElement('div');
            warning.id = 'truncation-warning';
            warning.className = 'truncation-warning';
            document.body.appendChild(warning);
        }
        warning.textContent = `Results capped at maximum limit. Refine your search to see all matches.`;
    } else if (warning) {
        warning.remove();
    }
}

// ── Message handler ───────────────────────────────────────────────────────────
function clearResults(): void {
    allFiles = [];
    totalMatches = 0;
    totalFiles = 0;
    limitHit = false;
    collapsedFiles.clear();
    scroller.setRows([]);
}

window.addEventListener('message', (event: MessageEvent) => {
    const msg = event.data as HostMessage;

    switch (msg.type) {
        case 'search-cancelled':
            clearResults();
            isSearching = true;
            updateHeader();
            break;

        case 'results-batch': {
            isSearching = true;
            for (const fm of msg.files) {
                const existing = allFiles.find(f => f.uri === fm.uri);
                if (existing) {
                    existing.matches.push(...fm.matches);
                    if (fm.contextLines.length > 0) { existing.contextLines = fm.contextLines; }
                } else {
                    allFiles.push(fm);
                    totalFiles++;
                }
                totalMatches += fm.matches.length;
            }
            scroller.setRows(buildRows());
            updateHeader();
            break;
        }

        case 'search-done':
            isSearching = false;
            totalFiles = msg.fileCount;
            totalMatches = msg.matchCount;
            limitHit = !!(msg as unknown as { limitHit?: boolean }).limitHit;
            scroller.setRows(buildRows());
            updateHeader();
            break;

        case 'search-error':
            isSearching = false;
            resultsContainer.innerHTML = `<div class="error-state">Error: ${escHtml(msg.message)}</div>`;
            updateHeader();
            break;
    }
});
