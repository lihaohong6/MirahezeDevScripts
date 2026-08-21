/**
 * three.js is fetched from jsDelivr at runtime rather than bundled.
 *
 * The gadget runs on every page view of every adopting wiki, and three.js is
 * some 200 KB gzipped. Nothing here touches the network until a page contains a
 * viewer, and each loader addon is pulled only when a model needs it.
 */

/**
 * Keep in step with the `@types/three` devDependency, which only type-checks
 * against the version this runs on and never reaches the bundle.
 */
export const THREE_VERSION = '0.185.1';
export const THREE_BASE = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/`;

const IMPORT_MAP = {
    imports: {
        // The minified build splits into three.module + three.core; the former
        // imports the latter relatively, so only the entry needs mapping.
        'three': THREE_BASE + 'build/three.module.min.js',
        // Every examples/jsm addon imports 'three' and nothing else by bare
        // specifier; its other imports are relative to this prefix.
        'three/addons/': THREE_BASE + 'examples/jsm/',
    },
};

const MAP_ID = 'model-viewer-importmap';

export class UnsupportedBrowserError extends Error {}

function importMapsSupported(): boolean {
    return typeof HTMLScriptElement !== 'undefined'
        && typeof HTMLScriptElement.supports === 'function'
        && HTMLScriptElement.supports('importmap');
}

/**
 * Without multiple-import-map support a second map cannot override the first,
 * so a page that maps `three` itself wins and we leave it alone.
 */
function pageAlreadyMapsThree(): boolean {
    const maps = document.querySelectorAll<HTMLScriptElement>('script[type="importmap"]');
    for (const map of Array.from(maps)) {
        if (map.id === MAP_ID) {
            return true;
        }
        try {
            if (JSON.parse(map.textContent || '{}')?.imports?.three) {
                return true;
            }
        } catch {
            /* someone else's malformed map is not our problem */
        }
    }
    return false;
}

let mapReady = false;

/**
 * Must run before the first dynamic import: a map is only honoured while no
 * module has been resolved yet.
 */
export function ensureImportMap(): void {
    if (mapReady) {
        return;
    }
    if (!importMapsSupported()) {
        throw new UnsupportedBrowserError(
            'This browser does not support import maps, which the 3D viewer needs.');
    }
    if (!pageAlreadyMapsThree()) {
        const script = document.createElement('script');
        script.type = 'importmap';
        script.id = MAP_ID;
        script.textContent = JSON.stringify(IMPORT_MAP);
        (document.head || document.documentElement).appendChild(script);
    }
    mapReady = true;
}

const cache = new Map<string, Promise<unknown>>();

/**
 * The specifier is a variable on purpose: a literal would let Rollup resolve
 * it at build time and pull three.js into the bundle.
 */
export function importModule<T = Record<string, never>>(specifier: string): Promise<T> {
    let pending = cache.get(specifier);
    if (!pending) {
        ensureImportMap();
        pending = import(/* @vite-ignore */ specifier);
        cache.set(specifier, pending);
    }
    return pending as Promise<T>;
}

/** `three/addons/loaders/GLTFLoader.js` and friends. */
export function importAddon<T = Record<string, never>>(path: string): Promise<T> {
    return importModule<T>('three/addons/' + path);
}
