import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

/** Gentle nonshrinking fairing of remeshing noise, restricted to the face. */
export function finishEinsteinGeometry(original) {
  const topology = new THREE.BufferGeometry(); topology.setAttribute('position', original.attributes.position.clone());
  const welded = mergeVertices(topology, 1e-6); topology.dispose();
  const p = welded.attributes.position, index = welded.index.array, neighbors = Array.from({ length: p.count }, () => new Set());
  for (let i = 0; i < index.length; i += 3) {
    const [a, b, c] = [index[i], index[i + 1], index[i + 2]];
    neighbors[a].add(b).add(c); neighbors[b].add(a).add(c); neighbors[c].add(a).add(b);
  }
  const source = p.array.slice(), faceWeight = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    faceWeight[i] = THREE.MathUtils.smoothstep(z, .13, .23) * THREE.MathUtils.smoothstep(y, 1.08, 1.15)
      * (1 - THREE.MathUtils.smoothstep(y, 1.64, 1.70)) * (1 - THREE.MathUtils.smoothstep(Math.abs(x), .27, .32));
  }
  for (let pass = 0; pass < 6; pass++) {
    const next = p.array.slice(), lambda = pass % 2 === 0 ? .31 : -.325;
    for (let i = 0; i < p.count; i++) {
      if (!faceWeight[i]) continue;
      const list = neighbors[i];
      for (let axis = 0; axis < 3; axis++) {
        let sum = 0; for (const neighbor of list) sum += p.array[neighbor * 3 + axis];
        next[i * 3 + axis] += lambda * faceWeight[i] * (sum / list.size - p.array[i * 3 + axis]);
      }
    }
    p.array.set(next);
  }
  welded.computeVertexNormals();
  const key = (x, y, z) => `${Math.round(x * 1e6)},${Math.round(y * 1e6)},${Math.round(z * 1e6)}`;
  const lookup = new Map(); for (let i = 0; i < p.count; i++) lookup.set(key(source[i * 3], source[i * 3 + 1], source[i * 3 + 2]), i);
  const positions = original.attributes.position, normals = original.attributes.normal; let maxDisplacement = 0;
  for (let i = 0; i < positions.count; i++) {
    const at = lookup.get(key(positions.getX(i), positions.getY(i), positions.getZ(i)));
    if (at === undefined) throw new Error('Lost an authored source vertex');
    maxDisplacement = Math.max(maxDisplacement, Math.hypot(p.getX(at) - positions.getX(i), p.getY(at) - positions.getY(i), p.getZ(at) - positions.getZ(i)));
    positions.setXYZ(i, p.getX(at), p.getY(at), p.getZ(at));
    normals.setXYZ(i, welded.attributes.normal.getX(at), welded.attributes.normal.getY(at), welded.attributes.normal.getZ(at));
  }
  welded.dispose(); return { sourceVertices: p.count, sourceTriangles: index.length / 3, maxDisplacement };
}
