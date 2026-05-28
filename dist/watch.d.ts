import * as fs from 'fs';
import type { WatchConfig } from './types.js';
export interface WatchResult {
    score: number;
    grade: string;
    timestamp: Date;
}
export declare function computeWatchScore(config: WatchConfig): WatchResult;
export type RescoreCallback = (changedPath: string) => void;
export interface WatchDeps {
    watch?: typeof fs.watch;
    existsSync?: (p: string) => boolean;
    setTimeout?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
    clearTimeout?: (handle: ReturnType<typeof setTimeout>) => void;
}
export interface WatchHandle {
    close: () => void;
}
export declare function watchAgentsFile(config: WatchConfig, onRescore: RescoreCallback, deps?: WatchDeps): WatchHandle;
export declare function formatWatchResult(result: WatchResult, changedPath: string): string;
