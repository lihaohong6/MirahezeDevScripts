/**
 * Format detection and per-format loading.
 *
 * The file is fetched here, not handed to a three.js loader as a URL: that buys
 * a real progress percentage, and a look at glTF's `extensionsUsed` before
 * deciding whether the Draco, KTX2 or meshopt decoders need fetching.
 */

import type * as THREE from 'three';
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import type { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import type { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import type { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import type { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';
import type { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import type { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';

import { importAddon, THREE_BASE } from './three-cdn';

export type Format = 'gltf' | 'fbx' | 'obj' | 'stl' | 'collada';

export interface LoadedModel {
    root: THREE.Object3D;
    clips: THREE.AnimationClip[];
}

export interface LoadRequest {
    src: string;
    format?: string;
    /** URL of a companion .mtl file, for OBJ only. */
    mtl?: string;
    three: typeof THREE;
    renderer: THREE.WebGLRenderer;
    /** `fraction` is null while the total size is unknown. */
    onProgress?: (fraction: number | null, loaded: number) => void;
}

const BY_EXTENSION: Record<string, Format> = {
    glb: 'gltf',
    gltf: 'gltf',
    fbx: 'fbx',
    obj: 'obj',
    stl: 'stl',
    dae: 'collada',
};

export const SUPPORTED_FORMATS = Object.keys(BY_EXTENSION).join(', ');

/**
 * `{{filepath:}}` yields a plain file URL, but one may carry a query string or
 * a fragment, and thumbnail URLs append their own path segments.
 */
export function detectFormat(src: string, override?: string): Format | null {
    if (override) {
        const named = override.toLowerCase().trim();
        return BY_EXTENSION[named] ?? (Object.values(BY_EXTENSION).includes(named as Format)
            ? named as Format
            : null);
    }
    const path = src.split(/[?#]/)[0];
    const extension = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
    return BY_EXTENSION[extension] ?? null;
}

/** Directory the file lives in, used to resolve textures and .bin buffers. */
function resourcePath(src: string): string {
    const path = src.split(/[?#]/)[0];
    return path.slice(0, path.lastIndexOf('/') + 1);
}

async function fetchBuffer(
    url: string,
    onProgress?: LoadRequest['onProgress'],
): Promise<ArrayBuffer> {
    const response = await fetch(url, { credentials: 'omit' });
    if (!response.ok) {
        // HTTP/2 responses carry no status text, so it is often empty.
        throw new Error(`HTTP ${response.status} ${response.statusText}`.trim());
    }
    const total = Number(response.headers.get('content-length')) || 0;
    if (!onProgress || !response.body) {
        return response.arrayBuffer();
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }
        chunks.push(value);
        loaded += value.byteLength;
        onProgress(total ? Math.min(loaded / total, 1) : null, loaded);
    }

    const merged = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return merged.buffer;
}

async function fetchText(url: string, onProgress?: LoadRequest['onProgress']): Promise<string> {
    return new TextDecoder().decode(await fetchBuffer(url, onProgress));
}

const GLB_MAGIC = 0x46546c67; // 'glTF', little-endian
const GLB_CHUNK_JSON = 0x4e4f534a; // 'JSON'

/** The extension list lives in the JSON chunk at the head of the container. */
function gltfExtensions(buffer: ArrayBuffer): string[] {
    const view = new DataView(buffer);
    let json: string;
    if (view.byteLength >= 20 && view.getUint32(0, true) === GLB_MAGIC) {
        const length = view.getUint32(12, true);
        if (view.getUint32(16, true) !== GLB_CHUNK_JSON) {
            return [];
        }
        json = new TextDecoder().decode(new Uint8Array(buffer, 20, length));
    } else {
        json = new TextDecoder().decode(buffer);
    }
    try {
        const parsed = JSON.parse(json);
        return ([] as string[])
            .concat(parsed.extensionsUsed || [], parsed.extensionsRequired || []);
    } catch {
        return [];
    }
}

async function loadGltf(request: LoadRequest, buffer: ArrayBuffer): Promise<LoadedModel> {
    const { GLTFLoader: Ctor } = await importAddon<{ GLTFLoader: typeof GLTFLoader }>(
        'loaders/GLTFLoader.js');
    const loader = new Ctor();
    const extensions = gltfExtensions(buffer);

    if (extensions.includes('KHR_draco_mesh_compression')) {
        const { DRACOLoader: Draco } = await importAddon<{ DRACOLoader: typeof DRACOLoader }>(
            'loaders/DRACOLoader.js');
        const draco = new Draco();
        draco.setDecoderPath(THREE_BASE + 'examples/jsm/libs/draco/gltf/');
        loader.setDRACOLoader(draco);
    }
    if (extensions.includes('KHR_texture_basisu')) {
        const { KTX2Loader: Ktx2 } = await importAddon<{ KTX2Loader: typeof KTX2Loader }>(
            'loaders/KTX2Loader.js');
        const ktx2 = new Ktx2();
        ktx2.setTranscoderPath(THREE_BASE + 'examples/jsm/libs/basis/');
        ktx2.detectSupport(request.renderer);
        loader.setKTX2Loader(ktx2);
    }
    if (extensions.includes('EXT_meshopt_compression')) {
        const { MeshoptDecoder } = await importAddon<{ MeshoptDecoder: unknown }>(
            'libs/meshopt_decoder.module.js');
        loader.setMeshoptDecoder(MeshoptDecoder as never);
    }

    // A .gltf file is JSON with side-car buffers; a .glb is the binary container.
    const isBinary = new DataView(buffer).byteLength >= 4
        && new DataView(buffer).getUint32(0, true) === GLB_MAGIC;
    const data: ArrayBuffer | string = isBinary
        ? buffer
        : new TextDecoder().decode(buffer);

    return new Promise((resolve, reject) => {
        loader.parse(data, resourcePath(request.src), (gltf) => {
            resolve({ root: gltf.scene, clips: gltf.animations || [] });
        }, reject);
    });
}

async function loadFbx(request: LoadRequest, buffer: ArrayBuffer): Promise<LoadedModel> {
    const { FBXLoader: Ctor } = await importAddon<{ FBXLoader: typeof FBXLoader }>(
        'loaders/FBXLoader.js');
    const group = new Ctor().parse(buffer, resourcePath(request.src));
    return { root: group, clips: group.animations || [] };
}

async function loadObj(request: LoadRequest, buffer: ArrayBuffer): Promise<LoadedModel> {
    const { OBJLoader: Ctor } = await importAddon<{ OBJLoader: typeof OBJLoader }>(
        'loaders/OBJLoader.js');
    const loader = new Ctor();

    // A second round trip, and most OBJ embeds are untextured, so it is only
    // pulled when the wikitext names a material library.
    if (request.mtl) {
        const { MTLLoader: Mtl } = await importAddon<{ MTLLoader: typeof MTLLoader }>(
            'loaders/MTLLoader.js');
        const base = resourcePath(request.mtl);
        const materials = new Mtl().setResourcePath(base).parse(
            await fetchText(request.mtl), base);
        materials.preload();
        loader.setMaterials(materials);
    }

    const root = loader.parse(new TextDecoder().decode(buffer));
    // The loader's default white MeshPhongMaterial reads flat under an IBL.
    if (!request.mtl) {
        const material = new request.three.MeshStandardMaterial({
            color: 0xcccccc, roughness: 0.7, metalness: 0.05,
        });
        root.traverse((object) => {
            const mesh = object as THREE.Mesh;
            if (mesh.isMesh) {
                mesh.material = material;
            }
        });
    }
    return { root, clips: [] };
}

async function loadStl(request: LoadRequest, buffer: ArrayBuffer): Promise<LoadedModel> {
    const { STLLoader: Ctor } = await importAddon<{ STLLoader: typeof STLLoader }>(
        'loaders/STLLoader.js');
    const geometry = new Ctor().parse(buffer);
    if (!geometry.getAttribute('normal')) {
        geometry.computeVertexNormals();
    }
    const mesh = new request.three.Mesh(geometry, new request.three.MeshStandardMaterial({
        color: 0xcccccc, roughness: 0.6, metalness: 0.05,
    }));
    return { root: mesh, clips: [] };
}

async function loadCollada(request: LoadRequest, buffer: ArrayBuffer): Promise<LoadedModel> {
    const { ColladaLoader: Ctor } = await importAddon<{ ColladaLoader: typeof ColladaLoader }>(
        'loaders/ColladaLoader.js');
    const collada = new Ctor().parse(
        new TextDecoder().decode(buffer), resourcePath(request.src));
    if (!collada) {
        throw new Error('The Collada file could not be parsed.');
    }
    return { root: collada.scene, clips: collada.scene.animations || [] };
}

const LOADERS: Record<Format, (r: LoadRequest, b: ArrayBuffer) => Promise<LoadedModel>> = {
    gltf: loadGltf,
    fbx: loadFbx,
    obj: loadObj,
    stl: loadStl,
    collada: loadCollada,
};

export async function loadModel(request: LoadRequest): Promise<LoadedModel> {
    const format = detectFormat(request.src, request.format);
    if (!format) {
        throw new Error(`Unrecognised model format (supported: ${SUPPORTED_FORMATS}).`);
    }
    const buffer = await fetchBuffer(request.src, request.onProgress);
    return LOADERS[format](request, buffer);
}
