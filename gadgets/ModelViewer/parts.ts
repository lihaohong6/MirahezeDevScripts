/**
 * Per-clip part visibility.
 *
 * A character model often ships with props the game keeps switched off and
 * swaps in by script: a cat, a phone, an alternate face overlay. They hang off
 * sockets most clips never animate, so leaving them on means watching them
 * drift through the model during every other animation.
 *
 * So each clip states what it needs on screen, through `show`/`hide` on its
 * entry, plus `data-hide-parts` for what stays off unless a clip asks. All take
 * part names; a name is one object or a group of them (see `resolvePart`).
 */

import type * as THREE from 'three';

export interface PartRule {
    /** Parts hidden while this clip is the one playing. */
    hide?: string[];
    /**
     * Parts shown while this clip plays, overriding `hide` and the baseline.
     * Only turns things on; a part not in the baseline is already on.
     */
    show?: string[];
}

/**
 * A `show`/`hide` value in JSON: one part (`"Cat"`) or several. Undefined when
 * it names nothing, so an absent field and an empty one behave alike.
 */
export function parsePartNames(value: unknown): string[] | undefined {
    const items = typeof value === 'string' ? [value] : (Array.isArray(value) ? value : null);
    if (!items) {
        return undefined;
    }
    const names = items
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean);
    return names.length ? names : undefined;
}

/** `data-hide-parts="optional, phone"`: comma-separated, as everywhere else. */
export function parsePartList(spec: string | null): string[] {
    return (spec || '').split(',').map((name) => name.trim()).filter(Boolean);
}

/**
 * Names as three.js holds them: `GLTFLoader` runs every node name through
 * `PropertyBinding.sanitizeNodeName`, which turns whitespace into `_` and drops
 * the characters an animation path reserves. A rule naming a part the way the
 * file does — `weapon bag` — would otherwise match nothing.
 */
function sanitize(name: string): string {
    return name.replace(/\s/g, '_').replace(/[[\].:/]/g, '').toLowerCase();
}

/**
 * A part name resolves in two steps:
 *
 * 1. objects named `name`, case-insensitively. Visibility takes the whole
 *    subtree with it, so one name covers a mesh, glTF's split primitives, or a
 *    whole socket.
 * 2. failing that, objects with `name` as a truthy key in their glTF `extras`,
 *    which `GLTFLoader` copies onto `userData`, so a model exported with
 *    `{"optional": true}` on its swap-in parts answers to `optional`.
 *
 * Either way the match brings its meshes with it, because the two steps do not
 * land on the same objects: glTF splits a mesh with several materials into one
 * object per primitive under a group, and the group is what carries the name
 * while the primitives are what carry the `extras`.
 */
function resolvePart(root: THREE.Object3D, name: string): THREE.Object3D[] {
    const wanted = sanitize(name);
    const byName: THREE.Object3D[] = [];
    const byFlag: THREE.Object3D[] = [];
    root.traverse((object) => {
        if (object.userData.isOutline) {
            return;
        }
        if (sanitize(object.name) === wanted) {
            byName.push(object);
            return;
        }
        for (const [key, value] of Object.entries(object.userData)) {
            if (value && key.toLowerCase() === wanted) {
                byFlag.push(object);
                return;
            }
        }
    });
    return withMeshes(byName.length ? byName : byFlag);
}

/**
 * Outline hulls stay out: a hull follows the mesh it wraps, and forcing one
 * visible would draw an outline the reader has switched off.
 */
function withMeshes(matches: THREE.Object3D[]): THREE.Object3D[] {
    const found = new Set<THREE.Object3D>();
    for (const match of matches) {
        found.add(match);
        match.traverse((object) => {
            if ((object as THREE.Mesh).isMesh && !object.userData.isOutline) {
                found.add(object);
            }
        });
    }
    return [...found];
}

/**
 * The objects one model's clips can address, held in the state the current clip
 * asks for. Built and discarded per model load, with the animation controller.
 */
export class PartLayer {
    /** Part name → the objects it names. Only names some rule mentions are resolved. */
    private targets = new Map<string, THREE.Object3D[]>();
    /** How the file left each object we touch, so nothing comes back more visible. */
    private original = new Map<THREE.Object3D, boolean>();

    /**
     * `names` is every part any rule mentions; `baseline` is the subset that
     * starts hidden, which is `data-hide-parts` alone. `show` shows a part and
     * does not imply it is hidden the rest of the time.
     */
    constructor(
        root: THREE.Object3D,
        names: string[],
        private baseline: string[],
    ) {
        for (const name of new Set(names.map((name) => name.toLowerCase()))) {
            const found = resolvePart(root, name);
            if (!found.length) {
                continue;
            }
            this.targets.set(name, found);
            for (const object of found) {
                if (!this.original.has(object)) {
                    this.original.set(object, object.visible);
                }
            }
        }
    }

    /** False when nothing any rule names is actually in this model. */
    get available(): boolean {
        return this.targets.size > 0;
    }

    private set(names: string[] | undefined, visible: boolean): void {
        for (const name of names || []) {
            for (const object of this.targets.get(name.toLowerCase()) || []) {
                object.visible = visible;
            }
        }
    }

    /**
     * Hide first, show second, so `{ "hide": "optional", "show": "Cat" }` reads
     * the way it looks. No rule, as for the bind pose or a clip that says
     * nothing, leaves the baseline hidden and the rest as the file had it.
     */
    apply(rule?: PartRule): void {
        for (const [object, visible] of this.original) {
            object.visible = visible;
        }
        this.set(this.baseline, false);
        this.set(rule?.hide, false);
        this.set(rule?.show, true);
    }
}
