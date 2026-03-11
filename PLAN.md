# VS Code IntelliJ-style "Find in Path" Extension — Plan

## Goal

Replicate IntelliJ's Cmd+Shift+F experience:
- A rich search **dialog** (file mask, scope, regex/case/word toggles, context lines)
- A rich **results panel** docked in the bottom area (grouped by file, context lines, click to navigate, live counts)

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Extension Host (Node.js)              │
│                                                          │
│  extension.ts       SearchEngine          ResultsStore   │
│  (commands,         (findTextInFiles,     (in-memory     │
│   lifecycle)         cancellation,         model)        │
│                      result streaming)                   │
│                                                          │
│  SearchDialogPanel      ResultsPanelManager              │
│  (WebviewPanel)         (WebviewViewProvider)            │
└──────────┬──────────────────────┬───────────────────────┘
           │  postMessage/onMsg   │  postMessage/onMsg
┌──────────▼──────┐   ┌──────────▼───────────────────────┐
│  Search Dialog  │   │        Results Panel               │
│  (Webview HTML) │   │        (Webview HTML)              │
│                 │   │                                    │
│  - text input   │   │  - file group headers              │
│  - toggles      │   │  - context lines                   │
│  - scope picker │   │  - match highlighting              │
│  - file mask    │   │  - click to navigate               │
│  - context N    │   │  - count summary                   │
└─────────────────┘   └────────────────────────────────────┘
```

**Key decisions:**
- Two WebviewPanels (not TreeDataProvider) — needed for rich HTML rendering of context lines
- Results panel uses `WebviewViewProvider` in the `panel` viewsContainer → docks in bottom area like IntelliJ
- Streaming results: batched every 50ms so UI updates live during search
- Context lines fetched separately via `openTextDocument` (cached, only when contextLines > 0)

---

## File Structure

```
vscode-intellij-search/
├── package.json
├── tsconfig.json
├── tsconfig.webview.json
├── webpack.config.js
│
├── src/                            # Extension host (Node.js context)
│   ├── extension.ts
│   ├── types.ts                    # Shared types (no vscode imports)
│   ├── search/
│   │   ├── SearchEngine.ts         # findTextInFiles wrapper + streaming + cancel
│   │   ├── ScopeResolver.ts        # scope enum → include/exclude globs
│   │   └── ContextLinesFetcher.ts  # reads N lines around each match
│   ├── panels/
│   │   ├── SearchDialogPanel.ts    # dialog WebviewPanel lifecycle
│   │   ├── ResultsPanelManager.ts  # WebviewViewProvider for bottom panel
│   │   └── WebviewUtils.ts        # nonce, CSP, URI helpers
│   └── state/
│       └── SearchStateManager.ts  # persists last options via Memento
│
├── webview-src/                    # Webview front-end (browser context)
│   ├── dialog/
│   │   ├── dialog.ts
│   │   ├── dialog.html
│   │   └── dialog.css
│   └── results/
│       ├── results.ts
│       ├── results.html
│       ├── results.css
│       └── VirtualScroller.ts     # variable-height virtual list
│
└── dist/                           # compiled output (gitignored)
    ├── extension.js
    ├── webview-dialog.js
    └── webview-results.js
```

---

## Types (`src/types.ts`)

```typescript
export interface SearchOptions {
    query: string;
    isRegex: boolean;
    isCaseSensitive: boolean;
    isWholeWord: boolean;
    fileMask: string;        // e.g. "*.ts,*.tsx"
    scope: SearchScope;
    contextLines: number;    // 0-5
}

export type SearchScope = 'workspace' | 'openFiles' | 'currentFile' | 'directory';

export interface MatchLocation {
    line: number;
    column: number;
    matchLength: number;
    lineText: string;
}

export interface ContextLine {
    line: number;
    text: string;
    isMatch: boolean;
}

export interface FileMatch {
    uri: string;
    relativePath: string;
    matches: MatchLocation[];
    contextLines: ContextLine[];
}

// host → webview
export type HostMessage =
    | { type: 'init'; options: SearchOptions }
    | { type: 'results-batch'; files: FileMatch[] }
    | { type: 'search-done'; fileCount: number; matchCount: number }
    | { type: 'search-error'; message: string }
    | { type: 'search-cancelled' };

// webview → host
export type WebviewMessage =
    | { type: 'search'; options: SearchOptions }
    | { type: 'cancel' }
    | { type: 'navigate'; uri: string; line: number; column: number }
    | { type: 'ready' };
```

---

## Implementation Phases

### Phase 1 — Scaffolding & Search Core
**Goal:** command fires, search runs, results in Output Channel

- `package.json` with command, keybinding, manifest
- `tsconfig.json` + `webpack.config.js` (3 bundles: extension + 2 webviews)
- `src/types.ts`
- `src/extension.ts` — bare activate
- `src/search/SearchEngine.ts` — `findTextInFiles` + streaming + cancel
- `src/search/ScopeResolver.ts` — maps scope enum to glob options

### Phase 2 — Search Dialog
**Goal:** dialog opens, options round-trip to extension host

- `SearchDialogPanel.ts` — WebviewPanel lifecycle
- `WebviewUtils.ts` — nonce, CSP helpers
- `SearchStateManager.ts` — Memento persistence
- `webview-src/dialog/` — full HTML form with all fields
  - Keyboard: Enter submits, Escape closes, Tab cycles
  - Posts `{ type: 'search', options }` on submit
  - Receives `{ type: 'init', options }` to pre-populate

### Phase 3 — Results Panel
**Goal:** full search → rich results in bottom panel

- `ResultsPanelManager.ts` as `WebviewViewProvider` (registered under `panel` viewsContainer)
- `webview-src/results/` — file groups, context lines, match highlighting, click navigation
- Match highlight rendered as:
  ```html
  <span class="pre-match">before </span><span class="match">hit</span><span class="post-match"> after</span>
  ```
- `ContextLinesFetcher.ts` — enriches batches when contextLines > 0
- Navigation: click → `{ type: 'navigate', uri, line, column }` → `showTextDocument`

### Phase 4 — Scope & File Mask
**Goal:** all filter options functional

- All 4 scopes working (openFiles uses `tabGroups.all`, directory uses `showOpenDialog`)
- File mask: split on comma, trim, pass as `{*.ts,*.tsx}` glob
- Regex/case/word toggles wired to `TextSearchQuery`
- "Search in ignored files" toggle (`useIgnoreFiles`)

### Phase 5 — Virtual Scrolling & Performance
**Goal:** 10k+ matches render without lag

- `VirtualScroller.ts` — variable-height virtual list
- Results panel maintains `allItems[]` array, DOM window updates on scroll
- Cancel button → `engine.cancel()`
- Max results cap (default 5000) with truncation warning

### Phase 6 — Polish & Publish
**Goal:** publishable extension

- VS Code theme CSS variables throughout (`--vscode-editor-background`, etc.)
- `settings.json` config: `defaultContextLines`, `maxResults`
- `README.md`, `CHANGELOG.md`, `.vscodeignore`
- `vsce package`

---

## Key Gotchas

| Issue | Mitigation |
|-------|------------|
| `preview.text` vs `ranges` for highlighting | Use `preview.matches` (relative to preview text), not document-level `ranges` |
| Keybinding conflict with built-in Cmd+Shift+F | Default to `Cmd+Shift+Alt+F` or document how to override |
| `openTextDocument` for context lines at scale | LRU cache, skip when contextLines=0 |
| Multi-root workspace globs | Use `RelativePattern` per workspace folder |
| CSP nonce | Regenerate per panel creation via `crypto.randomBytes(16).toString('base64')` |
| File mask with spaces (`*.ts, *.tsx`) | Trim each segment after comma-split |
| `resultCount` in `TextSearchComplete` = matches not files | Track file count via a `Set<string>` of URIs in callback |
| Webview bundles must not import `vscode` | Keep `types.ts` free of vscode types |

---

## `findTextInFiles` API Quick Reference

```typescript
vscode.workspace.findTextInFiles(
    query: {
        pattern: string;
        isRegex?: boolean;
        isCaseSensitive?: boolean;
        isWordMatch?: boolean;
    },
    options: {
        include?: GlobPattern;
        exclude?: GlobPattern;
        maxResults?: number;
        useIgnoreFiles?: boolean;  // default true (respects .gitignore)
    },
    callback: (result: TextSearchMatch) => void,
    token?: CancellationToken
): Thenable<{ resultCount: number; limitHit: boolean }>
```

`TextSearchMatch.preview.matches` — use these ranges (relative to `preview.text`) for correct highlight column positions.
