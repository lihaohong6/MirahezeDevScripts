/**
 * Animation transport: clip selection, play/pause, scrubbing and speed.
 *
 * A clip either travelled inside the model file or is named by `data-anim` and
 * fetched when first chosen. Exporters that write a file per clip produce far
 * more animation than model, so the entry list is kept apart from the clips.
 */

import type * as THREE from 'three';

import { PartRule, parsePartNames } from './parts';

type RestEntry = [THREE.Object3D, THREE.Vector3, THREE.Quaternion, THREE.Vector3];

export interface AnimEntry extends PartRule {
    name: string;
    /** null for a clip that came with the model. */
    src: string | null;
    /** Seconds. Zero for an external clip until the file has been read. */
    duration: number;
    /** Filled in with the model, or once the file has been fetched. */
    clip: THREE.AnimationClip | null;
    /** Set once the file has been asked for and could not be had. */
    failed: boolean;
}

/** Fetches the file behind an entry; resolves null if it holds no clip. */
export type AnimLoader = (entry: AnimEntry) => Promise<THREE.AnimationClip | null>;

export function embeddedEntry(clip: THREE.AnimationClip, index: number): AnimEntry {
    return {
        name: clip.name || `Clip ${index + 1}`,
        src: null,
        duration: clip.duration,
        clip,
        failed: false,
    };
}

/** Name a clip after its file when nothing else does: `103_Idle.glb` → `103_Idle`. */
export function nameFromUrl(url: string): string {
    const path = decodeURIComponent(url.split(/[?#]/)[0]);
    const file = path.slice(path.lastIndexOf('/') + 1);
    const dot = file.lastIndexOf('.');
    return dot > 0 ? file.slice(0, dot) : file;
}

/**
 * `data-anim` is a comma-separated list of clip files, each named after its file
 * unless written `Label=url`. Only a comma separates entries, never whitespace,
 * or `Idle Pose=url` would be torn at its own space; a long list can therefore
 * go one URL per line, each ending in a comma.
 *
 * A JSON array, detected by a leading `[` as in `data-models`, is the only way
 * to give a clip more than a name and a URL (`show`/`hide`).
 */
export function resolveAnimEntries(spec: string): AnimEntry[] {
    const trimmed = spec.trim();
    if (trimmed.startsWith('[')) {
        return resolveAnimEntriesJson(trimmed);
    }
    return spec
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => {
            // A URL carries `=` too, so what precedes it must not look like one.
            const at = item.indexOf('=');
            const label = at > 0 && !/[/:]/.test(item.slice(0, at))
                ? item.slice(0, at).trim()
                : null;
            const src = label === null ? item : item.slice(at + 1).trim();
            return {
                name: label || nameFromUrl(src),
                src,
                duration: 0,
                clip: null,
                failed: false,
            };
        })
        .filter((entry) => !!entry.src);
}

function resolveAnimEntriesJson(spec: string): AnimEntry[] {
    let parsed: unknown;
    try {
        parsed = JSON.parse(spec);
    } catch {
        return [];
    }
    return Array.isArray(parsed)
        ? parsed.map(animEntryFromJson).filter((entry): entry is AnimEntry => !!entry)
        : [];
}

/**
 * One entry from a JSON item: a bare URL, or `{ name?, src, show?, hide? }`.
 * Null for anything unusable, so a bad item drops instead of failing the parse.
 */
export function animEntryFromJson(item: unknown): AnimEntry | null {
    const raw = typeof item === 'string'
        ? { src: item }
        : (item && typeof item === 'object' ? item as Record<string, unknown> : null);
    const src = typeof raw?.src === 'string' ? raw.src.trim() : '';
    if (!src) {
        return null;
    }
    const name = typeof raw?.name === 'string' && raw.name.trim() ? raw.name.trim() : nameFromUrl(src);
    return {
        name,
        src,
        duration: 0,
        clip: null,
        failed: false,
        show: parsePartNames(raw?.show),
        hide: parsePartNames(raw?.hide),
    };
}

export class AnimationController {
    private mixer: THREE.AnimationMixer | null = null;
    private action: THREE.AnimationAction | null = null;
    private rest: RestEntry[] = [];
    /** Bumped by every stop, so a fetch that lands late is discarded. */
    private token = 0;
    /** In-flight fetches, so a double click on a clip does not make two. */
    private inFlight = new Map<string, Promise<THREE.AnimationClip | null>>();
    private pending = 0;
    /**
     * `clampWhenFinished` pauses a non-looping clip at its end, which `playing`
     * has to hear about or the transport goes on reporting it as playing.
     */
    private handleFinished = (event: { action: THREE.AnimationAction }): void => {
        if (event.action === this.action) {
            this.playing = false;
        }
    };

    /** Percent, as the slider reports it. */
    speed = 100;
    loop = true;
    playing = false;
    /** Index into `entries`, or -1 for the bind pose. */
    currentIndex = -1;

    constructor(
        private three: typeof THREE,
        private root: THREE.Object3D,
        readonly entries: AnimEntry[],
        private fetchAnim: AnimLoader | null = null,
    ) {
        this.captureRestPose();
    }

    get available(): boolean {
        return this.entries.length > 0;
    }

    get active(): boolean {
        return !!this.action;
    }

    /** True while a clip file is on its way. */
    get loading(): boolean {
        return this.pending > 0;
    }

    get duration(): number {
        return this.action ? this.action.getClip().duration : 0;
    }

    get time(): number {
        const duration = this.duration;
        return duration ? this.action!.time % duration : 0;
    }

    /**
     * A clip carries tracks only for what it moves, so the previous clip's pose
     * has to be restored, not animated away.
     */
    private captureRestPose(): void {
        this.rest = [];
        this.root.traverse((object) => {
            this.rest.push([
                object,
                object.position.clone(),
                object.quaternion.clone(),
                object.scale.clone(),
            ]);
        });
    }

    private restoreRestPose(): void {
        for (const [object, position, quaternion, scale] of this.rest) {
            object.position.copy(position);
            object.quaternion.copy(quaternion);
            object.scale.copy(scale);
        }
    }

    /**
     * glTF splits one authored mesh into an object per material, each carrying
     * the shapes, so a morph track named after the original needs a copy on each.
     */
    private retargetMorphTracks(clip: THREE.AnimationClip): THREE.AnimationClip {
        const tracks: THREE.KeyframeTrack[] = [];
        let changed = false;
        for (const track of clip.tracks) {
            if (!track.name.endsWith('.morphTargetInfluences')) {
                tracks.push(track);
                continue;
            }
            const node = this.root.getObjectByName(
                track.name.slice(0, track.name.lastIndexOf('.')));
            if (!node) {
                tracks.push(track);
                continue;
            }
            changed = true;
            node.traverse((object) => {
                if (!(object as THREE.Mesh).morphTargetInfluences) {
                    return;
                }
                const copy = track.clone();
                copy.name = `${object.name}.morphTargetInfluences`;
                tracks.push(copy);
            });
        }
        return changed
            ? new this.three.AnimationClip(clip.name, clip.duration, tracks)
            : clip;
    }

    stop(): void {
        this.token++;
        if (this.mixer) {
            this.mixer.stopAllAction();
            this.mixer.uncacheRoot(this.root as THREE.Object3D);
            this.mixer.removeEventListener('finished', this.handleFinished);
        }
        this.mixer = null;
        this.action = null;
        this.playing = false;
        this.currentIndex = -1;
        this.restoreRestPose();
    }

    /**
     * A clip binds by node name, so one exported alone with just the skeleton
     * retargets onto the model.
     */
    private async resolve(entry: AnimEntry): Promise<THREE.AnimationClip | null> {
        if (entry.clip || !entry.src || !this.fetchAnim) {
            return entry.clip;
        }
        let request = this.inFlight.get(entry.src);
        if (!request) {
            request = this.fetchAnim(entry);
            this.inFlight.set(entry.src, request);
            this.pending++;
            request
                .catch(() => null)
                .then(() => {
                    this.pending--;
                    this.inFlight.delete(entry.src!);
                });
        }
        // One unreachable clip is recorded on its entry for the drop-down to report.
        let clip: THREE.AnimationClip | null = null;
        try {
            clip = await request;
        } catch (error) {
            mw.log.warn(`[ModelViewer] could not load the clip ${entry.src}`, error);
        }
        if (clip) {
            entry.clip = clip;
            entry.duration = clip.duration;
        } else {
            entry.failed = true;
        }
        return clip;
    }

    /** Index into `entries`; anything out of range returns to the bind pose. */
    async play(index: number): Promise<void> {
        this.stop();
        const entry = this.entries[index];
        if (!entry) {
            return;
        }
        // Set before the fetch, so the drop-down and a second call agree.
        this.currentIndex = index;
        const token = this.token;
        const clip = await this.resolve(entry);
        // The user may have moved on to another clip while that was on its way.
        if (!clip || token !== this.token) {
            return;
        }
        this.mixer = new this.three.AnimationMixer(this.root);
        this.mixer.addEventListener('finished', this.handleFinished);
        this.action = this.mixer.clipAction(this.retargetMorphTracks(clip));
        this.applyLoop();
        this.action.play();
        this.playing = true;
        this.mixer.update(0);
    }

    private applyLoop(): void {
        if (!this.action) {
            return;
        }
        this.action.setLoop(
            this.loop ? this.three.LoopRepeat : this.three.LoopOnce, Infinity);
        this.action.clampWhenFinished = !this.loop;
    }

    setLoop(loop: boolean): void {
        this.loop = loop;
        this.applyLoop();
    }

    setPlaying(playing: boolean): void {
        if (playing && this.action?.paused) {
            // `clampWhenFinished` leaves a finished clip paused on its last frame,
            // so there is nothing to resume; play starts it over.
            this.action.reset();
        }
        this.playing = playing && !!this.action;
    }

    /** `fraction` is 0–1 through the clip. */
    seek(fraction: number): void {
        if (!this.action || !this.mixer) {
            return;
        }
        this.action.time = this.duration * Math.min(Math.max(fraction, 0), 1);
        // The mixer writes the pose, so a zero-length update is what shows a scrub.
        this.mixer.update(0);
    }

    update(delta: number): void {
        if (this.mixer && this.playing) {
            this.mixer.update(delta * this.speed / 100);
        }
    }

    dispose(): void {
        this.stop();
        this.rest = [];
        this.inFlight.clear();
    }
}
