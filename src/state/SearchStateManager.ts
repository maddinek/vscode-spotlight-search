import * as vscode from 'vscode';
import { SearchOptions, DEFAULT_SEARCH_OPTIONS } from '../types';

const STATE_KEY = 'intellijSearch.lastOptions';

export class SearchStateManager {
    constructor(private readonly state: vscode.Memento) {}

    load(): SearchOptions {
        return this.state.get<SearchOptions>(STATE_KEY) ?? { ...DEFAULT_SEARCH_OPTIONS };
    }

    save(options: SearchOptions): void {
        this.state.update(STATE_KEY, options);
    }
}
