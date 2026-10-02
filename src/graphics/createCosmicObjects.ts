import * as THREE from 'three';
import { distantGalaxyFragment, galaxyFragment, galaxyVertex, galaxyVolumeFragment, galaxyVolumeVertex, starFragment, starVertex, worldVertex } from './cosmicShaders.ts';
import galaxyDiskReferenceUrl from '../assets/images/galaxy-disk-reference.png';

function seededRandom(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export function createStarField(count: number, kind: 'stars' | 'gas' | 'sky', pixelRatio: number) {
  const random = seededRandom(kind === 'sky' ? 1409 : kind === 'gas' ? 9347 : 2026);
  const gaussian = () => Math.sqrt(-2 * Math.log(Math.max(random(), 0.0001))) * Math.cos(random() * Math.PI * 2);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  const warm = new THREE.Color('#f5dfb7');
  const ice = new THREE.Color('#bdcedf');
  const young = new THREE.Color('#ddeaff');
  const color = new THREE.Color();

  for (let i = 0; i < count; i++) {
    let x: number, y: number, z: number;
    if (kind === 'sky') {
      const r = 150 + random() * 110;
      const theta = random() * Math.PI * 2;
      const vertical = random() * 2 - 1;
      const horizontal = Math.sqrt(1 - vertical * vertical);
      x = r * horizontal * Math.cos(theta);
      z = r * horizontal * Math.sin(theta);
      y = r * vertical;
      color.setHSL(0.55 + random() * 0.16, random() * 0.45, 0.65 + random() * 0.3);
      sizes[i] = 0.35 + Math.pow(random(), 12) * 3.8;
      color.multiplyScalar(0.8 + Math.pow(random(), 10) * 4.0);
    } else {
      const bulge = random() < 0.28;
      const diffuse = !bulge && random() < 0.48;
      const r = bulge ? Math.pow(random(), 1.5) * 9 : 2 + Math.pow(random(), 0.66) * 48;
      const arm = Math.floor(random() * 3);
      const baseAngle = arm * Math.PI * 2 / 3 + Math.log(1 + r / 2.8) * 3.35 + Math.sin(r * 0.31) * 0.07;
      const width = (1.5 + r * 0.15) / Math.max(r, 0.1);
      const angle = bulge || diffuse ? random() * Math.PI * 2 : baseAngle + gaussian() * width;
      x = Math.cos(angle) * r;
      z = Math.sin(angle) * r;
      // Thick stellar bulge, flared arms and uneven local height provide real
      // parallax over the bent textured surface when the camera changes angle.
      y = gaussian() * (bulge ? 2.3 : 0.42 + r * 0.031);
      const outer = THREE.MathUtils.smoothstep(r, 6, 29);
      const spectralType = random();
      color.copy(warm).lerp(spectralType < 0.18 ? young : ice, outer * 0.8);
      const tail = 1 - THREE.MathUtils.smoothstep(r, 31, 50);
      if (kind === 'gas') {
        color.multiplyScalar((0.08 + random() * 0.18) * tail);
        sizes[i] = 0.4 + random() * 1.4;
      } else {
        const bright = Math.pow(random(), 22);
        color.multiplyScalar((0.18 + random() * 0.42 + bright * 3.0) * tail);
        sizes[i] = 0.025 + Math.pow(random(), 9) * 0.23 + bright * 0.5;
      }
    }
    positions.set([x, y, z], i * 3);
    colors.set([color.r, color.g, color.b], i * 3);
    phases[i] = random() * Math.PI * 2;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  const material = new THREE.ShaderMaterial({
    vertexShader: starVertex, fragmentShader: starFragment, vertexColors: true,
    uniforms: {
      // Differential rotation continues at a constant rate for each radius.
      uTime: { value: 0 }, uPixelRatio: { value: pixelRatio }, uOrbit: { value: kind === 'sky' ? 0 : 0.12 },
      uOpacity: { value: kind === 'sky' ? 0.72 : 0 }, uSoft: { value: kind === 'gas' ? 1 : 0 },
    },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  return new THREE.Points(geometry, material);
}

export function createGalaxyClouds(mobile = false) {
  let readyAt = 0;
  let disposed = false;
  const texture = new THREE.TextureLoader().load(galaxyDiskReferenceUrl, (loaded) => {
    if (disposed) { loaded.dispose(); return; }
    material.uniforms.uReferenceAspect.value = loaded.image.width / loaded.image.height;
    readyAt = performance.now();
  }, undefined, () => {
    if (!disposed) console.warn('Galaxy disk texture unavailable; using the soft fallback.');
  });
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: 0 }, uDiskPhoto: { value: texture }, uPhotoMix: { value: 0 },
      uReferenceAspect: { value: 1730 / 1428 }, uPhotoGain: { value: 0.88 }, uTime: { value: 0 },
      uLocalCamera: { value: new THREE.Vector3() },
    },
    vertexShader: galaxyVertex, fragmentShader: galaxyFragment(mobile ? 24 : 48),
    transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
  });
  const disk = new THREE.Mesh(new THREE.BoxGeometry(120, 24, 120), material);
  disk.onBeforeRender = (_renderer, _scene, camera) => {
    if (readyAt > 0) material.uniforms.uPhotoMix.value = THREE.MathUtils.smoothstep(performance.now() - readyAt, 0, 650);
    camera.getWorldPosition(material.uniforms.uLocalCamera.value);
    disk.worldToLocal(material.uniforms.uLocalCamera.value);
  };
  material.addEventListener('dispose', () => { disposed = true; texture.dispose(); });
  return disk;
}

/** Additional clumpy clouds occupy real positions throughout the galaxy volume. */
export function createGalaxyVolume(count: number, dust: boolean, pixelRatio: number, disk: ReturnType<typeof createGalaxyClouds>) {
  const random = seededRandom(dust ? 5672 : 7129);
  const gaussian = () => Math.sqrt(-2 * Math.log(Math.max(random(), 0.0001))) * Math.cos(random() * Math.PI * 2);
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const bulge = !dust && random() < 0.26;
    const r = bulge ? Math.pow(random(), 0.9) * 9 : 3 + Math.pow(random(), 0.7) * 48;
    const arm = Math.floor(random() * 3);
    const spiral = arm * Math.PI * 2 / 3 + Math.log(1 + r / 2.8) * 3.35;
    const angle = bulge || random() < 0.62 ? random() * Math.PI * 2 : spiral + gaussian() * 0.16;
    const clump = 0.7 + 0.45 * Math.sin(angle * 5 + r * 0.24);
    const height = gaussian() * (bulge ? 3.2 : (0.5 + r * 0.04) * clump);
    positions.set([Math.cos(angle) * r, height + (dust ? 0.65 : 0), Math.sin(angle) * r], i * 3);
    sizes[i] = dust ? 1.6 + random() * 3.1 : 0.65 + Math.pow(random(), 2) * 2.5;
    phases[i] = random() * Math.PI * 2;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uPixelRatio: { value: pixelRatio }, uOpacity: { value: 0 }, uDust: { value: dust ? 1 : 0 },
      uDiskPhoto: disk.material.uniforms.uDiskPhoto,
      uPhotoMix: disk.material.uniforms.uPhotoMix,
      uReferenceAspect: disk.material.uniforms.uReferenceAspect,
    },
    vertexShader: galaxyVolumeVertex, fragmentShader: galaxyVolumeFragment,
    transparent: true, depthWrite: false, blending: dust ? THREE.NormalBlending : THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geometry, material);
  // Absorption is composited over the emitting clouds, with soft sprite edges.
  points.renderOrder = dust ? 2 : 1;
  return points;
}

/** World-fixed distant galaxies. They do not orbit, spin or follow the camera. */
export function createStaticBackdrop() {
  const group = new THREE.Group();
  const objects = [
    { position: [-88, 38, -70], size: 15, roll: -0.45 },
    { position: [114, 25, -35], size: 19, roll: 0.7 },
    { position: [-44, -56, 104], size: 12, roll: 0.35 },
    { position: [44, 61, 127], size: 17, roll: -0.8 },
    { position: [174, -64, -82], size: 18, roll: 0.6 },
    { position: [186, -21, 88], size: 23, roll: -0.4 },
    { position: [-160, -94, -133], size: 21, roll: 0.2 },
    { position: [-101, 137, -161], size: 17, roll: -0.55 },
  ];
  objects.forEach(({ position, size, roll }, index) => {
    const material = new THREE.ShaderMaterial({
      uniforms: { uOpacity: { value: 0.75 }, uSeed: { value: index * 8.3 + 2.1 } },
      vertexShader: worldVertex, fragmentShader: distantGalaxyFragment,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const object = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
    object.position.set(position[0], position[1], position[2]);
    object.lookAt(0, 0, 0);
    object.rotateZ(roll);
    object.renderOrder = -1;
    group.add(object);
  });
  return group;
}
