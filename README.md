# IntelliJ Find in Path — VS Code Extension

Brings IntelliJ IDEA's powerful **Find in Path** experience to VS Code: a feature-rich search dialog with streaming results, context lines, file grouping, and one-click navigation.

---

## Why use this instead of VS Code's built-in search?

VS Code's built-in search is solid, but it lacks several workflow features that IntelliJ users rely on:

| Feature | VS Code built-in | This extension |
|---|---|---|
| Context lines (N lines above/below) | No | Yes (0–5) |
| Results grouped by file with counts | Basic | Rich grouping with collapsible sections |
| Streaming results as search progresses | No | Yes |
| File mask filter (e.g. `*.ts,*.tsx`) | Partial | Yes, comma-separated globs |
| Scope: project / open files / current file / directory | No | Yes |
| Virtual scrolling for large result sets | No | Yes |
| Persistent last-used options | No | Yes |

---

## Screenshot

> _Screenshot placeholder — add a screenshot of the dialog and results panel here._

---

## Keybinding

| Platform | Default shortcut |
|---|---|
| macOS | `Cmd+Shift+Alt+F` |
| Windows / Linux | `Ctrl+Shift+Alt+F` |

The shortcut is intentionally offset from `Cmd+Shift+F` to avoid conflicting with VS Code's built-in search. If you want to **replace** the built-in search shortcut, see below.

### Override `Cmd+Shift+F` (macOS) to open this extension instead

Open your keybindings file (`Cmd+Shift+P` → **Preferences: Open Keyboard Shortcuts (JSON)**) and add:

```json
[
  {
    "key": "cmd+shift+f",
    "command": "-workbench.action.findInFiles"
  },
  {
    "key": "cmd+shift+f",
    "command": "intellijSearch.open",
    "when": "!terminalFocus"
  }
]
```

For Windows/Linux, replace `cmd` with `ctrl`.

---

## Features

- **Streaming results** — matches appear in the panel as the search runs; you don't have to wait for it to finish.
- **File grouping** — results are grouped by file with collapsible sections and per-file match counts.
- **Context lines** — show 0–5 lines of surrounding code above and below each match.
- **Regex / case-sensitive / whole-word filters** — standard search modifiers available in the dialog.
- **Scope selector** — search the whole project, only open files, the current file, or pick a specific directory.
- **File mask** — restrict results to specific file types using comma-separated globs (e.g. `*.ts,*.tsx`).
- **Respects `.gitignore`** — ignored files are excluded from results by default (toggle available in dialog).
- **Click to navigate** — click any match or context line to jump directly to that line and column in the editor.
- **Virtual scrolling** — result lists with thousands of entries remain smooth and responsive.
- **Persistent options** — your last-used search settings are remembered across sessions.

---

## Configuration

Open VS Code settings (`Cmd+,`) and search for **IntelliJ Search**, or edit `settings.json` directly:

| Setting | Type | Default | Description |
|---|---|---|---|
| `intellijSearch.defaultContextLines` | number | `1` | Number of context lines to show above and below each match (0–5). |
| `intellijSearch.maxResults` | number | `5000` | Maximum number of results to display before truncating. |

---

## Known Limitations

- **Results panel visibility** — the results panel lives in VS Code's bottom panel area under the "Find in Path" tab. If you have closed that panel, results won't be visible. Use **View → Appearance → Panel** to show it, or click the tab that appears after running a search.
- **Dialog opens as an editor tab** — the search dialog is implemented as a webview editor tab rather than a floating modal window. This is a VS Code API constraint; there is no way to create a true floating dialog outside the editor area.
