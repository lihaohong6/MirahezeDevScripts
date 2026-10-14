/**
 * Inverted-hull outlines.
 *
 * Each mesh gets a sibling sharing its geometry that renders back faces only and
 * pushes each vertex out along its normal. What survives the depth test is the
 * rim, which reads as a line around the silhouette.
 */

import type * as THREE from 'three';

const OUTLINE_VERT = /* glsl */`
#include <common>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>

attribute vec3 smoothNormal;
uniform float outlineWidth;
uniform float restScale;

// Below this fraction of its loaded scale, a part's line fades out with it.
#define FADE_BELOW 0.1

// The middle of a matrix's three axis scales. Flattening one axis leaves a
// visible sheet, a closed eye; only flattening two or all three hides a part.
float axisScale(mat3 m) {
  float a = length(m[0]);
  float b = length(m[1]);
  return max(min(a, b), min(max(a, b), length(m[2])));
}

void main() {
  vec3 objectNormal = smoothNormal;
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  vec3 transformed = position;
  #include <morphtarget_vertex>
  #include <skinning_vertex>

  vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
  // A part hidden by scaling it to nothing would still be pushed out a full
  // line width and draw as a black speck, so below FADE_BELOW of its loaded
  // scale the line fades out with the part. Above that it keeps its width.
  // A skinned hull is bound in attached mode, where the bones alone place it,
  // so only their scale counts. Each is weighted separately: the blended skin
  // matrix also shrinks where bones bend apart, which would thin every joint.
  #ifdef USE_SKINNING
    float shrink = (skinWeight.x * axisScale(mat3(boneMatX))
      + skinWeight.y * axisScale(mat3(boneMatY))
      + skinWeight.z * axisScale(mat3(boneMatZ))
      + skinWeight.w * axisScale(mat3(boneMatW))) / restScale;
  #else
    float shrink = axisScale(mat3(modelMatrix)) / restScale;
  #endif
  shrink = min(shrink / FADE_BELOW, 1.0);
  vec3 viewNormal = shrink > 1e-6 && dot(objectNormal, objectNormal) > 0.0
    ? normalize(normalMatrix * objectNormal)
    : vec3(0.0);
  // Scaling by view depth holds the line at a near-constant width on screen, so
  // one setting suits a model authored in metres and one authored in units.
  mvPosition.xyz += viewNormal * outlineWidth * shrink * max(-mvPosition.z, 0.05);
  gl_Position = projectionMatrix * mvPosition;
}`;

const OUTLINE_FRAG = /* glsl */`
precision highp float;
uniform vec3 outlineColor;
void main() {
  gl_FragColor = vec4(outlineColor, 1.0);
  // A ShaderMaterial does not get the renderer's output conversion for free.
  #include <colorspace_fragment>
}`;

/** Width the slider's 100 % corresponds to, in view-space units per unit depth. */
const BASE_WIDTH = 0.002;

const POSITION_QUANTISATION = 1e4;

/**
 * Below this fraction of the face area they sum, a vertex's face normals have
 * cancelled. Ordinary vertices sit far above it, near one on smooth surfaces.
 */
const CANCELLED_NORMAL = 1e-3;

/**
 * A hard edge is two vertices in one place with different normals, and extruding
 * each along its own tears the hull open at every seam. The fix is a second,
 * always-smooth normal, which toon pipelines bake at export and an arbitrary
 * upload will not have.
 *
 * It is accumulated from the faces, not the geometry's own normals, because
 * plenty of files have none: three.js flat-shades those from derivatives, and
 * adding normals would smooth-shade the model itself. Face normals are left
 * unnormalised, so each counts in proportion to its area.
 *
 * A two-sided sheet is two copies of one surface facing opposite ways, and at
 * its vertices the faces cancel to rounding noise that normalises to a random
 * direction. Those vertices take their own normal instead: the file's, or
 * failing that, the sum of their own faces. A vertex both sides share has
 * neither, and is not pushed out at all.
 */
function ensureSmoothNormals(geometry: THREE.BufferGeometry, three: typeof THREE): void {
    if (geometry.getAttribute('smoothNormal')) {
        return;
    }
    const position = geometry.getAttribute('position');
    if (!position) {
        return;
    }

    const count = position.count;
    const keys: string[] = new Array(count);
    // Summed face normals, then the face area they came from.
    const sums = new Map<string, [number, number, number, number]>();
    const own = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
        const key = `${Math.round(position.getX(i) * POSITION_QUANTISATION)},`
            + `${Math.round(position.getY(i) * POSITION_QUANTISATION)},`
            + `${Math.round(position.getZ(i) * POSITION_QUANTISATION)}`;
        keys[i] = key;
        if (!sums.has(key)) {
            sums.set(key, [0, 0, 0, 0]);
        }
    }

    const index = geometry.getIndex();
    const triangles = Math.floor((index ? index.count : count) / 3);
    for (let t = 0; t < triangles; t++) {
        const a = index ? index.getX(t * 3) : t * 3;
        const b = index ? index.getX(t * 3 + 1) : t * 3 + 1;
        const c = index ? index.getX(t * 3 + 2) : t * 3 + 2;
        const abx = position.getX(b) - position.getX(a);
        const aby = position.getY(b) - position.getY(a);
        const abz = position.getZ(b) - position.getZ(a);
        const acx = position.getX(c) - position.getX(a);
        const acy = position.getY(c) - position.getY(a);
        const acz = position.getZ(c) - position.getZ(a);
        const nx = aby * acz - abz * acy;
        const ny = abz * acx - abx * acz;
        const nz = abx * acy - aby * acx;
        const area = Math.hypot(nx, ny, nz);
        for (const vertex of [a, b, c]) {
            const sum = sums.get(keys[vertex]);
            if (sum) {
                sum[0] += nx;
                sum[1] += ny;
                sum[2] += nz;
                sum[3] += area;
                own[vertex * 4] += nx;
                own[vertex * 4 + 1] += ny;
                own[vertex * 4 + 2] += nz;
                own[vertex * 4 + 3] += area;
            }
        }
    }

    const normal = geometry.getAttribute('normal');
    const smooth = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        let [x, y, z, area] = sums.get(keys[i])!;
        if (Math.hypot(x, y, z) < area * CANCELLED_NORMAL) {
            if (normal) {
                [x, y, z] = [normal.getX(i), normal.getY(i), normal.getZ(i)];
            } else {
                [x, y, z, area] = own.subarray(i * 4, i * 4 + 4);
                if (Math.hypot(x, y, z) < area * CANCELLED_NORMAL) {
                    x = y = z = 0;
                }
            }
        }
        const length = Math.hypot(x, y, z) || 1;
        smooth[i * 3] = x / length;
        smooth[i * 3 + 1] = y / length;
        smooth[i * 3 + 2] = z / length;
    }
    geometry.setAttribute('smoothNormal', new three.BufferAttribute(smooth, 3));
}

/** The middle of a matrix's three axis scales, as the shader's `axisScale`. */
function axisScale(matrix: THREE.Matrix4): number {
    const e = matrix.elements;
    const [a, b, c] = [0, 4, 8].map((i) => Math.hypot(e[i], e[i + 1], e[i + 2]));
    return Math.max(Math.min(a, b), Math.min(Math.max(a, b), c));
}

/**
 * The scale most of a skeleton's bone matrices carry, the median ignoring bones
 * scaled to nothing. Zero when every bone is.
 */
function boneScale(skeleton: THREE.Skeleton, three: typeof THREE): number {
    const matrix = new three.Matrix4();
    const scales = skeleton.bones
        .map((bone, i) => axisScale(matrix.multiplyMatrices(bone.matrixWorld, skeleton.boneInverses[i])))
        .filter((scale) => scale > 1e-8)
        .sort((a, b) => a - b);
    return scales.length ? scales[scales.length >> 1] : 0;
}

export interface OutlineSettings {
    enabled: boolean;
    /** Percent; 100 is the reference width. */
    width: number;
    color: string;
}

export class OutlineLayer {
    private meshes: THREE.Mesh[] = [];
    private materials: THREE.ShaderMaterial[] = [];

    /** Each mesh's world scale in the pose `root` loaded in. */
    private restScales = new Map<THREE.Object3D, number>();

    /**
     * Construct before anything animates `root`: the hulls may be built later,
     * mid-clip, but measure a part's scale against the pose it loaded in.
     */
    constructor(private three: typeof THREE, private root: THREE.Object3D) {
        root.updateMatrixWorld(true);
        const fallback = axisScale(root.matrixWorld) || 1;
        root.traverse((object) => {
            const skinned = object as THREE.SkinnedMesh;
            if (skinned.isMesh) {
                const scale = skinned.isSkinnedMesh
                    ? boneScale(skinned.skeleton, three)
                    : axisScale(skinned.matrixWorld);
                // A part loaded already hidden has no scale to compare against.
                this.restScales.set(object, scale > 1e-8 ? scale : (skinned.isSkinnedMesh ? 1 : fallback));
            }
        });
    }

    /**
     * Builds a hull per mesh under the root, parented to its source so it
     * inherits that transform and is removed with it. Call once per model.
     */
    build(): void {
        const three = this.three;
        const sources: THREE.Mesh[] = [];
        this.root.traverse((object) => {
            const mesh = object as THREE.Mesh;
            if (mesh.isMesh && !mesh.userData.isOutline) {
                sources.push(mesh);
            }
        });

        for (const mesh of sources) {
            // A hull only reads as a rim on closed geometry, where its back faces
            // stay behind the front ones. An open sheet — a veil, a lens, a cape —
            // has no front faces to hide behind, so the hull fills its whole
            // silhouette instead of outlining it. See-through materials are where
            // that shows, nothing opaque being drawn over the fill.
            if (([] as THREE.Material[]).concat(mesh.material).some((m) => m.transparent)) {
                continue;
            }
            ensureSmoothNormals(mesh.geometry, three);
            if (!mesh.geometry.getAttribute('smoothNormal')) {
                continue;
            }

            const material = new three.ShaderMaterial({
                uniforms: {
                    outlineColor: { value: new three.Color(0x000000) },
                    outlineWidth: { value: BASE_WIDTH },
                    restScale: { value: this.restScales.get(mesh)! },
                },
                vertexShader: OUTLINE_VERT,
                fragmentShader: OUTLINE_FRAG,
                side: three.BackSide,
            });

            const skinned = mesh as THREE.SkinnedMesh;
            let hull: THREE.Mesh;
            if (skinned.isSkinnedMesh) {
                const clone = new three.SkinnedMesh(mesh.geometry, material);
                clone.bind(skinned.skeleton, skinned.bindMatrix);
                hull = clone;
            } else {
                hull = new three.Mesh(mesh.geometry, material);
            }
            hull.name = `${mesh.name || 'mesh'}__outline`;
            hull.userData.isOutline = true;
            // The hull is larger than the mesh, so culling it by the source bounds
            // pops it off at the edge of the view.
            hull.frustumCulled = false;
            hull.renderOrder = -1;
            hull.morphTargetInfluences = mesh.morphTargetInfluences;
            hull.morphTargetDictionary = mesh.morphTargetDictionary;
            hull.visible = false;

            mesh.add(hull);
            this.meshes.push(hull);
            this.materials.push(material);
        }
    }

    get available(): boolean {
        return this.meshes.length > 0;
    }

    apply(settings: OutlineSettings): void {
        for (const mesh of this.meshes) {
            mesh.visible = settings.enabled;
        }
        for (const material of this.materials) {
            material.uniforms.outlineWidth.value = BASE_WIDTH * settings.width / 100;
            (material.uniforms.outlineColor.value as THREE.Color).set(settings.color);
        }
    }

    dispose(): void {
        for (const mesh of this.meshes) {
            mesh.removeFromParent();
        }
        for (const material of this.materials) {
            material.dispose();
        }
        this.meshes = [];
        this.materials = [];
    }
}
