export type RowType = 'file-header' | 'match' | 'context' | 'spacer';

export interface FlatRow {
    type: RowType;
    /** index into allFiles array */
    fileIndex: number;
    /** index into file.matches (for match rows) or file.contextLines (for context rows) */
    itemIndex?: number;
    uri: string;
}

const ROW_HEIGHT = 22; // px — approximate, good enough for single-line rows
const OVERSCAN = 10;   // render this many extra rows above/below viewport

export class VirtualScroller {
    private rows: FlatRow[] = [];
    private container: HTMLElement;
    private viewport: HTMLElement;
    private spacerTop: HTMLElement;
    private spacerBottom: HTMLElement;
    private visibleStart = 0;
    private visibleEnd = 0;
    private renderRow: (row: FlatRow, index: number) => HTMLElement;
    private renderedRange: [number, number] = [0, 0];
    private scrollRAF: number | null = null;

    constructor(
        container: HTMLElement,
        renderRow: (row: FlatRow, index: number) => HTMLElement
    ) {
        this.container = container;
        this.renderRow = renderRow;

        this.viewport = document.createElement('div');
        this.viewport.style.position = 'relative';
        container.appendChild(this.viewport);

        this.spacerTop = document.createElement('div');
        this.spacerBottom = document.createElement('div');
        this.viewport.appendChild(this.spacerTop);
        this.viewport.appendChild(this.spacerBottom);

        container.addEventListener('scroll', () => {
            if (this.scrollRAF !== null) { return; }
            this.scrollRAF = requestAnimationFrame(() => {
                this.scrollRAF = null;
                this.updateVisibleWindow();
            });
        });
    }

    setRows(rows: FlatRow[]): void {
        this.rows = rows;
        this.viewport.style.height = `${rows.length * ROW_HEIGHT}px`;
        this.renderedRange = [0, 0];
        // Clear all content except spacers
        while (this.viewport.firstChild) {
            this.viewport.removeChild(this.viewport.firstChild);
        }
        this.viewport.appendChild(this.spacerTop);
        this.viewport.appendChild(this.spacerBottom);
        this.updateVisibleWindow();
    }

    appendRows(newRows: FlatRow[]): void {
        this.rows.push(...newRows);
        this.viewport.style.height = `${this.rows.length * ROW_HEIGHT}px`;
        this.updateVisibleWindow();
    }

    private updateVisibleWindow(): void {
        const scrollTop = this.container.scrollTop;
        const viewHeight = this.container.clientHeight;

        const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
        const end = Math.min(this.rows.length, Math.ceil((scrollTop + viewHeight) / ROW_HEIGHT) + OVERSCAN);

        if (start === this.renderedRange[0] && end === this.renderedRange[1]) { return; }

        // Remove rows outside the new window
        const toRemove: HTMLElement[] = [];
        this.viewport.querySelectorAll('[data-row-index]').forEach(el => {
            const idx = parseInt((el as HTMLElement).dataset.rowIndex ?? '-1', 10);
            if (idx < start || idx >= end) { toRemove.push(el as HTMLElement); }
        });
        toRemove.forEach(el => el.remove());

        // Add new rows that are now in window
        const existing = new Set<number>();
        this.viewport.querySelectorAll('[data-row-index]').forEach(el => {
            existing.add(parseInt((el as HTMLElement).dataset.rowIndex ?? '-1', 10));
        });

        const fragment = document.createDocumentFragment();
        for (let i = start; i < end; i++) {
            if (existing.has(i)) { continue; }
            const el = this.renderRow(this.rows[i], i);
            el.dataset.rowIndex = String(i);
            el.style.position = 'absolute';
            el.style.top = `${i * ROW_HEIGHT}px`;
            el.style.width = '100%';
            fragment.appendChild(el);
        }
        this.spacerBottom.before(fragment);

        this.renderedRange = [start, end];
    }

    getRows(): FlatRow[] { return this.rows; }
}
