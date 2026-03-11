# Changelog

## [0.1.0] - Initial release

### Added
- IntelliJ-style "Find in Path" dialog with regex, case-sensitive, whole-word, and .gitignore toggles
- File mask filtering (comma-separated globs, e.g. `*.ts,*.tsx`)
- Scope selector: whole project, open files, current file, or a chosen directory
- Context lines (0–5) shown above and below each match
- Results panel docked in VS Code's bottom area, grouped by file with collapsible groups
- Streaming results — results appear as the search progresses
- Click any match to jump directly to that line and column
- Virtual scrolling for result sets with many matches
- Persists last-used search options across sessions
