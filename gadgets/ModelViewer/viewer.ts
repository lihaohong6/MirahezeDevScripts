/**
 * The viewer itself: renderer, scene, camera, framing and the render loop.
 */

import type * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js';
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

export type ControlsMode = 'orbit' | 'trackball';

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
    /** `data-camera-control="trackball"`: turn past the poles; see `setUpControls()`. */
    cameraControl: ControlsMode;
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

/** TrackballControls' turn state, which it keeps to itself; see `Viewer.turn`. */
interface TurnFields {
    _moveCurr: THREE.Vector2;
    _movePrev: THREE.Vector2;
    _lastAngle: number;
}

/** Radians per second, matching OrbitControls' own `autoRotateSpeed = 1.5`. */
const AUTO_ROTATE_RATE = 2 * Math.PI / 60 * 1.5;

/**
 * Frustum culling tests a mesh against a bounding volume the geometry was
 * measured in, and a skeleton can put the vertices anywhere else: three.js
 * caches a SkinnedMesh's bounding sphere the first time it is tested, in
 * whatever pose that frame held, and never measures it again. A clip that
 * carries a prop away from the bind pose then has it culled while it is in
 * plain sight.
 *
 * Measuring the sphere per frame costs a pass over every vertex, so skinned
 * meshes are simply always drawn; there are a handful per model, and the
 * static meshes that make up an arbitrary upload still cull normally.
 */
function keepSkinnedMeshesDrawn(root: THREE.Object3D): void {
    root.traverse((object) => {
        if ((object as THREE.SkinnedMesh).isSkinnedMesh) {
            object.frustumCulled = false;
        }
    });
}

export class Viewer {
    private three!: typeof THREE;
    private renderer!: THREE.WebGLRenderer;
    private scene!: THREE.Scene;
    private camera!: THREE.PerspectiveCamera;
    /** Whichever kind `setUpControls()` built; exactly one of the two is set. */
    private controls!: OrbitControls | TrackballControls;
    private orbit: OrbitControls | null = null;
    private trackball: TrackballControls | null = null;
    /** So `spin()` does not fight the pointer. */
    private dragging = false;
    /**
     * The trackball's own turn state, and where the last `update()` turned
     * from. It reads a drag as the gap between the last two pointer events, so
     * a mouse reporting more than once a frame has all but its last report
     * thrown away, and it carries the last gap on after the pointer stops.
     * Re-anchoring each frame counts every report, once; see `tick()`.
     */
    private turn: { fields: TurnFields; anchor: THREE.Vector2 } | null = null;
    private timer!: THREE.Timer;
    private grid: THREE.GridHelper | null = null;
    private root: THREE.Object3D | null = null;
    private bounds: { center: THREE.Vector3; size: THREE.Vector3 } | null = null;
    private fitDistance = 0;
    /** `data-camera`'s zoom, so a re-fit keeps the page's framing. */
    private zoom = 1;
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

        await this.setUpControls();

        await this.setUpLighting();
        this.resize();
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(this.container);

        await this.loadModelEntry(this.resolveModelIndex(), true);
    }

    /**
     * OrbitControls holds the up axis fixed, so the camera can never be carried
     * over a pole. `data-camera-control="trackball"` turns up along with the
     * camera instead: no limit, but no horizon and no autorotate of its own
     * (see `spin()`), which is why it is not the default.
     */
    private async setUpControls(): Promise<void> {
        if (this.options.cameraControl === 'trackball') {
            const { TrackballControls: Trackball } = await importAddon<{
                TrackballControls: typeof TrackballControls;
            }>('controls/TrackballControls.js');
            const trackball = new Trackball(this.camera, this.canvas);
            // Smooths the pan and the zoom only: `tick()` takes the turn's own
            // damping away, and `tuneControls()` divides this back out of the
            // pan speed.
            trackball.dynamicDampingFactor = 0.3;
            // Its modifier keys are listened for on `window`, so at their
            // defaults an A, S or D typed anywhere on the page — a search box,
            // an edit form — would change what dragging the viewer does.
            trackball.keys = ['', '', ''];
            const fields = trackball as unknown as Partial<TurnFields>;
            if (fields._moveCurr && fields._movePrev
                && typeof fields._lastAngle === 'number') {
                this.turn = {
                    fields: fields as TurnFields,
                    anchor: fields._moveCurr.clone(),
                };
            }
            trackball.addEventListener('start', () => {
                this.dragging = true;
                // A press seeds both vectors with itself; older ones belong to
                // a drag that is over.
                this.turn?.anchor.copy(this.turn.fields._moveCurr);
            });
            trackball.addEventListener('end', () => {
                this.dragging = false;
            });
            this.trackball = trackball;
            this.controls = trackball;
            return;
        }

        const { OrbitControls: Orbit } = await importAddon<{
            OrbitControls: typeof OrbitControls;
        }>('controls/OrbitControls.js');
        const orbit = new Orbit(this.camera, this.canvas);
        orbit.enableDamping = true;
        orbit.dampingFactor = 0.08;
        orbit.autoRotate = this.options.autorotate;
        orbit.autoRotateSpeed = 1.5;
        this.orbit = orbit;
        this.controls = orbit;
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
        keepSkinnedMeshesDrawn(this.root);
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

        // The old bounds, target and distance describe a model that is gone; a
        // switch keeps only the direction the reader looks from.
        this.measure();
        this.buildGrid();
        this.frame(!initial);

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
     * What the camera should fit in the pose the model is holding now: the
     * character, and whatever is keeping her company.
     *
     * A prop can be on screen and still not be worth framing — Minova walks
     * with a weapon that swings five metres over her head — so a mesh counts
     * only while it stays within a body height of the body, which is the mesh
     * with the most vertices in every model here. Hidden parts and the outline
     * hulls never count.
     *
     * Box3.setFromObject caches a SkinnedMesh's box, measured at load in the bind
     * pose, which for a rigged model can sit far from where a clip puts it.
     */
    private modelBox(): THREE.Box3 | null {
        if (!this.root) {
            return null;
        }
        const three = this.three;
        const boxes: THREE.Box3[] = [];
        let body = -1;
        let densest = -1;
        this.root.updateMatrixWorld(true);
        this.root.traverse((object) => {
            const mesh = object as THREE.SkinnedMesh;
            if (!mesh.isMesh || mesh.userData.isOutline || !mesh.visible) {
                return;
            }
            const meshBox = new three.Box3();
            if (mesh.isSkinnedMesh) {
                mesh.computeBoundingBox();
                meshBox.copy(mesh.boundingBox!);
            } else {
                if (!mesh.geometry.boundingBox) {
                    mesh.geometry.computeBoundingBox();
                }
                meshBox.copy(mesh.geometry.boundingBox!);
            }
            meshBox.applyMatrix4(mesh.matrixWorld);
            const vertices = mesh.geometry.getAttribute('position')?.count ?? 0;
            if (vertices > densest) {
                densest = vertices;
                body = boxes.length;
            }
            boxes.push(meshBox);
        });
        if (body < 0) {
            return null;
        }
        const reach = boxes[body].getSize(new three.Vector3()).y;
        const near = boxes[body].clone().expandByScalar(reach);
        const box = boxes[body].clone();
        for (const other of boxes) {
            if (near.intersectsBox(other)) {
                box.union(other);
            }
        }
        return box;
    }

    /** What the camera is fitted to, and what the grid sits under. */
    private setBounds(box: THREE.Box3 | null): void {
        if (!box) {
            return;
        }
        this.bounds = {
            center: box.getCenter(new this.three.Vector3()),
            size: box.getSize(new this.three.Vector3()),
        };
        if (this.grid) {
            this.grid.position.y = box.min.y;
        }
    }

    private measure(): void {
        this.setBounds(this.modelBox());
    }

    /**
     * The room a clip needs, rather than the pose it opens on: Amber's
     * `Victory` starts in a crouch and finishes standing, and a camera fitted
     * to the crouch cuts her off at the waist for the rest of it. Nearly a
     * fifth of the featured clips open at least 15% smaller than they end up.
     *
     * The anchor is the middle of the clip and a pose counts only while it
     * still overlaps the anchor, so the frame goes where the clip spends its
     * time. A clip that travels cannot be held in a fixed frame at all —
     * Tilia's `Ultra_TL` drops in from four metres up — and framing the
     * middle at least keeps the character in shot for most of one.
     */
    private measureClip(): void {
        const anim = this.animation;
        if (!anim?.available || !anim.duration) {
            this.measure();
            return;
        }
        const was = anim.time / anim.duration;
        anim.seek(0.5);
        const anchor = this.modelBox();
        const box = anchor?.clone();
        if (box) {
            for (const sample of [0, 0.25, 0.75, 1]) {
                anim.seek(sample);
                const posed = this.modelBox();
                if (posed && posed.intersectsBox(anchor!)) {
                    box.union(posed);
                }
            }
        }
        anim.seek(was);
        this.setBounds(box || null);
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
        return Math.abs(this.camera.position.distanceTo(this.controls.target)
            - this.fitDistance) < tolerance
            && this.bounds.center.distanceTo(this.controls.target) < tolerance;
    }

    private reframe(): void {
        if (!this.cameraPristine()) {
            return;
        }
        this.measureClip();
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

        // Our own direction needs our own up, or a rolled trackball view would
        // be re-fitted still upside down.
        if (!keepOrientation) {
            this.camera.up.set(0, 1, 0);
        }

        let direction: THREE.Vector3;
        if (keepOrientation) {
            direction = this.camera.position.clone().sub(this.controls.target).normalize();
        } else if (this.options.camera) {
            const [azimuth, elevation, zoom] = this.options.camera;
            const a = three.MathUtils.degToRad(azimuth);
            const e = three.MathUtils.degToRad(elevation);
            direction = new three.Vector3(
                Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a),
            ).normalize();
            this.zoom = zoom || 1;
        } else {
            direction = new three.Vector3(0, 0.04, 1).normalize();
            this.zoom = 1;
        }
        distance *= this.zoom;

        this.controls.target.copy(center);
        this.camera.position.copy(center).addScaledVector(direction, distance);
        this.camera.near = distance / 200;
        this.camera.far = distance * 20;
        this.fitDistance = distance;
        this.camera.updateProjectionMatrix();
        this.controls.update();
    }

    resetCamera(): void {
        this.measureClip();
        this.frame(false);
    }

    setAutoRotate(on: boolean): void {
        this.options.autorotate = on;
        if (this.orbit) {
            this.orbit.autoRotate = on;
        }
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
        // The trackball caches the rect it maps pointer movement into.
        this.trackball?.handleResize();
        this.tuneControls(width / height);
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
        if (this.trackball && this.options.autorotate && !this.dragging) {
            this.spin(delta);
        }
        if (this.turn) {
            this.turn.fields._movePrev.copy(this.turn.anchor);
        }
        this.controls.update();
        if (this.turn) {
            this.turn.anchor.copy(this.turn.fields._moveCurr);
            // Damping is left to smooth the pan and the zoom; a turn that ran on
            // after the pointer would only drift the model while it is held still.
            this.turn.fields._lastAngle = 0;
        }
        this.renderer.render(this.scene, this.camera);
        // Every frame, not only while playing: a pause can come from scrubbing or
        // a clip clamping at its end, and the transport still needs repainting.
        this.onFrame?.();
    }

    /**
     * Both speeds are per box rather than per pixel, so they follow the stage.
     * The trackball measures a drag against the box's width across but its
     * height down, so the box is squared up first, leaving a diagonal drag
     * true to the pointer and only a middle-button zoom reading gentler on a
     * wide stage.
     */
    private tuneControls(aspect: number): void {
        if (!this.trackball) {
            return;
        }
        this.trackball.screen.height = this.trackball.screen.width;
        // A drag of the stage's height turns right round, as OrbitControls does.
        this.trackball.rotateSpeed = Math.PI * aspect;
        // And a drag holds the model under the pointer.
        this.trackball.panSpeed = 2 * Math.tan(this.camera.fov * Math.PI / 360)
            * aspect * this.trackball.dynamicDampingFactor;
    }

    /** Autorotation for the trackball, which has none of its own. */
    private spin(delta: number): void {
        const { target } = this.controls;
        this.camera.position.sub(target)
            .applyAxisAngle(this.camera.up.normalize(), -AUTO_ROTATE_RATE * delta)
            .add(target);
    }

    dispose(): void {
        this.stop();
        this.resizeObserver?.disconnect();
        this.unloadModel();
        // The trackball's key listeners are on `window`, outliving the canvas.
        this.controls?.dispose();
        this.renderer?.dispose();
    }
}
