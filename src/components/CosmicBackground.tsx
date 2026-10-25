import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { CopyShader } from 'three/addons/shaders/CopyShader.js';
import { createGalaxyClouds, createGalaxyVolume, createNuclearCluster, createStarField, createStaticBackdrop } from '../graphics/createCosmicObjects.ts';
import { blackHoleFragment, detailBlendShader, worldVertex } from '../graphics/cosmicShaders.ts';
import { CameraFlight, type CameraView } from '../graphics/cameraFlight.ts';
import { cosmicCameraOrientation } from '../graphics/orientation.ts';
import { cosmicVisibility, FAR_CLIP, GALAXY_SCALE, GALAXY_SHAPE, GALAXY_ROTATION_RATE, GALAXY_MATTER_RATE, HOME_DISTANCE, ORBIT_DURATION, ZOOM_DURATION } from '../graphics/cosmicScale.ts';
import { ACCRETION_DISK, ACCRETION_STEPS, accretionMatterPhase } from '../graphics/accretionDisk.ts';
import { AdaptiveRenderBudget, CosmicFramePacer, cosmicDeviceBudget, cosmicRenderSize } from '../graphics/renderBudget.ts';
import type { NavTab } from './Navbar.tsx';

const VIEWS: Record<NavTab, CameraView> = {
  home: { distance: HOME_DISTANCE, polar: 1.42, azimuth: 0.16, panX: 0.265, panY: 0.015 },
  study: { distance: 87 * GALAXY_SCALE, polar: 0.82, azimuth: -0.7, panX: -0.27, panY: 0.3 },
  posts: { distance: 86 * GALAXY_SCALE, polar: 1.02, azimuth: 0.65, panX: 0.18, panY: -0.12 },
  profile: { distance: 85 * GALAXY_SCALE, polar: 1.08, azimuth: 1.8, panX: 0.14, panY: 0.2 },
  forum: { distance: 89 * GALAXY_SCALE, polar: 0.94, azimuth: -1.65, panX: -0.08, panY: -0.06 },
};

interface CosmicBackgroundProps {
  activeTab: NavTab;
  transitionId: number;
  onTransitionComplete?: (id: number) => void;
}

export function CosmicBackground({ activeTab, transitionId, onTransitionComplete }: CosmicBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRef = useRef(activeTab);
  tabRef.current = activeTab;
  const requestRef = useRef(transitionId);
  requestRef.current = transitionId;
  const completeRef = useRef(onTransitionComplete);
  completeRef.current = onTransitionComplete;
  const fallbackRef = useRef(false);

  useEffect(() => {
    if (fallbackRef.current) completeRef.current?.(transitionId);
  }, [transitionId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const mobile = window.innerWidth < 768;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    const device = cosmicDeviceBudget(mobile, navigator.hardwareConcurrency, !!connection?.saveData);
    const budget = new AdaptiveRenderBudget(device.quality);
    const pacer = new CosmicFramePacer();
    let disposed = false;
    let prepared = false;
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reducedMotion = motionPreference.matches;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
    } catch (error) {
      console.warn('3D background unavailable:', error);
      fallbackRef.current = true;
      completeRef.current?.(requestRef.current);
      return;
    }
    // Presentation and heavy volumetric targets have separate pixel budgets.
    renderer.setPixelRatio(1);
    renderer.setClearColor('#02040c');
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.setAttribute('aria-hidden', 'true');
    renderer.domElement.dataset.accretionModel = 'relativistic-plasma';
    const accretionSteps = mobile ? ACCRETION_STEPS.mobile : ACCRETION_STEPS.desktop;
    renderer.domElement.dataset.accretionSteps = String(accretionSteps);
    container.appendChild(renderer.domElement);
    function contextLost(event: Event) {
      event.preventDefault();
      fallbackRef.current = true;
      renderer.domElement.hidden = true;
      renderer.setAnimationLoop(null);
      completeRef.current?.(requestRef.current);
    }
    renderer.domElement.addEventListener('webglcontextlost', contextLost);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, FAR_CLIP);
    const galaxy = new THREE.Group();
    // Updated when adaptive render targets resize, not tied to display DPI.
    let particleScale = GALAXY_SCALE;
    const farResolution = mobile ? 0.85 : 0.8;
    let farParticleScale = particleScale * farResolution;
    const stars = createStarField(mobile ? 30000 : 90000, 'stars', farParticleScale);
    const sky = createStarField(mobile ? 1300 : 3200, 'sky', particleScale);
    const clouds = createGalaxyClouds(mobile);
    const gas = createGalaxyVolume(mobile ? 18000 : 65000, false, farParticleScale, clouds);
    const dust = createGalaxyVolume(mobile ? 1200 : 4200, true, farParticleScale, clouds);
    const backdrop = createStaticBackdrop();
    const nucleus = createNuclearCluster(mobile ? 1200 : 2600);
    galaxy.add(clouds, gas, stars, dust);
    galaxy.scale.set(GALAXY_SCALE * GALAXY_SHAPE.x, GALAXY_SCALE * GALAXY_SHAPE.y, GALAXY_SCALE * GALAXY_SHAPE.z);
    sky.scale.setScalar(GALAXY_SCALE);
    backdrop.scale.setScalar(GALAXY_SCALE);
    scene.add(galaxy, sky, backdrop, nucleus);

    // The near ray tracer excludes the large galaxy volume. Its background
    // lensing fades before the small nuclear star field becomes prominent.
    // Crossfade complete layers to avoid opaque edges during the handover.
    const backgroundTarget = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType, depthBuffer: false,
    });
    const nearTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
    const farTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
    const backgroundCopyMaterial = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: backgroundTarget.texture }, opacity: { value: 1 } },
      vertexShader: CopyShader.vertexShader, fragmentShader: CopyShader.fragmentShader,
      depthTest: false, depthWrite: false,
    });
    const backgroundCopy = new FullScreenQuad(backgroundCopyMaterial);
    const cachedBackgroundView = new THREE.Matrix4();
    let backgroundDirty = true;
    const holeMaterial = new THREE.ShaderMaterial({
      vertexShader: worldVertex, fragmentShader: blackHoleFragment(accretionSteps),
      uniforms: {
        uCameraPosition: { value: new THREE.Vector3() },
        uViewProjection: { value: new THREE.Matrix4() },
        uBackground: { value: backgroundTarget.texture },
        uResolution: { value: new THREE.Vector2() }, uTime: { value: 0 },
        uDiskFrame: { value: new THREE.Matrix3().setFromMatrix4(
          new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(ACCRETION_DISK.tiltX, 0, ACCRETION_DISK.tiltZ)),
        ).transpose() },
        uMatterAges: { value: new THREE.Vector2() }, uMatterSeeds: { value: new THREE.Vector2() },
        uMatterMix: { value: 0 },
      },
      transparent: true, depthTest: false, depthWrite: false,
    });
    const blackHole = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), holeMaterial);
    blackHole.renderOrder = 10;
    scene.add(blackHole);

    const composer = new EffectComposer(renderer);
    composer.setPixelRatio(1);
    composer.renderTarget1.depthBuffer = false;
    composer.renderTarget2.depthBuffer = false;
    const detailBlend = new ShaderPass(detailBlendShader);
    detailBlend.uniforms.uNear.value = nearTarget.texture;
    detailBlend.uniforms.uFar.value = farTarget.texture;
    detailBlend.uniforms.uFocus.value = new THREE.Vector2();
    detailBlend.uniforms.uResolution.value = holeMaterial.uniforms.uResolution.value;
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.16, 0.35, 2.0);
    const output = new OutputPass();
    composer.addPass(detailBlend);
    composer.addPass(bloom);
    composer.addPass(output);

    let width = 1, height = 1;
    function responsiveView(tab: NavTab): CameraView {
      const compact = width < 768;
      const view = { ...VIEWS[tab] };
      if (compact) {
        view.distance *= tab === 'home' ? 1.3 : 1.75;
        view.panX = tab === 'study' ? -0.14 : tab === 'home' ? 0 : view.panX * .35;
        if (tab === 'study') view.panY = 0.34;
        if (tab === 'home') view.panY = 0.21;
      }
      return view;
    }
    let flight: CameraFlight;
    let destination = tabRef.current;
    let destinationRequest = requestRef.current;
    let notifiedRequest = -1;
    let wasCompact = false;
    const origin = new THREE.Vector3();
    let elapsed = 0;
    let lastTime = performance.now();
    let travelTime = 0;
    let diagnosticAt = 0;
    let diagnosticFrames = 0;
    let diagnosticElapsed = 0;
    let resizePending = false;

    function resizeTargets() {
      const size = cosmicRenderSize(width, height, window.devicePixelRatio, budget.quality, mobile);
      if (renderer.getPixelRatio() !== size.outputRatio) renderer.setPixelRatio(size.outputRatio);
      renderer.setSize(width, height, false);
      composer.setSize(size.width, size.height);
      // Bloom is a soft effect: blur its mip chain at half the scene resolution.
      bloom.setSize(Math.max(1, size.width >> 1), Math.max(1, size.height >> 1));
      holeMaterial.uniforms.uResolution.value.set(size.width, size.height);
      backgroundTarget.setSize(Math.max(1, Math.round(size.width * 0.75)), Math.max(1, Math.round(size.height * 0.75)));
      nearTarget.setSize(size.width, size.height);
      farTarget.setSize(Math.max(1, Math.round(size.width * farResolution)), Math.max(1, Math.round(size.height * farResolution)));
      particleScale = GALAXY_SCALE * size.height / height;
      farParticleScale = GALAXY_SCALE * farTarget.height / height;
      for (const object of [stars, gas, dust]) object.material.uniforms.uPixelRatio.value = farParticleScale;
      backgroundDirty = true;
      renderer.domElement.dataset.cosmicRenderSize = `${size.width}x${size.height}`;
      renderer.domElement.dataset.cosmicQuality = budget.quality.toFixed(2);
    }
    function resize() {
      const nextWidth = Math.max(container!.clientWidth, 1);
      const nextHeight = Math.max(container!.clientHeight, 1);
      if (width === nextWidth && height === nextHeight) return;
      width = nextWidth;
      height = nextHeight;
      resizeTargets();
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
    // ResizeObserver can fire repeatedly while the mobile address bar moves.
    const resizeObserver = new ResizeObserver(() => { resizePending = true; });
    resizeObserver.observe(container);
    resize();
    flight = new CameraFlight(responsiveView(destination));
    wasCompact = width < 768;
    // Compile in parallel where supported; do not block a first interaction
    // with synchronous program-status checks on the main thread.
    void renderer.compileAsync(scene, camera).then(() => {
      if (disposed) return;
      prepared = true;
      visibilityChanged();
    }).catch((error) => {
      if (disposed) return;
      console.warn('3D background preparation failed:', error);
      fallbackRef.current = true;
      completeRef.current?.(requestRef.current);
    });

    function render(now: number) {
      const moving = destinationRequest !== requestRef.current || !flight.isSettled(travelTime);
      const targetFps = reducedMotion ? 12 : moving ? 60 : device.idleFps;
      if (!pacer.due(now, targetFps)) return;
      if (resizePending) { resizePending = false; resize(); }
      const delta = Math.min((now - lastTime) / 1000, 0.25);
      lastTime = now;
      if (reducedMotion && notifiedRequest === requestRef.current && !backgroundDirty
        && (destination === 'home' || clouds.material.uniforms.uPhotoMix.value >= 1)) return;
      if (!reducedMotion) elapsed += delta;
      travelTime += delta;
      const compact = width < 768;
      if (destination !== tabRef.current || destinationRequest !== requestRef.current || wasCompact !== compact) {
        const desired = responsiveView(tabRef.current);
        const crossesScale = destination === 'home' || tabRef.current === 'home'
          || Math.abs(Math.log(desired.distance / flight.read(travelTime).distance)) > Math.log(4);
        destination = tabRef.current;
        destinationRequest = requestRef.current;
        wasCompact = compact;
        const before = flight.read(travelTime);
        const alreadyThere = Math.abs(Math.log(desired.distance / before.distance)) < 0.00001
          && Math.abs(desired.polar - before.polar) < 0.00001
          && Math.abs(Math.atan2(Math.sin(desired.azimuth - before.azimuth), Math.cos(desired.azimuth - before.azimuth))) < 0.00001
          && Math.abs(desired.panX - before.panX) < 0.00001 && Math.abs(desired.panY - before.panY) < 0.00001;
        flight.retarget(desired, travelTime, reducedMotion || alreadyThere ? 0 : crossesScale ? ZOOM_DURATION : ORBIT_DURATION);
      }
      if (reducedMotion) flight.retarget(responsiveView(destination), travelTime, 0);
      const current = flight.read(travelTime);
      const visibility = cosmicVisibility(current.distance);
      const { polar, azimuth, roll } = cosmicCameraOrientation(current);
      camera.position.setFromSphericalCoords(current.distance, polar, azimuth);
      camera.lookAt(origin);
      camera.rotateZ(roll);
      camera.setViewOffset(width, height, -width * current.panX, -height * current.panY, width, height);
      camera.updateMatrixWorld();
      galaxy.rotation.y = 0.37 + elapsed * GALAXY_ROTATION_RATE;
      // Sky and remote objects remain world-fixed, providing parallax landmarks.
      const detail = visibility.detail;
      bloom.strength = THREE.MathUtils.lerp(0.13, 0.26, visibility.disk);
      bloom.threshold = THREE.MathUtils.lerp(2.2, 1.35, visibility.disk);
      bloom.radius = THREE.MathUtils.lerp(0.18, 0.35, visibility.disk);
      stars.material.uniforms.uOpacity.value = visibility.cluster * 0.64;
      gas.material.uniforms.uOpacity.value = visibility.cluster * 1.0;
      dust.material.uniforms.uOpacity.value = visibility.disk * 0.48;
      clouds.material.uniforms.uOpacity.value = visibility.disk * 1.1;
      for (const object of [stars, gas, dust, clouds]) object.material.uniforms.uTime.value = elapsed * GALAXY_MATTER_RATE;
      nucleus.material.uniforms.uOpacity.value = visibility.nucleus * .72;
      nucleus.material.uniforms.uPixelRatio.value = nearTarget.height / height;
      nucleus.visible = visibility.nucleus > .001;
      // Static field: no orbit or twinkling drift in the far background.
      sky.material.uniforms.uTime.value = 0;
      detailBlend.uniforms.uDetail.value = detail;
      const rush = Math.min(Math.abs(flight.logDistanceSpeed(travelTime)) / 12, 1);
      detailBlend.uniforms.uBlur.value = reducedMotion ? 0 : rush * 0.012;
      detailBlend.uniforms.uFocus.value.set(0.5 + current.panX, 0.5 - current.panY);
      // Publish aggregate diagnostics twice a second, not eight DOM mutations
      // every frame. Sampling frame intervals includes GPU/compositor delays.
      diagnosticFrames++;
      diagnosticElapsed += delta * 1000;
      if (now - diagnosticAt >= 500) {
        const data = renderer.domElement.dataset;
        data.cosmicDistance = current.distance.toFixed(3);
        data.cosmicDetail = detail.toFixed(4);
        data.cosmicDestination = destination;
        data.cosmicZoomRatio = (current.distance / HOME_DISTANCE).toFixed(1);
        data.cosmicRush = rush.toFixed(3);
        data.cosmicSettled = String(flight.isSettled(travelTime));
        data.cosmicRequest = String(destinationRequest);
        data.cosmicPan = `${current.panX.toFixed(3)},${current.panY.toFixed(3)}`;
        data.cosmicAngle = `${polar.toFixed(3)},${azimuth.toFixed(3)}`;
        data.cosmicRoll = roll.toFixed(4);
        data.cosmicRotation = galaxy.rotation.y.toFixed(4);
        data.cosmicNucleus = visibility.nucleus.toFixed(3);
        data.cosmicTargetFps = String(targetFps);
        data.cosmicFrameMs = (diagnosticElapsed / diagnosticFrames).toFixed(1);
        data.cosmicFps = (diagnosticFrames * 1000 / diagnosticElapsed).toFixed(1);
        diagnosticAt = now;
        diagnosticFrames = diagnosticElapsed = 0;
      }
      holeMaterial.uniforms.uTime.value = elapsed;
      const matter = accretionMatterPhase(elapsed);
      holeMaterial.uniforms.uMatterAges.value.set(matter.olderAge, matter.youngerAge);
      holeMaterial.uniforms.uMatterSeeds.value.set(matter.olderSeed, matter.youngerSeed);
      holeMaterial.uniforms.uMatterMix.value = matter.mix;
      holeMaterial.uniforms.uCameraPosition.value.copy(camera.position);
      holeMaterial.uniforms.uViewProjection.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      blackHole.quaternion.copy(camera.quaternion);
      if (detail > 0.001) {
        galaxy.visible = false;
        blackHole.visible = false;
        sky.visible = backdrop.visible = true;
        // The remote sky is world-fixed. Reuse its texture when the camera is
        // settled; during a zoom/pan it is regenerated for correct parallax.
        if (backgroundDirty || !cachedBackgroundView.equals(holeMaterial.uniforms.uViewProjection.value)) {
          sky.material.uniforms.uPixelRatio.value = GALAXY_SCALE * backgroundTarget.height / height;
          renderer.setRenderTarget(backgroundTarget);
          renderer.render(scene, camera);
          cachedBackgroundView.copy(holeMaterial.uniforms.uViewProjection.value);
          backgroundDirty = false;
        }
        blackHole.visible = true;
        sky.visible = backdrop.visible = nucleus.visible = false;
        renderer.setRenderTarget(nearTarget);
        backgroundCopy.render(renderer);
        renderer.autoClear = false;
        renderer.render(scene, camera);
        renderer.autoClear = true;
      }
      if (detail < 0.999) {
        blackHole.visible = false;
        sky.visible = backdrop.visible = true;
        nucleus.visible = visibility.nucleus > .001;
        nucleus.material.uniforms.uPixelRatio.value = farTarget.height / height;
        sky.material.uniforms.uPixelRatio.value = farParticleScale;
        galaxy.visible = visibility.cluster > 0.0001 || visibility.disk > 0.0001;
        renderer.setRenderTarget(farTarget);
        renderer.render(scene, camera);
      }
      renderer.setRenderTarget(null);
      composer.render(delta);
      backgroundDirty = false;
      // Reveal content only after the destination's final frame is drawn.
      // Request IDs also handle quick A → B → A clicks between two frames.
      if (flight.isSettled(travelTime) && destinationRequest === requestRef.current && notifiedRequest !== destinationRequest) {
        notifiedRequest = destinationRequest;
        completeRef.current?.(destinationRequest);
      }
      // Normalize intervals to the chosen pacing: intentional 30/45 FPS must
      // not be mistaken for GPU overload and cause endless quality downshifts.
      if (!reducedMotion && budget.sample(delta * 1000 * targetFps / 60, flight.isSettled(travelTime))) resizeTargets();
    }

    function visibilityChanged() {
      lastTime = performance.now();
      pacer.reset();
      budget.reset();
      diagnosticFrames = diagnosticElapsed = 0;
      renderer.setAnimationLoop(document.hidden || !prepared || fallbackRef.current ? null : render);
    }
    function motionChanged(event: MediaQueryListEvent) {
      reducedMotion = event.matches;
      backgroundDirty = true;
      visibilityChanged();
    }
    document.addEventListener('visibilitychange', visibilityChanged);
    motionPreference.addEventListener('change', motionChanged);

    return () => {
      disposed = true;
      renderer.setAnimationLoop(null);
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', visibilityChanged);
      motionPreference.removeEventListener('change', motionChanged);
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      backgroundTarget.dispose();
      nearTarget.dispose();
      farTarget.dispose();
      backgroundCopyMaterial.dispose();
      backgroundCopy.dispose();
      detailBlend.dispose();
      bloom.dispose();
      output.dispose();
      composer.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={containerRef} className="cosmic-background" aria-hidden="true" />;
}
