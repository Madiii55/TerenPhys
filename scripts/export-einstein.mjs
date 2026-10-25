import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { prepareEinsteinModel } from './prepare-einstein-model.mjs';
import { disposeEinsteinModel } from '../src/graphics/createEinstein.ts';
import { NodeIO } from './model-tools/node_modules/@gltf-transform/core/dist/index.js';
import { ALL_EXTENSIONS } from './model-tools/node_modules/@gltf-transform/extensions/dist/index.js';
import { meshopt } from './model-tools/node_modules/@gltf-transform/functions/dist/index.js';
import { MeshoptEncoder, MeshoptDecoder } from './model-tools/node_modules/meshoptimizer/index.js';

// Encode geometry first, then embed the baked PNG maps and compress the finished GLB.
globalThis.FileReader ??= class {
  result = null;
  onloadend = null;
  onerror = null;
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); }, error => this.onerror?.(error));
  }
};
const { model, texture } = prepareEinsteinModel(await readFile(new URL('../model-source/einstein/base.obj', import.meta.url), 'utf8'));
const target = new URL('../public/models/', import.meta.url);
try {
  const raw = await new GLTFExporter().parseAsync(model, { binary: true, onlyVisible: true });
  await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  const document = await io.readBinary(new Uint8Array(raw));
  const albedo = document.createTexture('Einstein hand-finished albedo').setImage(texture.albedo).setMimeType('image/png');
  const orm = document.createTexture('Einstein material roughness').setImage(texture.orm).setMimeType('image/png');
  for (const material of document.getRoot().listMaterials()) if (material.getName() === 'Painted authored sculpt') {
    material.setBaseColorTexture(albedo).setMetallicRoughnessTexture(orm).setMetallicFactor(1).setRoughnessFactor(1);
  }
  await document.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium', quantizePosition: 16, quantizeNormal: 12, quantizeTexcoord: 16 }));
  const glb = await io.writeBinary(document);
  await mkdir(target, { recursive: true });
  await writeFile(new URL('einstein.glb', target), Buffer.from(glb));
  let meshes = 0, triangles = 0;
  model.traverse(object => { if (object.isMesh) { meshes++; triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3; } });
  await writeFile(new URL('../../build/einstein-albedo.png', target), texture.albedo);
  await writeFile(new URL('../../build/einstein-model-export.json', target), JSON.stringify({ source: model.userData, bytes: glb.byteLength, meshes, triangles, textureDimension: texture.dimension, paintedPixels: texture.coveredPixels }, null, 2));
  console.log(JSON.stringify({ file: 'public/models/einstein.glb', bytes: glb.byteLength, meshes, triangles, textureDimension: texture.dimension }));
} finally { disposeEinsteinModel(model); }
