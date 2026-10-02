import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createGalaxyClouds, createGalaxyVolume, createStarField, createStaticBackdrop } from '../graphics/createCosmicObjects.ts';
import { blackHoleFragment, detailBlendShader, worldVertex } from '../graphics/cosmicShaders.ts';
import { CameraFlight, smoothRange, type CameraView } from '../graphics/cameraFlight.ts';
import { cosmicVisibility, FAR_CLIP, GALAXY_SCALE, GALAXY_SHAPE, HOME_DISTANCE, ORBIT_DURATION, ZOOM_DURATION } from '../graphics/cosmicScale.ts';
import { ACCRETION_DISK, accretionMatterPhase } from '../graphics/accretionDisk.ts';
import type { NavTab } from './Navbar.tsx';

const VIEWS: Record<NavTab, CameraView> = {
  home: { distance: HOME_DISTANCE, polar: 1.42, azimuth: 0.16, panX: 0.205, panY: 0.015 },
  study: { distance: 87 * GALAXY_SCALE, polar: 0.82, azimuth: -0.7, panX: 0.05, panY: 0.03 },
  posts: { distance: 86 * GALAXY_SCALE, polar: 1.02, azimuth: 0.65, panX: 0.08, panY: 0.02 },
  profile: { distance: 85 * GALAXY_SCALE, polar: 1.08, azimuth: 1.8, panX: 0.02, panY: 0.04 },
  forum: { distance: 89 * GALAXY_SCALE, polar: 0.94, azimuth: -1.65, panX: 0, panY: 0 },
};

interface CosmicBackgroundProps {
  activeTab: NavTab;
  transitionId: number;
  onTransitionComplete: (id: number) => void;
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
    if (fallbackRef.current) completeRef.current(transitionId);
  }, [transitionId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const mobile = window.innerWidth < 768;
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reducedMotion = motionPreference.matches;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
    } catch (error) {
      console.warn('3D background unavailable:', error);
      fallbackRef.current = true;
      completeRef.current(requestRef.current);
      return;
    }
    // Ray tracing is bounded to the central object; cap resolution on high-DPI screens.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1 : 1.25));
    renderer.setClearColor('#02040c');
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.setAttribute('aria-hidden', 'true');
    renderer.domElement.dataset.accretionModel = 'volumetric-clumps';
    renderer.domElement.dataset.accretionSteps = String(mobile ? 144 : 192);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, FAR_CLIP);
    const galaxy = new THREE.Group();
    // Compensate point sizes for both world scale and render-target resolution.
    const particleScale = renderer.getPixelRatio() * GALAXY_SCALE;
    const farResolution = mobile ? 0.85 : 0.8;
    const farParticleScale = particleScale * farResolution;
    const stars = createStarField(mobile ? 30000 : 90000, 'stars', farParticleScale);
    const sky = createStarField(mobile ? 1300 : 3200, 'sky', particleScale);
    const clouds = createGalaxyClouds(mobile);
    const gas = createGalaxyVolume(mobile ? 18000 : 65000, false, farParticleScale, clouds);
    const dust = createGalaxyVolume(mobile ? 1200 : 4200, true, farParticleScale, clouds);
    const backdrop = createStaticBackdrop();
    galaxy.add(clouds, gas, stars, dust);
    galaxy.scale.set(GALAXY_SCALE * GALAXY_SHAPE.x, GALAXY_SCALE * GALAXY_SHAPE.y, GALAXY_SCALE * GALAXY_SHAPE.z);
    sky.scale.setScalar(GALAXY_SCALE);
    backdrop.scale.setScalar(GALAXY_SCALE);
    scene.add(galaxy, sky, backdrop);

    // The near ray tracer sees only the distant environment, never the local
    // galaxy volume. Crossfade complete near/far layers, avoiding false lensing
    // of the nucleus and opaque billboard edges during the detail handover.
    const backgroundTarget = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType, depthBuffer: false,
    });
    const nearTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    const farTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    const holeMaterial = new THREE.ShaderMaterial({
      vertexShader: worldVertex, fragmentShader: blackHoleFragment(mobile ? 144 : 192),
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
        view.panX = 0;
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
    let lastFrame = 0;
    let travelTime = 0;

    function resize() {
      width = Math.max(container!.clientWidth, 1);
      height = Math.max(container!.clientHeight, 1);
      renderer.setSize(width, height);
      composer.setSize(width, height);
      const drawingSize = renderer.getDrawingBufferSize(holeMaterial.uniforms.uResolution.value);
      backgroundTarget.setSize(Math.round(drawingSize.x * 0.75), Math.round(drawingSize.y * 0.75));
      nearTarget.setSize(drawingSize.x, drawingSize.y);
      farTarget.setSize(Math.round(drawingSize.x * farResolution), Math.round(drawingSize.y * farResolution));
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();
    flight = new CameraFlight(responsiveView(destination));
    wasCompact = width < 768;
    // Prepare the same materials before the first zoom rather than compiling
    // the galaxy programs during its very short detail handover.
    renderer.compile(scene, camera);

    function render(now: number) {
      const frameInterval = reducedMotion ? 1000 / 12 : 1000 / 30;
      if (now - lastFrame < frameInterval) return;
      // Carry fractional frame time instead of losing it: on a 60 Hz display
      // rounding otherwise turns the nominal 30 FPS limit into repeated 20 FPS.
      lastFrame = now - (now - lastFrame) % frameInterval;
      const delta = Math.min((now - lastTime) / 1000, 0.25);
      lastTime = now;
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
      // Keep the established near-hole angle while its detail is still visible.
      // Most of the orbital turn happens only after the camera leaves the nucleus.
      const orbitReveal = compact ? smoothRange(current.distance, 32, 104) : visibility.orbit;
      const polar = THREE.MathUtils.lerp(VIEWS.home.polar, current.polar, orbitReveal);
      const homeAzimuth = current.azimuth + Math.atan2(Math.sin(VIEWS.home.azimuth - current.azimuth), Math.cos(VIEWS.home.azimuth - current.azimuth));
      const azimuth = THREE.MathUtils.lerp(homeAzimuth, current.azimuth, orbitReveal);
      camera.position.setFromSphericalCoords(current.distance, polar, azimuth);
      camera.lookAt(origin);
      camera.rotateZ(0.34 * orbitReveal);
      camera.setViewOffset(width, height, -width * current.panX, -height * current.panY, width, height);
      camera.updateMatrixWorld();
      galaxy.rotation.y = 0.37 + elapsed * 0.075;
      // Sky and remote objects remain world-fixed, providing parallax landmarks.
      const detail = visibility.detail;
      bloom.strength = 0.16 + visibility.disk * 0.1;
      bloom.threshold = 2.0 - visibility.disk * 0.65;
      stars.material.uniforms.uOpacity.value = visibility.cluster * 0.64;
      gas.material.uniforms.uOpacity.value = visibility.cluster * 1.0;
      dust.material.uniforms.uOpacity.value = visibility.disk * 0.48;
      clouds.material.uniforms.uOpacity.value = visibility.disk * 1.1;
      for (const object of [stars, gas, dust, clouds]) object.material.uniforms.uTime.value = elapsed;
      // Static field: no orbit or twinkling drift in the far background.
      sky.material.uniforms.uTime.value = 0;
      detailBlend.uniforms.uDetail.value = detail;
      const rush = Math.min(Math.abs(flight.logDistanceSpeed(travelTime)) / 20, 1);
      detailBlend.uniforms.uBlur.value = reducedMotion ? 0 : rush * 0.042;
      detailBlend.uniforms.uFocus.value.set(0.5 + current.panX, 0.5 - current.panY);
      renderer.domElement.dataset.cosmicDistance = current.distance.toFixed(3);
      renderer.domElement.dataset.cosmicDetail = detail.toFixed(4);
      renderer.domElement.dataset.cosmicDestination = destination;
      renderer.domElement.dataset.cosmicZoomRatio = (current.distance / HOME_DISTANCE).toFixed(1);
      renderer.domElement.dataset.cosmicRush = rush.toFixed(3);
      renderer.domElement.dataset.cosmicSettled = String(flight.isSettled(travelTime));
      renderer.domElement.dataset.cosmicRequest = String(destinationRequest);
      renderer.domElement.dataset.cosmicFrameMs = (delta * 1000).toFixed(1);
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
        sky.material.uniforms.uPixelRatio.value = particleScale * 0.75;
        renderer.setRenderTarget(backgroundTarget);
        renderer.render(scene, camera);
        blackHole.visible = true;
        sky.material.uniforms.uPixelRatio.value = particleScale;
        renderer.setRenderTarget(nearTarget);
        renderer.render(scene, camera);
      }
      if (detail < 0.999) {
        blackHole.visible = false;
        sky.material.uniforms.uPixelRatio.value = farParticleScale;
        galaxy.visible = visibility.cluster > 0.0001 || visibility.disk > 0.0001;
        renderer.setRenderTarget(farTarget);
        renderer.render(scene, camera);
      }
      renderer.setRenderTarget(null);
      composer.render(delta);
      // Reveal content only after the destination's final frame is drawn.
      // Request IDs also handle quick A → B → A clicks between two frames.
      if (flight.isSettled(travelTime) && destinationRequest === requestRef.current && notifiedRequest !== destinationRequest) {
        notifiedRequest = destinationRequest;
        completeRef.current(destinationRequest);
      }
    }

    function visibilityChanged() {
      lastTime = performance.now();
      renderer.setAnimationLoop(document.hidden ? null : render);
    }
    function motionChanged(event: MediaQueryListEvent) { reducedMotion = event.matches; }
    document.addEventListener('visibilitychange', visibilityChanged);
    motionPreference.addEventListener('change', motionChanged);
    renderer.setAnimationLoop(render);

    return () => {
      renderer.setAnimationLoop(null);
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', visibilityChanged);
      motionPreference.removeEventListener('change', motionChanged);
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
