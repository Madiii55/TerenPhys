import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { animateEinsteinModel, bindEinsteinModel, disposeEinsteinModel, type EinsteinDirection, type EinsteinMode } from '../graphics/createEinstein.ts';
import '../styles/einstein-avatar.css';

export interface EinsteinAvatarProps {
  mode?: EinsteinMode;
  guideDirection?: EinsteinDirection;
  active?: boolean;
  className?: string;
  viewAngle?: number;
  portrait?: boolean;
  still?: boolean;
  sampleTime?: number;
}

/** Transparent, decorative WebGL avatar. The parent owns placement and accessible controls. */
export default function EinsteinAvatar({ mode = 'idle', guideDirection = 'left', active = true, className = '', viewAngle = -.065, portrait = false, still = false, sampleTime }: EinsteinAvatarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ mode, guideDirection, active, viewAngle, portrait, still, sampleTime });
  stateRef.current = { mode, guideDirection, active, viewAngle, portrait, still, sampleTime };
  const refreshRef = useRef<(() => void) | null>(null);
  useEffect(() => { refreshRef.current?.(); }, [mode, guideDirection, active, viewAngle, portrait, still, sampleTime]);
  useEffect(() => {
    const container = containerRef.current; if (!container) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' }); }
    catch { container.dataset.renderer = 'unavailable'; return; }
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = .88;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(renderer.domElement);
    container.dataset.renderer = 'loading';
    const scene = new THREE.Scene();
    let model: THREE.Group | null = null;
    const room = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const environment = pmrem.fromScene(room, .035); scene.environment = environment.texture; scene.environmentIntensity = .22;
    room.dispose(); pmrem.dispose();
    const camera = new THREE.OrthographicCamera(-1.6, 1.6, 2.15, -2.15, .1, 30);
    camera.position.set(.25, 2.24, 8); camera.lookAt(0, 1.91, 0);
    scene.add(new THREE.HemisphereLight('#fff5eb', '#8190a7', .60));
    const key = new THREE.DirectionalLight('#fff5ed', 2.3);
    key.position.set(-3, 6, 5); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -2; key.shadow.camera.right = 2;
    key.shadow.camera.top = 4.4; key.shadow.camera.bottom = -1;
    key.shadow.normalBias = .012; key.shadow.bias = -.00015; key.shadow.radius = 3;
    scene.add(key);
    const fill = new THREE.DirectionalLight('#e5edff', .55); fill.position.set(4, 3, 5); scene.add(fill);
    const rim = new THREE.DirectionalLight('#e7edff', 1.4); rim.position.set(3, 4, -3); scene.add(rim);
    const floorGeometry = new THREE.PlaneGeometry(5, 5);
    const floorMaterial = new THREE.ShadowMaterial({ opacity: .2 });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2; floor.position.y = .005; floor.receiveShadow = true; scene.add(floor);
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reducedMotion = preference.matches, lastFrame = -Infinity, elapsed = 0, disposed = false;
    const render = (now: number) => {
      if (disposed || !model || !stateRef.current.active || document.hidden) return;
      if (now - lastFrame < 1000 / 30) return;
      const delta = Number.isFinite(lastFrame) ? Math.min((now - lastFrame) / 1000, .1) : 0;
      lastFrame = now; elapsed += delta;
      model.rotation.y = stateRef.current.viewAngle;
      const halfHeight = stateRef.current.portrait ? 1.18 : 2.15;
      camera.top = halfHeight; camera.bottom = -halfHeight;
      const halfWidth = halfHeight * Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight);
      camera.left = -halfWidth; camera.right = halfWidth;
      const center = stateRef.current.portrait ? 3.02 : 1.96;
      camera.position.set(.12, center + .16, 8); camera.lookAt(0, center, 0); camera.updateProjectionMatrix();
      animateEinsteinModel(model, stateRef.current.sampleTime ?? elapsed, stateRef.current.mode, stateRef.current.guideDirection, reducedMotion || (stateRef.current.still && stateRef.current.sampleTime === undefined));
      renderer.render(scene, camera);
    };
    const resume = () => {
      if (disposed) return;
      lastFrame = -Infinity;
      renderer.setAnimationLoop(!reducedMotion && !stateRef.current.still && stateRef.current.sampleTime === undefined && stateRef.current.active && !document.hidden ? render : null);
      render(performance.now());
    };
    refreshRef.current = resume;
    const resize = () => {
      const width = Math.max(1, container.clientWidth), height = Math.max(1, container.clientHeight);
      renderer.setSize(width, height, false);
      const halfWidth = 2.15 * width / height;
      camera.left = -halfWidth; camera.right = halfWidth; camera.updateProjectionMatrix(); resume();
    };
    const observer = new ResizeObserver(resize); observer.observe(container); resize();
    new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load('/models/einstein.glb?v=20261014-user-2', gltf => {
      if (disposed) { disposeEinsteinModel(gltf.scene); return; }
      try {
        model = bindEinsteinModel(gltf.scene); scene.add(model); container.dataset.renderer = 'three'; resume();
      } catch { disposeEinsteinModel(gltf.scene); model = null; container.dataset.renderer = 'unavailable'; }
    }, undefined, () => { if (!disposed) container.dataset.renderer = 'unavailable'; });
    const motionChanged = () => { reducedMotion = preference.matches; resume(); };
    const contextLost = (event: Event) => { event.preventDefault(); renderer.setAnimationLoop(null); container.dataset.renderer = 'unavailable'; };
    const contextRestored = () => { container.dataset.renderer = 'three'; resume(); };
    document.addEventListener('visibilitychange', resume); preference.addEventListener('change', motionChanged);
    renderer.domElement.addEventListener('webglcontextlost', contextLost);
    renderer.domElement.addEventListener('webglcontextrestored', contextRestored);
    return () => {
      disposed = true; refreshRef.current = null; observer.disconnect(); renderer.setAnimationLoop(null);
      document.removeEventListener('visibilitychange', resume); preference.removeEventListener('change', motionChanged);
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', contextRestored);
      if (model) disposeEinsteinModel(model); floorGeometry.dispose(); floorMaterial.dispose();
      key.shadow.dispose(); environment.dispose(); renderer.dispose(); renderer.domElement.remove();
    };
  }, []);
  return <div ref={containerRef} className={'einstein-avatar ' + className} aria-hidden="true"/>;
}
