import * as THREE from 'three';

export type EinsteinMode = 'idle' | 'guide' | 'wave';
export type EinsteinDirection = 'left' | 'right';
type EyeRig = { gaze: THREE.Object3D; upper: THREE.Object3D; lower: THREE.Object3D; crease: THREE.Mesh };
type Rig = { head: THREE.Bone; eyes: EyeRig[]; guide: number; look: number; greet: number; lastTime: number | null };
const rigs = new WeakMap<THREE.Group, Rig>();

/** Bind the user's sculpt and its added head / eyelid rig after loading the GLB. */
export function bindEinsteinModel(model: THREE.Group): THREE.Group {
  let source: THREE.Object3D | undefined;
  model.traverse(object => { if (object.userData.rig === 'terenphys-user-einstein-v1') source = object; });
  if (!source) throw new Error('Unexpected Einstein model');
  const node = <T extends THREE.Object3D>(name: string) => {
    let found = model.getObjectByName(name);
    if (!found) model.traverse(object => { if (object.userData.name === name) found = object; });
    if (!found) throw new Error(`Einstein model is missing ${name}`);
    found.name = name; return found as T;
  };
  rigs.set(model, { head: node<THREE.Bone>('Head'), eyes: ['Right', 'Left'].map(side => ({
    gaze: node<THREE.Object3D>(`${side} gaze`), upper: node<THREE.Object3D>(`${side} upper eyelid`), lower: node<THREE.Object3D>(`${side} lower eyelid`),
    crease: node<THREE.Mesh>(`${side} eyelid crease`),
  })), guide: 0, look: 0, greet: 0, lastTime: null });
  model.traverse(object => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = object.material instanceof THREE.MeshBasicMaterial ? false : true; object.receiveShadow = true;
      for (const mat of Array.isArray(object.material) ? object.material : [object.material]) {
        if (mat instanceof THREE.MeshStandardMaterial && (mat.name === 'Glossy pupils' || mat.name === 'Deep brown irises')) mat.envMapIntensity = .4;
      }
    }
    if (object instanceof THREE.SkinnedMesh) object.frustumCulled = false;
  });
  animateEinsteinModel(model, 0, 'idle', 'left', true); return model;
}

export function animateEinsteinModel(model: THREE.Group, time: number, mode: EinsteinMode = 'idle', direction: EinsteinDirection = 'left', reducedMotion = false) {
  const rig = rigs.get(model); if (!rig) return;
  const delta = rig.lastTime === null ? 1 / 30 : Math.max(0, Math.min(.1, time - rig.lastTime)); rig.lastTime = time;
  const blend = reducedMotion ? 1 : 1 - Math.exp(-delta * 5.5);
  rig.guide += ((mode === 'guide' ? 1 : 0) - rig.guide) * blend;
  rig.greet += ((mode === 'wave' ? 1 : 0) - rig.greet) * blend;
  const side = direction === 'left' ? -1 : 1;
  rig.look += (side * rig.guide - rig.look) * blend;
  const idle = reducedMotion ? 0 : Math.sin(time * 1.2);
  model.position.y = idle * .004;
  rig.head.rotation.z = idle * .008 - rig.look * .025;
  rig.head.rotation.y = (reducedMotion ? 0 : Math.sin(time * .48) * .025) + rig.look * .18;
  rig.head.rotation.x = rig.greet * (reducedMotion ? -.02 : Math.sin(time * 2.8) * .025);
  const phase = time % 5.1;
  const blink = !reducedMotion && phase > 4.86 ? Math.sin((phase - 4.86) / .24 * Math.PI) : 0;
  for (const eye of rig.eyes) {
    eye.gaze.position.x = rig.look * .015;
    eye.gaze.visible = blink < .65;
    eye.upper.visible = blink > .015; eye.lower.visible = blink > .015;
    eye.upper.rotation.x = -Math.PI / 2 * (1 - blink);
    eye.lower.rotation.x = Math.PI / 2 * (1 - blink);
    eye.crease.visible = blink > .7;
    (eye.crease.material as THREE.MeshStandardMaterial).opacity = .6 * THREE.MathUtils.smoothstep(blink, .7, .95);
  }
}

export function disposeEinsteinModel(model: THREE.Group) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  model.traverse(object => {
    if (object instanceof THREE.Mesh) {
      geometries.add(object.geometry); for (const mat of Array.isArray(object.material) ? object.material : [object.material]) materials.add(mat);
    }
    if (object instanceof THREE.SkinnedMesh) object.skeleton.dispose();
  });
  for (const material of materials) for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
  const images = new Set<unknown>();
  for (const texture of textures) { images.add(texture.image); texture.dispose(); }
  for (const image of images) if (image && typeof (image as ImageBitmap).close === 'function') (image as ImageBitmap).close();
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); rigs.delete(model);
}
