import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { test } from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { animateEinsteinModel, bindEinsteinModel, disposeEinsteinModel } from '../src/graphics/createEinstein.ts';

const bytes = readFileSync(new URL('../public/models/einstein.glb', import.meta.url));
const jsonLength = bytes.readUInt32LE(12);
const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength));
Object.defineProperty(globalThis, 'self', { configurable: true, value: globalThis });

// Node has no bitmap renderer. Validate and inflate the actual embedded PNGs before
// supplying bitmap handles for geometry / rig tests; visual pixels are checked in the browser.
globalThis.createImageBitmap = (async (blob: Blob) => {
  const png = Buffer.from(await blob.arrayBuffer());
  assert.deepEqual([...png.subarray(0, 8)], [137,80,78,71,13,10,26,10]);
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20), compressed: Buffer[] = [];
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset), type = png.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') compressed.push(png.subarray(offset + 8, offset + 8 + length)); offset += 12 + length;
  }
  assert.equal(inflateSync(Buffer.concat(compressed)).length, (width * 3 + 1) * height);
  return { width, height, close() {} };
}) as unknown as typeof createImageBitmap;

async function loadModel() {
  const loaded = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  return bindEinsteinModel(loaded.scene);
}

test('the published model comes from the exact authored OBJ, preserves every source triangle, and embeds PBR textures', () => {
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
  assert.equal(bytes.readUInt32LE(4), 2); assert.equal(bytes.readUInt32LE(8), bytes.length);
  assert.ok(bytes.length < 2_000_000, 'the full asset stays compact');
  const sourceHash = createHash('sha256').update(readFileSync(new URL('../model-source/einstein/base.obj', import.meta.url))).digest('hex');
  const provenance = gltf.nodes.find((node: { extras?: { sourceSha256?: string } }) => node.extras?.sourceSha256 === sourceHash)?.extras;
  assert.ok(provenance, 'the user model is the source, not the earlier procedural character');
  assert.equal(provenance.sourceTriangles, 120000);
  assert.ok(provenance.finish.maxDisplacement < .004, 'fairing does not change the authored silhouette');
  assert.equal(gltf.images.length, 2);
  assert.ok(gltf.images.every((image: { uri?: string; bufferView?: number; mimeType?: string }) => !image.uri && image.bufferView !== undefined && image.mimeType === 'image/png'));
  assert.ok(gltf.buffers.every((buffer: { uri?: string }) => !buffer.uri));
  assert.ok(gltf.extensionsRequired.includes('EXT_meshopt_compression'));
  assert.equal(gltf.skins.length, 1);
});

test('the real compressed asset loads with finite geometry, authored proportions, and a textured head rig', async () => {
  const model = await loadModel();
  try {
    model.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
    assert.ok(Math.abs(size.y - 3.95) < .01, `height ${size.y}`);
    assert.ok(size.x > 1.7 && size.x < 2.0, `width ${size.x}`);
    let triangles = 0, meshes = 0, authoredTriangles = 0, textured = false;
    model.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      meshes++; const p = object.geometry.attributes.position;
      assert.ok([...p.array].every(Number.isFinite));
      const count = (object.geometry.index?.count ?? p.count) / 3; triangles += count;
      if (object instanceof THREE.SkinnedMesh) {
        authoredTriangles += count;
        const material = object.material as THREE.MeshStandardMaterial;
        textured = !!material.map && !!material.roughnessMap;
        assert.equal((material.map!.image as { width: number }).width, 2048);
        const weights = object.geometry.attributes.skinWeight;
        for (let i = 0; i < weights.count; i += 53) assert.ok(Math.abs(weights.getX(i) + weights.getY(i) - 1) < 1e-5);
      }
    });
    assert.equal(authoredTriangles, 120000); assert.ok(textured);
    assert.ok(triangles < 140000); assert.ok(meshes <= 16, 'including the two animated eyelid creases');
    assert.ok(model.getObjectByName('Head') instanceof THREE.Bone);
  } finally { disposeEinsteinModel(model); }
});

test('guide turns towards either real target, eyelids close the gaze, and reduced motion keeps the face still', async () => {
  const model = await loadModel();
  try {
    const head = model.getObjectByName('Head')!, gaze = model.getObjectByName('Right gaze')!;
    for (const direction of ['left', 'right'] as const) {
      animateEinsteinModel(model, 0, 'guide', direction, true);
      assert.ok(direction === 'left' ? head.rotation.y < -.15 : head.rotation.y > .15);
      assert.ok(direction === 'left' ? gaze.position.x < 0 : gaze.position.x > 0);
    }
    animateEinsteinModel(model, 4.98, 'idle');
    assert.equal(gaze.visible, false);
    assert.equal(model.getObjectByName('Right eyelid crease')!.visible, true);
    assert.ok(Math.abs(model.getObjectByName('Right upper eyelid')!.rotation.x) < .01);
    animateEinsteinModel(model, 4.98, 'idle', 'left', true);
    assert.equal(gaze.visible, true);
    assert.equal(model.getObjectByName('Right upper eyelid')!.visible, false);
    assert.equal(model.getObjectByName('Right eyelid crease')!.visible, false);
    assert.equal(model.position.y, 0); assert.equal(head.rotation.y, 0);
    const upper = model.getObjectByName('Right upper eyelid')!, lower = model.getObjectByName('Right lower eyelid')!;
    assert.ok(!(upper instanceof THREE.Mesh) && !(lower instanceof THREE.Mesh)
      && upper.children.some(child => child instanceof THREE.Mesh) && lower.children.some(child => child instanceof THREE.Mesh), 'animated pivots remain outside the quantized meshes');
    upper.rotation.x = lower.rotation.x = 0; model.updateMatrixWorld(true);
    const upperBounds = new THREE.Box3().setFromObject(upper), lowerBounds = new THREE.Box3().setFromObject(lower);
    assert.ok(Math.abs(upperBounds.min.y - lowerBounds.max.y) < .001, 'closed eyelid halves meet at the eye center');
    assert.ok(Math.abs(upperBounds.max.z - lowerBounds.max.z) < .001, 'both halves enclose the eye at the same depth');
  } finally { disposeEinsteinModel(model); }
});

test('changing guide direction blends the head turn instead of snapping across the face', async () => {
  const model = await loadModel();
  try {
    animateEinsteinModel(model, 0, 'guide', 'left', true);
    const head = model.getObjectByName('Head')!; let previous = head.rotation.y;
    for (let frame = 1; frame <= 45; frame++) {
      animateEinsteinModel(model, frame / 30, 'guide', 'right');
      assert.ok(Math.abs(head.rotation.y - previous) < .07); previous = head.rotation.y;
    }
    assert.ok(head.rotation.y > .15);
  } finally { disposeEinsteinModel(model); }
});
