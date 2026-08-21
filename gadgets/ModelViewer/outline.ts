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

void main() {
  vec3 objectNormal = smoothNormal;
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  vec3 transformed = position;
  #include <morphtarget_vertex>
  #include <skinning_vertex>

  vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
  vec3 viewNormal = normalize(normalMatrix * objectNormal);
  // Scaling by view depth holds the line at a near-constant width on screen, so
  // one setting suits a model authored in metres and one authored in units.
  mvPosition.xyz += viewNormal * outlineWidth * max(-mvPosition.z, 0.05);
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
 * A hard edge is two vertices in one place with different normals, and extruding
 * each along its own tears the hull open at every seam. The fix is a second,
 * always-smooth normal, which toon pipelines bake at export and an arbitrary
 * upload will not have.
 *
 * It is accumulated from the faces, not the geometry's own normals, because
 * plenty of files have none: three.js flat-shades those from derivatives, and
 * adding normals would smooth-shade the model itself. Face normals are left
 * unnormalised, so each counts in proportion to its area.
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
    const sums = new Map<string, [number, number, number]>();
    for (let i = 0; i < count; i++) {
        const key = `${Math.round(position.getX(i) * POSITION_QUANTISATION)},`
            + `${Math.round(position.getY(i) * POSITION_QUANTISATION)},`
            + `${Math.round(position.getZ(i) * POSITION_QUANTISATION)}`;
        keys[i] = key;
        if (!sums.has(key)) {
            sums.set(key, [0, 0, 0]);
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
        for (const vertex of [a, b, c]) {
            const sum = sums.get(keys[vertex]);
            if (sum) {
                sum[0] += nx;
                sum[1] += ny;
                sum[2] += nz;
            }
        }
    }

    const smooth = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        const [x, y, z] = sums.get(keys[i])!;
        const length = Math.hypot(x, y, z) || 1;
        smooth[i * 3] = x / length;
        smooth[i * 3 + 1] = y / length;
        smooth[i * 3 + 2] = z / length;
    }
    geometry.setAttribute('smoothNormal', new three.BufferAttribute(smooth, 3));
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

    constructor(private three: typeof THREE) {}

    /**
     * Builds a hull per mesh under `root`, parented to its source so it inherits
     * that transform and is removed with it. Call once per model.
     */
    build(root: THREE.Object3D): void {
        const three = this.three;
        const sources: THREE.Mesh[] = [];
        root.traverse((object) => {
            const mesh = object as THREE.Mesh;
            if (mesh.isMesh && !mesh.userData.isOutline) {
                sources.push(mesh);
            }
        });

        for (const mesh of sources) {
            ensureSmoothNormals(mesh.geometry, three);
            if (!mesh.geometry.getAttribute('smoothNormal')) {
                continue;
            }

            const material = new three.ShaderMaterial({
                uniforms: {
                    outlineColor: { value: new three.Color(0x000000) },
                    outlineWidth: { value: BASE_WIDTH },
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
