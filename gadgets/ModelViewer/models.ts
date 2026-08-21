/**
 * Multiple models in one viewer: `data-models` names the files beyond the
 * primary `data-src`, and `data-model-anim` gives any of them clips of their
 * own on top of the shared `data-anim` library. Mirrors the `AnimEntry`/
 * `resolveAnimEntries` split in animation.ts.
 */

import { AnimEntry, animEntryFromJson, nameFromUrl } from './animation';

export interface ModelEntry {
    name: string;
    src: string;
    format: string | null;
    mtl: string | null;
    /**
     * Clips beyond the shared `data-anim` library; filled in from
     * `data-model-anim` after construction (see viewer.ts).
     */
    anims: AnimEntry[];
}

/**
 * `data-models` takes `data-anim`'s two formats (see `resolveAnimEntries`). JSON
 * items are a bare URL or `{ name?, src, format?, mtl? }`, the only way to
 * override a model's auto-detected format or name an .mtl.
 */
export function resolveModelEntries(spec: string): ModelEntry[] {
    const trimmed = spec.trim();
    if (trimmed.startsWith('[')) {
        return resolveModelEntriesJson(trimmed);
    }
    return spec
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => {
            const at = item.indexOf('=');
            const label = at > 0 && !/[/:]/.test(item.slice(0, at))
                ? item.slice(0, at).trim()
                : null;
            const url = label === null ? item : item.slice(at + 1).trim();
            return { name: label || nameFromUrl(url), src: url, format: null, mtl: null, anims: [] };
        })
        .filter((entry) => !!entry.src);
}

function resolveModelEntriesJson(spec: string): ModelEntry[] {
    let parsed: unknown;
    try {
        parsed = JSON.parse(spec);
    } catch {
        return [];
    }
    if (!Array.isArray(parsed)) {
        return [];
    }
    return parsed
        .map((item): ModelEntry | null => {
            const raw = typeof item === 'string'
                ? { src: item }
                : (item && typeof item === 'object' ? item as Record<string, unknown> : null);
            const src = typeof raw?.src === 'string' ? raw.src.trim() : '';
            if (!src) {
                return null;
            }
            const name = typeof raw?.name === 'string' && raw.name.trim()
                ? raw.name.trim() : nameFromUrl(src);
            const format = typeof raw?.format === 'string' && raw.format.trim()
                ? raw.format.trim() : null;
            const mtl = typeof raw?.mtl === 'string' && raw.mtl.trim() ? raw.mtl.trim() : null;
            return {
                name, src, format, mtl, anims: [],
            };
        })
        .filter((entry): entry is ModelEntry => !!entry);
}

export interface ModelAnimGroup {
    /** Name or index; see `findModelIndex` in viewer.ts. */
    key: string;
    anims: AnimEntry[];
}

/**
 * `data-model-anim` is JSON-only: plain text has one delimiter layer and this
 * needs two. An object mapping a model key (`findModelIndex` in viewer.ts) to
 * clip entries (`animEntryFromJson`); a bad value or empty list drops.
 */
export function resolveModelAnim(spec: string): ModelAnimGroup[] {
    let parsed: unknown;
    try {
        parsed = JSON.parse(spec);
    } catch {
        return [];
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return [];
    }
    const groups: ModelAnimGroup[] = [];
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (!Array.isArray(value)) {
            continue;
        }
        const anims = value
            .map(animEntryFromJson)
            .filter((entry): entry is AnimEntry => !!entry);
        if (anims.length) {
            groups.push({ key, anims });
        }
    }
    return groups;
}
