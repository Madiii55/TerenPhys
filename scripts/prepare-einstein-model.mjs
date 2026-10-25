import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { createHash } from 'node:crypto';
import { bakeEinsteinTexture } from './bake-einstein-texture.mjs';
import { finishEinsteinGeometry } from './finish-einstein-geometry.mjs';

const smooth = THREE.MathUtils.smoothstep;
// Keep every authored triangle; finish remeshing noise, bake PBR maps and add a head rig.
export function prepareEinsteinModel(source) {
  const parsed = new OBJLoader().parse(source);
  const parts = []; parsed.traverse(o => { if (o instanceof THREE.Mesh) parts.push(o); });
  if (parts.length !== 1) throw new Error('Expected the single authored model mesh');
  const original = parts[0].geometry;
  const finish = finishEinsteinGeometry(original);
  const texture = bakeEinsteinTexture(original);
  original.computeBoundingBox();
  const bounds = original.boundingBox, scale = 3.95 / (bounds.max.y - bounds.min.y);
  const centerX = (bounds.max.x + bounds.min.x) / 2, centerZ = (bounds.max.z + bounds.min.z) / 2;
  const model = new THREE.Group(); model.name = 'Einstein';
  model.userData = { rig: 'terenphys-user-einstein-v1', source: 'base.obj', sourceSha256: createHash('sha256').update(source).digest('hex'), sourceTriangles: original.attributes.position.count / 3, finish, modelVersion: '20261014-user-2' };
  const bodyBone = new THREE.Bone(); bodyBone.name = 'Body'; model.add(bodyBone);
  const head = new THREE.Bone(); head.name = 'Head'; head.position.set(0, 1.075 * scale, 0); bodyBone.add(head);
  const skeleton = new THREE.Skeleton([bodyBone, head]);
  const positions = original.attributes.position, normals = original.attributes.normal;
  const p = [], n = [], u = [], indices = [], weights = [];
  const geometry = new THREE.BufferGeometry();
  const material = new THREE.MeshStandardMaterial({ name: 'Painted authored sculpt', color: '#ffffff', roughness: 1, metalness: 0 });
  for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
      p.push((x - centerX) * scale, (y - bounds.min.y) * scale, (z - centerZ) * scale);
      n.push(normals.getX(i), normals.getY(i), normals.getZ(i));
      u.push(original.attributes.uv.getX(i), original.attributes.uv.getY(i));
      const headWeight = Math.round(smooth(y, 1.04, 1.125) * 255); indices.push(0, 1, 0, 0); weights.push(255 - headWeight, headWeight, 0, 0);
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2));
  geometry.setAttribute('skinIndex', new THREE.Uint8BufferAttribute(indices, 4));
  geometry.setAttribute('skinWeight', new THREE.Uint8BufferAttribute(weights, 4, true));
  const compact = mergeVertices(geometry, 1e-6); geometry.dispose(); original.dispose();
  const sculpt = new THREE.SkinnedMesh(compact, material); sculpt.name = 'Authored Einstein sculpt'; sculpt.castShadow = true; sculpt.receiveShadow = true; model.add(sculpt);
  model.updateMatrixWorld(true); sculpt.bind(skeleton); sculpt.frustumCulled = false;

  const iris = new THREE.MeshStandardMaterial({ name: 'Deep brown irises', color: '#241a15', roughness: .25 });
  const pupil = new THREE.MeshStandardMaterial({ name: 'Glossy pupils', color: '#080a0c', roughness: .17 });
  const skin = new THREE.MeshStandardMaterial({ name: 'Eyelid skin', color: '#e9ab85', roughness: .61 });
  const light = new THREE.MeshBasicMaterial({ name: 'Eye catchlights', color: '#ffffff' });
  const creaseMaterial = new THREE.MeshStandardMaterial({ name: 'Closed eyelid crease', color: '#99654e', roughness: .9, transparent: true, opacity: .6 });
  const sphere = new THREE.SphereGeometry(1, 32, 20);
  const addSphere = (parent, mat, pos, size, name) => {
    const mesh = new THREE.Mesh(sphere, mat); mesh.position.set(...pos); mesh.scale.set(...size); mesh.name = name; parent.add(mesh); return mesh;
  };
  for (const side of [-1, 1]) {
    const label = side === -1 ? 'Right' : 'Left';
    const eye = new THREE.Group(); eye.name = `${label} eye`; eye.position.set((side * .119 - centerX) * scale, (1.429 - 1.075) * scale, (.301 - centerZ) * scale); head.add(eye);
    const gaze = new THREE.Group(); gaze.name = `${label} gaze`; eye.add(gaze);
    addSphere(gaze, iris, [0, -.001 * scale, .003 * scale], [.045 * scale, .049 * scale, .004 * scale], `${label} iris`);
    addSphere(gaze, pupil, [0, -.001 * scale, .007 * scale], [.040 * scale, .044 * scale, .0035 * scale], `${label} pupil`);
    addSphere(gaze, light, [-.013 * scale, .019 * scale, .014 * scale], [.0065 * scale, .008 * scale, .0012 * scale], `${label} reflection`);
    addSphere(gaze, light, [.014 * scale, -.016 * scale, .013 * scale], [.002 * scale, .0025 * scale, .001 * scale], `${label} small reflection`);
    for (const upper of [true, false]) {
      // Keep the animated pivot outside the mesh: quantization may recenter its geometry.
      const pivot = new THREE.Group(); pivot.name = `${label} ${upper ? 'upper' : 'lower'} eyelid`;
      pivot.rotation.x = upper ? -Math.PI / 2 : Math.PI / 2; eye.add(pivot);
      const lid = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, upper ? 0 : Math.PI / 2, Math.PI / 2), skin);
      lid.scale.set(.074 * scale, .065 * scale, .027 * scale);
      lid.name = `${label} ${upper ? 'upper' : 'lower'} eyelid surface`; pivot.add(lid);
    }
    const creasePath = new THREE.CatmullRomCurve3([new THREE.Vector3(-.058, -.001, .018), new THREE.Vector3(0, -.005, .028), new THREE.Vector3(.058, -.001, .018)].map(point => point.multiplyScalar(scale)));
    const crease = new THREE.Mesh(new THREE.TubeGeometry(creasePath, 20, .0011 * scale, 6, false), creaseMaterial);
    crease.name = `${label} eyelid crease`; eye.add(crease);
  }
  return { model, texture };
}
