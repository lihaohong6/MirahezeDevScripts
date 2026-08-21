/**
 * The viewer itself: renderer, scene, camera, framing and the render loop.
 */

import type * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

import { importAddon, importModule } from './three-cdn';
import { loadModel } from './formats';
import { OutlineLayer, OutlineSettings } from './outline';
import {
    AnimationController, AnimEntry, embeddedEntry, nameFromUrl, resolveAnimEntries,
} from './animation';
import { ModelEntry, resolveModelEntries, resolveModelAnim } from './models';
import { PartLayer, parsePartList } from './parts';

/**
 * `unlit` swaps the material out, `wireframe` only sets a flag on it, so the
 * two are one exclusive mode instead of two booleans that could fight.
 */
export type ShadingMode = 'shaded' | 'unlit' | 'wireframe';

export interface ViewerOptions {
    /** `data-src`: the primary model. */
    src: string;
    format: string | null;
    mtl: string | null;
    /** `data-anim`: clip files to offer beyond the model's own. */
    anim: string | null;
    /** `data-models`: additional model files beyond `src` (see `buildModels()`). */
    models: string | null;
    /** `data-model-anim`: per-model clips (see `resolveModelAnim` in models.ts). */
    modelAnim: string | null;
    /** `data-model-default`: initial model selection. */
    modelDefault: string | null;
    /** `data-hide-parts`: parts hidden unless a clip asks for them; see parts.ts. */
    hideParts: string | null;
    background: string | null;
    environment: string;
    toneMapping: string;
    exposure: number;
    fov: number;
    camera: [number, number, number] | null;
    autorotate: boolean;
    grid: boolean;
    shading: ShadingMode;
    autoplay: boolean;
    /** `data-anim-default`: name or index of the clip to open on. */
    animDefault: string | null;
    loop: boolean;
    speed: number;
    outline: OutlineSettings;
}

const TONE_MAPPINGS: Record<string, string> = {
    none: 'NoToneMapping',
    linear: 'LinearToneMapping',
    reinhard: 'ReinhardToneMapping',
    cineon: 'CineonToneMapping',
    aces: 'ACESFilmicToneMapping',
    agx: 'AgXToneMapping',
    neutral: 'NeutralToneMapping',
};

/** A tab left in the background hands back one huge delta on return. */
const MAX_DELTA = 0.1;

export class Viewer {
    private three!: typeof THREE;
    private renderer!: THREE.WebGLRenderer;
    private scene!: THREE.Scene;
    private camera!: THREE.PerspectiveCamera;
    private orbit!: OrbitControls;
    private timer!: THREE.Timer;
    private grid: THREE.GridHelper | null = null;
    private root: THREE.Object3D | null = null;
    private bounds: { center: THREE.Vector3; size: THREE.Vector3 } | null = null;
    private fitDistance = 0;
    private resizeObserver: ResizeObserver | null = null;
    private running = false;
    /** Built lazily by `setUnlitMaterial()`. */
    private unlitCache = new Map<THREE.Mesh, {
        original: THREE.Material | THREE.Material[];
        unlit: THREE.Material | THREE.Material[];
    }>();

    outline: OutlineLayer | null = null;
    animation: AnimationController | null = null;
    /** Which of this model's parts the current clip wants on screen. */
    parts: PartLayer | null = null;

    /** Every model this viewer can show; see `buildModels()`. */
    models: ModelEntry[] = [];
    currentModelIndex = 0;
    /** True while a model switch is fetching a new file. */
    modelLoading = false;
    /** Bumped on every `loadModelEntry` call, so a superseded fetch is discarded. */
    private modelToken = 0;
    /** `data-anim`, parsed once so switching models does not re-fetch it. */
    private globalAnims: AnimEntry[] = [];
    /** `data-hide-parts`, the parts that start hidden for every clip. */
    private hidden: string[] = [];

    /** Fired once the model is in the scene, for the control widgets. */
    onReady: (() => void) | null = null;
    /** Fired every rendered frame, so the transport widgets can follow. */
    onFrame: (() => void) | null = null;
    onStatus: ((text: string, kind: 'info' | 'error' | 'none') => void) | null = null;
    /** Download progress, 0–1, or null while the total size is unknown. */
    onProgress: ((fraction: number | null) => void) | null = null;
    /** Fired once a clip has actually started playing, for outside listeners. */
    onAnimChange: ((index: number) => void) | null = null;
    /** Fired once a model has finished loading and is on screen. */
    onModelChange: ((index: number) => void) | null = null;

    constructor(
        private container: HTMLElement,
        private canvas: HTMLCanvasElement,
        private options: ViewerOptions,
    ) {
        this.models = this.buildModels();
        this.globalAnims = this.options.anim ? resolveAnimEntries(this.options.anim) : [];
        this.hidden = parsePartList(this.options.hideParts);
    }

    /**
     * With no `src`, `data-models` is the whole list and its first entry becomes
     * model 0, which `data-model-anim` keys then address directly.
     * `data-format`/`data-mtl` only ever apply to an explicit `src`.
     */
    private buildModels(): ModelEntry[] {
        const extra = this.options.models ? resolveModelEntries(this.options.models) : [];
        const primary: ModelEntry | null = this.options.src ? {
            name: nameFromUrl(this.options.src) || 'Model 1',
            src: this.options.src,
            format: this.options.format,
            mtl: this.options.mtl,
            anims: [],
        } : null;
        const models = primary ? [primary, ...extra] : extra;
        if (this.options.modelAnim) {
            for (const group of resolveModelAnim(this.options.modelAnim)) {
                const index = this.findModelIndex(group.key, models);
                if (models[index]) {
                    models[index].anims = models[index].anims.concat(group.anims);
                }
            }
        }
        return models;
    }

    /** A name or an index, the convention `resolveAnimIndex()` also follows. */
    private findModelIndex(wanted: string, models: ModelEntry[]): number {
        const byName = models.findIndex((model) => model.name === wanted);
        if (byName >= 0) {
            return byName;
        }
        const asIndex = Number(wanted);
        return Number.isInteger(asIndex) && models[asIndex] ? asIndex : -1;
    }

    private resolveModelIndex(): number {
        if (!this.options.modelDefault) {
            return 0;
        }
        const index = this.findModelIndex(this.options.modelDefault, this.models);
        return index >= 0 ? index : 0;
    }

    private status(text: string, kind: 'info' | 'error' | 'none' = 'info'): void {
        this.onStatus?.(text, kind);
    }

    async mount(): Promise<void> {
        this.status('Loading 3D viewer…');
        this.three = await importModule<typeof THREE>('three');
        const three = this.three;

        this.renderer = new three.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: !this.options.background,
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.outputColorSpace = three.SRGBColorSpace;
        const toneMapping = TONE_MAPPINGS[this.options.toneMapping] ?? TONE_MAPPINGS.aces;
        this.renderer.toneMapping =
            (three as unknown as Record<string, THREE.ToneMapping>)[toneMapping];
        this.renderer.toneMappingExposure = this.options.exposure;

        this.scene = new three.Scene();
        if (this.options.background) {
            this.scene.background = new three.Color(this.options.background);
        }

        this.camera = new three.PerspectiveCamera(this.options.fov, 1, 0.01, 1000);
        this.timer = new three.Timer();

        const { OrbitControls: Orbit } = await importAddon<{
            OrbitControls: typeof OrbitControls;
        }>('controls/OrbitControls.js');
        this.orbit = new Orbit(this.camera, this.canvas);
        this.orbit.enableDamping = true;
        this.orbit.dampingFactor = 0.08;
        this.orbit.autoRotate = this.options.autorotate;
        this.orbit.autoRotateSpeed = 1.5;

        await this.setUpLighting();
        this.resize();
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(this.container);

        await this.loadModelEntry(this.resolveModelIndex(), true);
    }

    private async setUpLighting(): Promise<void> {
        const three = this.three;
        const hemisphere = new three.HemisphereLight(0xffffff, 0x444455, 1.2);
        this.scene.add(hemisphere);
        const key = new three.DirectionalLight(0xffffff, 1.8);
        key.position.set(1, 2, 2);
        this.scene.add(key);

        // Without one, glTF metallic surfaces have nothing to reflect and render
        // black however many lights are in the scene.
        if (this.options.environment !== 'none') {
            const { RoomEnvironment: Room } = await importAddon<{
                RoomEnvironment: typeof RoomEnvironment;
            }>('environments/RoomEnvironment.js');
            const pmrem = new three.PMREMGenerator(this.renderer);
            this.scene.environment = pmrem.fromScene(new Room(), 0.04).texture;
            pmrem.dispose();
        }
    }

    /**
     * Replaces whatever model is in the scene. Called from `mount()`
     * (`initial: true`) and by the `model` widget on every switch.
     */
    async loadModelEntry(index: number, initial = false): Promise<void> {
        const entry = this.models[index];
        if (!entry) {
            return;
        }
        const token = ++this.modelToken;
        // Taken before anything is touched: the framing below needs to know where
        // the *previous* model's camera was.
        const wasPristine = this.cameraPristine();
        this.modelLoading = true;

        let loaded;
        try {
            loaded = await loadModel({
                src: entry.src,
                format: entry.format ?? undefined,
                mtl: entry.mtl ?? undefined,
                three: this.three,
                renderer: this.renderer,
                onProgress: (fraction, bytes) => {
                    this.status(fraction === null
                        ? `Loading model… ${Math.round(bytes / 1024)} KB`
                        : `Loading model… ${Math.round(fraction * 100)}%`);
                    this.onProgress?.(fraction);
                },
            });
        } catch (error) {
            // A switch that lost the race to a newer one is discarded, not reported.
            if (token === this.modelToken) {
                this.modelLoading = false;
                this.status(`Could not load the model: ${(error as Error).message}`, 'error');
            }
            throw error;
        }
        if (token !== this.modelToken) {
            return;
        }
        this.modelLoading = false;

        this.unloadModel();
        this.currentModelIndex = index;

        this.root = loaded.root;
        this.scene.add(this.root);
        this.applyShading(this.options.shading);

        this.outline = new OutlineLayer(this.three);
        if (this.options.outline.enabled || this.wantsOutline) {
            this.outline.build(this.root);
            this.outline.apply(this.options.outline);
        }

        const anims = loaded.clips.map(embeddedEntry)
            .concat(this.externalAnims(), entry.anims);
        this.animation = new AnimationController(
            this.three, this.root, anims, (animEntry) => this.fetchAnim(animEntry));
        this.animation.speed = this.options.speed;
        this.animation.loop = this.options.loop;

        this.parts = new PartLayer(
            this.root,
            this.hidden.concat(
                anims.flatMap((anim) => anim.show || []),
                anims.flatMap((anim) => anim.hide || [])),
            this.hidden);
        // Before `measure()`: a hidden part should not widen the bounds.
        this.parts.apply();

        // The old bounds describe a model that is gone, so they always go; the
        // camera follows only on a first load, or if the user had not moved it.
        this.measure();
        this.buildGrid();
        if (initial) {
            this.frame(false);
        } else if (wasPristine) {
            this.frame(true);
        }

        if (this.options.autoplay && this.animation.available) {
            // Not awaited: an external clip is a second round trip. `play` records
            // its index before it yields, so the widgets `onModelChange` builds
            // open on the right clip. A new model re-resolves `data-anim-default`.
            void this.playAnim(this.resolveAnimIndex());
        }

        this.status('', 'none');
        this.onModelChange?.(index);
        if (initial) {
            this.onReady?.();
            this.start();
        }
    }

    /**
     * Frees the current model so a new one can take its place with the render
     * loop still running. Unlike `dispose()` this runs mid-session, so the root
     * and grid come out of the scene too.
     */
    private unloadModel(): void {
        this.animation?.dispose();
        this.animation = null;
        this.parts = null;
        this.outline?.dispose();
        this.outline = null;
        for (const { original, unlit } of this.unlitCache.values()) {
            for (const material of ([] as THREE.Material[]).concat(original, unlit)) {
                material.dispose();
            }
        }
        this.unlitCache.clear();
        if (this.root) {
            this.root.traverse((object) => {
                const mesh = object as THREE.Mesh;
                if (!mesh.isMesh) {
                    return;
                }
                mesh.geometry.dispose();
                for (const material of ([] as THREE.Material[]).concat(mesh.material)) {
                    material.dispose();
                }
            });
            this.scene.remove(this.root);
            this.root = null;
        }
        if (this.grid) {
            this.scene.remove(this.grid);
            this.grid.geometry.dispose();
            (this.grid.material as THREE.Material).dispose();
            this.grid = null;
        }
    }

    private externalAnims(): AnimEntry[] {
        return this.globalAnims;
    }

    /** Only the clip travels; the file holding it has no meshes of its own. */
    private async fetchAnim(entry: AnimEntry): Promise<THREE.AnimationClip | null> {
        const { clips } = await loadModel({
            src: entry.src!,
            three: this.three,
            renderer: this.renderer,
        });
        return clips[0] ?? null;
    }

    /**
     * Asynchronous once clips live in files of their own, so the widgets have
     * to be told when the switch has happened.
     */
    async playAnim(index: number): Promise<void> {
        if (!this.animation) {
            return;
        }
        await this.animation.play(index);
        // Out of range is the bind pose: undefined means no clip asks for anything.
        this.parts?.apply(this.animation.entries[index]);
        // A clip moves the model out of the pose the framing was computed for.
        this.reframe();
        this.onFrame?.();
        this.onAnimChange?.(index);
    }

    /**
     * A widget can ask for outlines the wikitext left off; the toggle has to
     * have something to toggle.
     */
    private wantsOutline = false;

    requestOutlineSupport(): void {
        this.wantsOutline = true;
        if (this.root && this.outline && !this.outline.available) {
            this.outline.build(this.root);
            this.outline.apply(this.options.outline);
        }
    }

    private resolveAnimIndex(): number {
        const entries = this.animation?.entries ?? [];
        const wanted = this.options.animDefault;
        if (!wanted) {
            return 0;
        }
        const byName = entries.findIndex((entry) => entry.name === wanted);
        if (byName >= 0) {
            return byName;
        }
        const asIndex = Number(wanted);
        return Number.isInteger(asIndex) && entries[asIndex] ? asIndex : 0;
    }

    /**
     * Box3.setFromObject caches a SkinnedMesh's box, measured at load in the bind
     * pose, which for a rigged model can sit far from where a clip puts it.
     */
    private measure(): void {
        if (!this.root) {
            return;
        }
        const three = this.three;
        const box = new three.Box3();
        const meshBox = new three.Box3();
        this.root.updateMatrixWorld(true);
        this.root.traverse((object) => {
            const mesh = object as THREE.SkinnedMesh;
            if (!mesh.isMesh || mesh.userData.isOutline || !mesh.visible) {
                return;
            }
            if (mesh.isSkinnedMesh) {
                mesh.computeBoundingBox();
                meshBox.copy(mesh.boundingBox!);
            } else {
                if (!mesh.geometry.boundingBox) {
                    mesh.geometry.computeBoundingBox();
                }
                meshBox.copy(mesh.geometry.boundingBox!);
            }
            box.union(meshBox.applyMatrix4(mesh.matrixWorld));
        });
        if (box.isEmpty()) {
            return;
        }
        this.bounds = {
            center: box.getCenter(new three.Vector3()),
            size: box.getSize(new three.Vector3()),
        };
        if (this.grid) {
            this.grid.position.y = box.min.y;
        }
    }

    private buildGrid(): void {
        if (!this.options.grid || this.grid || !this.bounds) {
            return;
        }
        const extent = Math.max(this.bounds.size.x, this.bounds.size.z, 0.001) * 2;
        this.grid = new this.three.GridHelper(extent, 16, 0x888888, 0x666666);
        const material = this.grid.material as THREE.Material;
        material.transparent = true;
        material.opacity = 0.4;
        this.grid.position.y = this.bounds.center.y - this.bounds.size.y / 2;
        this.scene.add(this.grid);
    }

    setGrid(visible: boolean): void {
        this.options.grid = visible;
        if (visible && !this.grid) {
            this.buildGrid();
        }
        if (this.grid) {
            this.grid.visible = visible;
        }
    }

    /** Whether the view is still ours, so a re-fit never overrides the user's own. */
    private cameraPristine(): boolean {
        if (!this.fitDistance || !this.bounds) {
            return false;
        }
        const tolerance = this.fitDistance * 0.02;
        return Math.abs(this.camera.position.distanceTo(this.orbit.target)
            - this.fitDistance) < tolerance
            && this.bounds.center.distanceTo(this.orbit.target) < tolerance;
    }

    private reframe(): void {
        if (!this.cameraPristine()) {
            return;
        }
        this.measure();
        this.frame(true);
    }

    private frame(keepOrientation: boolean): void {
        if (!this.bounds) {
            return;
        }
        const three = this.three;
        const { center, size } = this.bounds;
        const width = Math.max(this.canvas.clientWidth, 1);
        const height = Math.max(this.canvas.clientHeight, 1);
        const fov = three.MathUtils.degToRad(this.camera.fov);
        const fit = Math.max(size.y / height, size.x / width);
        let distance = fit * height / (2 * Math.tan(fov / 2)) * 1.08 + size.z * 0.6;

        let direction: THREE.Vector3;
        if (keepOrientation) {
            direction = this.camera.position.clone().sub(this.orbit.target).normalize();
        } else if (this.options.camera) {
            const [azimuth, elevation, zoom] = this.options.camera;
            const a = three.MathUtils.degToRad(azimuth);
            const e = three.MathUtils.degToRad(elevation);
            direction = new three.Vector3(
                Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a),
            ).normalize();
            distance *= zoom || 1;
        } else {
            direction = new three.Vector3(0, 0.04, 1).normalize();
        }

        this.orbit.target.copy(center);
        this.camera.position.copy(center).addScaledVector(direction, distance);
        this.camera.near = distance / 200;
        this.camera.far = distance * 20;
        this.fitDistance = distance;
        this.camera.updateProjectionMatrix();
        this.orbit.update();
    }

    resetCamera(): void {
        this.measure();
        this.frame(false);
    }

    setAutoRotate(on: boolean): void {
        this.options.autorotate = on;
        this.orbit.autoRotate = on;
    }

    /**
     * Written back into `options`, so a switch that rebuilds the controller
     * keeps the user's choice instead of the wikitext default.
     */
    setSpeed(speed: number): void {
        this.options.speed = speed;
        if (this.animation) {
            this.animation.speed = speed;
        }
    }

    setLoop(loop: boolean): void {
        this.options.loop = loop;
        this.animation?.setLoop(loop);
    }

    /**
     * `shaded` is the model's own materials, `unlit` a flat twin, `wireframe` the
     * shaded materials drawn as edges. Both are set on every call, since a fresh
     * unlit twin does not carry over the wireframe flag.
     */
    applyShading(mode: ShadingMode): void {
        this.options.shading = mode;
        this.setUnlitMaterial(mode === 'unlit');
        this.setWireframeFlag(mode === 'wireframe');
    }

    private setWireframeFlag(on: boolean): void {
        this.root?.traverse((object) => {
            const mesh = object as THREE.Mesh;
            if (!mesh.isMesh || mesh.userData.isOutline) {
                return;
            }
            for (const material of ([] as THREE.Material[]).concat(mesh.material)) {
                if ('wireframe' in material) {
                    (material as THREE.MeshStandardMaterial).wireframe = on;
                }
            }
        });
    }

    /**
     * Standard and Phong materials have no "ignore lighting" flag, so unlit means
     * a `MeshBasicMaterial` twin, cached per mesh so a toggle only swaps
     * `mesh.material`.
     */
    private setUnlitMaterial(on: boolean): void {
        this.root?.traverse((object) => {
            const mesh = object as THREE.Mesh;
            if (!mesh.isMesh || mesh.userData.isOutline) {
                return;
            }
            let entry = this.unlitCache.get(mesh);
            if (!entry) {
                const original = mesh.material;
                const unlit = Array.isArray(original)
                    ? original.map((material) => this.buildUnlitMaterial(material))
                    : this.buildUnlitMaterial(original);
                entry = { original, unlit };
                this.unlitCache.set(mesh, entry);
            }
            mesh.material = on ? entry.unlit : entry.original;
        });
    }

    /**
     * A flat base colour should show undistorted, but the scene keeps ACES for
     * everything else, so the unlit twin opts out on its own via `toneMapped`.
     *
     * Vertex colors are not copied: some exporters (Stella Sora's) bake
     * per-vertex data into COLOR_0 as a mask, not a tint, and three.js's
     * `vertexColors` multiplies it into the base colour, corrupting regions
     * like eyes where the mask is far from white.
     */
    private buildUnlitMaterial(source: THREE.Material): THREE.Material {
        const three = this.three;
        const colored = source as Partial<THREE.MeshStandardMaterial>;
        const unlit = new three.MeshBasicMaterial({
            map: 'map' in source ? colored.map ?? null : null,
            color: 'color' in source && colored.color
                ? colored.color.clone() : new three.Color(0xffffff),
            transparent: source.transparent,
            opacity: source.opacity,
            side: source.side,
            alphaTest: source.alphaTest,
        });
        unlit.toneMapped = false;
        unlit.name = source.name;
        return unlit;
    }

    applyOutline(settings: Partial<OutlineSettings>): void {
        Object.assign(this.options.outline, settings);
        if (this.options.outline.enabled) {
            this.requestOutlineSupport();
        }
        this.outline?.apply(this.options.outline);
    }

    get outlineSettings(): OutlineSettings {
        return this.options.outline;
    }

    /** What the wikitext asked for, so a toggle can open in the right position. */
    get settings(): Readonly<ViewerOptions> {
        return this.options;
    }

    private resize(): void {
        if (!this.renderer) {
            return;
        }
        const width = Math.max(this.canvas.clientWidth, 1);
        const height = Math.max(this.canvas.clientHeight, 1);
        this.renderer.setSize(width, height, false);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        // A narrower box crops a fit computed at the old aspect. A resize cannot
        // move the model, so this refits from the cached bounds, and only while
        // the camera is untouched, leaving a reader's own orbit alone.
        if (this.canvas.clientWidth && this.canvas.clientHeight && this.cameraPristine()) {
            this.frame(true);
        }
    }

    start(): void {
        if (this.running || !this.renderer) {
            return;
        }
        this.running = true;
        this.timer.reset(); // discard the gap since the loop was last stopped
        this.renderer.setAnimationLoop((timestamp) => this.tick(timestamp));
    }

    stop(): void {
        if (!this.running) {
            return;
        }
        this.running = false;
        this.renderer.setAnimationLoop(null);
    }

    private tick(timestamp: number): void {
        this.timer.update(timestamp);
        const delta = Math.min(this.timer.getDelta(), MAX_DELTA);
        this.animation?.update(delta);
        this.orbit.update();
        this.renderer.render(this.scene, this.camera);
        // Every frame, not only while playing: a pause can come from scrubbing or
        // a clip clamping at its end, and the transport still needs repainting.
        this.onFrame?.();
    }

    dispose(): void {
        this.stop();
        this.resizeObserver?.disconnect();
        this.unloadModel();
        this.renderer?.dispose();
    }
}
