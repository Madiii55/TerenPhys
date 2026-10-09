import { ACCRETION_DISK } from './accretionDisk.ts';

export const noiseGLSL = `
  float hash31(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }
  float noise3(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash31(i), hash31(i + vec3(1,0,0)), f.x),
                   mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x),
                   mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) {
    float value = 0.0, amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
      value += noise3(p) * amplitude;
      p = p * 2.03 + vec3(7.1, 11.7, 3.4);
      amplitude *= 0.5;
    }
    return value;
  }
`;

export const worldVertex = `
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPosition = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const galaxyWarpGLSL = `
  float galacticWarp(vec2 p, float time) {
    float r = length(p);
    float angle = atan(p.y, p.x);
    float outer = smoothstep(7.0, 46.0, r);
    return 0.22 * sin(angle * 3.0 + r * 0.19 + time * 0.24)
      + outer * (1.05 * sin(angle * 2.0 + time * 0.16)
      + 0.5 * sin(angle * 3.0 - r * 0.12) + r * 0.024 * sin(angle + 0.7));
  }
`;

const galaxyPhotoUvGLSL = `
  vec2 referenceUv(vec2 p, float aspect) {
    float referenceAngle = -0.435;
    mat2 orientation = mat2(cos(referenceAngle), sin(referenceAngle), -sin(referenceAngle), cos(referenceAngle));
    vec2 photoPosition = orientation * vec2(p.x, p.y * 0.543) * (0.58 / 42.0);
    return vec2(photoPosition.x / aspect, photoPosition.y) + vec2(0.495, 0.497);
  }
`;

export const galaxyVertex = `
  varying vec3 vLocalPosition;
  void main() {
    vLocalPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const starVertex = `
  attribute float aSize;
  attribute float aPhase;
  varying vec3 vColor;
  varying float vBrightness;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uOrbit;
  ${galaxyWarpGLSL}
  void main() {
    vec3 p = position;
    float radius = length(p.xz);
    float drift = uTime * uOrbit / (1.0 + radius * 0.065);
    p.xz = mat2(cos(drift), -sin(drift), sin(drift), cos(drift)) * p.xz;
    p.y += step(0.0001, uOrbit) * galacticWarp(p.xz, uTime);
    p.y += sin(uTime * 0.45 + aPhase) * uOrbit * 1.2;
    vColor = color;
    vBrightness = 0.88 + 0.12 * sin(uTime * 0.7 + aPhase);
    vec4 viewPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = clamp(aSize * uPixelRatio * 310.0 / max(1.0, -viewPosition.z), 1.0, 72.0);
  }
`;

export const starFragment = `
  varying vec3 vColor;
  varying float vBrightness;
  uniform float uOpacity;
  uniform float uSoft;
  void main() {
    vec2 p = (gl_PointCoord - 0.5) * 2.0;
    float r = length(p);
    if (r > 1.0) discard;
    float halo = exp(-r * r * mix(8.0, 4.0, uSoft));
    float core = exp(-r * r * 70.0) * (1.0 - uSoft);
    float crossLight = (exp(-abs(p.x) * 65.0) + exp(-abs(p.y) * 65.0))
      * pow(max(1.0 - r, 0.0), 3.0) * (1.0 - uSoft) * 0.12;
    gl_FragColor = vec4(vColor * (halo * 0.65 + core * 1.6 + crossLight), uOpacity * vBrightness);
  }
`;

export function galaxyFragment(steps: number) { return `
  varying vec3 vLocalPosition;
  uniform float uOpacity;
  uniform float uTime;
  uniform vec3 uLocalCamera;
  uniform sampler2D uDiskPhoto;
  uniform float uPhotoMix;
  uniform float uReferenceAspect;
  uniform float uPhotoGain;
  ${noiseGLSL}
  ${galaxyWarpGLSL}
  ${galaxyPhotoUvGLSL}
  void main() {
    vec3 ray = normalize(vLocalPosition - uLocalCamera);
    vec3 inverseRay = 1.0 / (ray + vec3(0.000001));
    vec3 first = (-vec3(60.0, 12.0, 60.0) - uLocalCamera) * inverseRay;
    vec3 last = (vec3(60.0, 12.0, 60.0) - uLocalCamera) * inverseRay;
    vec3 lo = min(first, last), hi = max(first, last);
    float begin = max(max(lo.x, lo.y), max(lo.z, 0.0));
    float end = min(min(hi.x, hi.y), hi.z);
    if (end <= begin) discard;
    float stepLength = (end - begin) / float(${steps});
    // Static per-pixel jitter breaks aligned sample bands without temporal
    // flicker. Stars are rendered separately, so volume samples use a softer
    // mip level instead of extruding each tiny photographed star into a tube.
    float jitter = hash31(vec3(gl_FragCoord.xy, 7.31));
    vec3 light = vec3(0.0);
    float transmission = 1.0;
    for (int i = 0; i < ${steps}; i++) {
      vec3 p = uLocalCamera + ray * (begin + (float(i) + jitter) * stepLength);
      float r = length(p.xz);
      float outskirts = 1.0 - smoothstep(38.0, 54.0, r);
      if (outskirts < 0.001) continue;
      // Reject empty volume before texture fetches, noise and colour work.
      float thickness = 0.6 + r * 0.016 + 1.7 * exp(-r * r / 80.0);
      float height = p.y - galacticWarp(p.xz, uTime);
      float vertical = exp(-height * height / (2.0 * thickness * thickness))
        * (1.0 - smoothstep(8.0, 11.5, abs(p.y)));
      if (vertical < 0.001) continue;
      // A bounded local twist keeps the reference's dust structures intact;
      // the entire 3D volume rotates continuously with its containing group.
      float twist = 0.16 * sin(uTime * 0.22) / (1.0 + r * 0.06);
      vec2 samplePosition = mat2(cos(twist), -sin(twist), sin(twist), cos(twist)) * p.xz;
      samplePosition += vec2(sin(p.y * 1.1 + p.z * 0.2), cos(p.y * 0.8 + p.x * 0.2)) * p.y * 0.45;
      vec2 photoUv = referenceUv(samplePosition, uReferenceAspect);
      vec2 border = smoothstep(vec2(0.0), vec2(0.045), photoUv)
        * smoothstep(vec2(0.0), vec2(0.045), 1.0 - photoUv);
      vec3 photo = max(texture2D(uDiskPhoto, photoUv, 4.0).rgb - vec3(0.0006, 0.0008, 0.0016), vec3(0.0));
      float turbulence = noise3(vec3(samplePosition * 0.6, p.y * 0.9 + uTime * 0.08));
      vec3 tint = mix(vec3(0.5, 0.35, 0.19), vec3(0.13, 0.19, 0.29), smoothstep(5.0, 30.0, r));
      vec3 fallback = tint * exp(-r / 17.0) * (0.4 + turbulence);
      fallback += vec3(1.6, 1.25, 0.75) * exp(-r * r / 7.0);
      vec3 source = mix(fallback, photo * uPhotoGain * border.x * border.y, uPhotoMix);
      float luminance = dot(source, vec3(0.2126, 0.7152, 0.0722));
      float density = (0.05 + sqrt(luminance) * 1.6) * vertical * outskirts
        * (0.35 + turbulence * 1.2);
      float absorption = 1.0 - exp(-density * stepLength * 0.42);
      // Integrate emitting material and self-absorption through actual depth.
      light += transmission * absorption * source * (0.7 + turbulence * 0.8);
      transmission *= 1.0 - absorption;
      if (transmission < 0.015) break;
    }
    // Fine dust detail belongs to the warped central density sheet, not to
    // vertical copies of individual photographed stars through every sample.
    // A small surface contribution preserves the reference's fine lanes while
    // the surrounding bulk and stellar bulge remain genuinely volumetric.
    if (abs(ray.y) > 0.015) {
      float middle = -uLocalCamera.y / ray.y;
      vec3 hit = uLocalCamera + ray * middle;
      for (int j = 0; j < 3; j++) {
        middle = (galacticWarp(hit.xz, uTime) - uLocalCamera.y) / ray.y;
        hit = uLocalCamera + ray * middle;
      }
      if (middle >= begin && middle <= end) {
        float r = length(hit.xz);
        float twist = 0.16 * sin(uTime * 0.22) / (1.0 + r * 0.06);
        vec2 samplePosition = mat2(cos(twist), -sin(twist), sin(twist), cos(twist)) * hit.xz;
        vec2 uv = referenceUv(samplePosition, uReferenceAspect);
        vec2 border = smoothstep(vec2(0.0), vec2(0.045), uv)
          * smoothstep(vec2(0.0), vec2(0.045), 1.0 - uv);
        vec3 fine = max(texture2D(uDiskPhoto, uv).rgb - vec3(0.0006, 0.0008, 0.0016), vec3(0.0));
        light = light * 0.8 + fine * uPhotoMix * uPhotoGain * 0.35 * border.x * border.y
          * (1.0 - smoothstep(38.0, 54.0, r));
      }
    }
    // The proxy box is never displayed: all density fades before its bounds.
    gl_FragColor = vec4(light, uOpacity);
  }
`; }

export const galaxyVolumeVertex = `
  attribute float aSize;
  attribute float aPhase;
  varying vec3 vColor;
  varying float vDensity;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uPhotoMix;
  uniform float uReferenceAspect;
  uniform sampler2D uDiskPhoto;
  uniform float uDust;
  ${galaxyWarpGLSL}
  ${galaxyPhotoUvGLSL}
  void main() {
    vec3 p = position;
    float r = length(p.xz);
    vec2 photoUv = referenceUv(p.xz, uReferenceAspect);
    vec3 photo = max(texture2D(uDiskPhoto, photoUv).rgb - vec3(0.0006, 0.0008, 0.0016), vec3(0.0));
    float brightness = dot(photo, vec3(0.2126, 0.7152, 0.0722));
    float drift = uTime * 0.12 / (1.0 + r * 0.065);
    p.xz = mat2(cos(drift), -sin(drift), sin(drift), cos(drift)) * p.xz;
    p.y += galacticWarp(p.xz, uTime) + sin(aPhase + uTime * 0.38) * 0.24;
    vec3 fallback = mix(vec3(0.2, 0.14, 0.07), vec3(0.06, 0.08, 0.12), smoothstep(5.0, 32.0, r));
    vColor = mix(fallback, photo, uPhotoMix) * (0.7 + 0.3 * sin(aPhase));
    vColor = mix(vColor, vec3(0.025, 0.013, 0.007), uDust);
    float glow = mix(0.35, smoothstep(0.002, 0.11, brightness), uPhotoMix);
    float dust = mix(0.3, 1.0 - smoothstep(0.003, 0.085, brightness), uPhotoMix);
    vDensity = mix(glow, dust, uDust) * (1.0 - smoothstep(35.0, 51.0, r));
    vec4 viewPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = clamp(aSize * uPixelRatio * 310.0 / max(1.0, -viewPosition.z), 1.0, 96.0);
  }
`;

export const galaxyVolumeFragment = `
  varying vec3 vColor;
  varying float vDensity;
  uniform float uOpacity;
  uniform float uDust;
  void main() {
    vec2 p = (gl_PointCoord - 0.5) * 2.0;
    float r2 = dot(p, p);
    if (r2 > 1.0) discard;
    float soft = exp(-r2 * 3.5) * (1.0 - smoothstep(0.6, 1.0, r2));
    gl_FragColor = vec4(vColor, soft * vDensity * uOpacity * mix(0.2, 0.28, uDust));
  }
`;

export const distantGalaxyFragment = `
  varying vec2 vUv;
  uniform float uOpacity;
  uniform float uSeed;
  ${noiseGLSL}
  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    p.y *= 2.5;
    float r = length(p);
    float cloud = fbm(vec3(p * 11.0, uSeed));
    float angle = atan(p.y, p.x) - log(1.0 + r * 8.0) * 2.7;
    float arms = 0.5 + 0.5 * cos(angle * 2.0 + cloud * 2.0);
    float tail = (1.0 - smoothstep(0.42, 0.96, r)) * exp(-r * 3.0);
    vec3 light = mix(vec3(0.21, 0.26, 0.37), vec3(0.62, 0.48, 0.3), exp(-r * 8.0));
    light *= (0.3 + arms * 0.7) * (0.4 + cloud) * tail;
    light += vec3(0.85, 0.7, 0.45) * exp(-r * r * 140.0);
    gl_FragColor = vec4(light, uOpacity * (1.0 - smoothstep(0.8, 0.98, length((vUv - 0.5) * 2.0))));
  }
`;

// Blend whole rendered layers without lensing the local galaxy through a quad.
export const detailBlendShader = {
  uniforms: {
    uNear: { value: null }, uFar: { value: null }, uDetail: { value: 1 },
    uBlur: { value: 0 }, uFocus: { value: null }, uResolution: { value: null },
  },
  vertexShader: `varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `varying vec2 vUv;
    uniform sampler2D uNear;
    uniform sampler2D uFar;
    uniform float uDetail;
    uniform float uBlur;
    uniform vec2 uFocus;
    uniform vec2 uResolution;
    vec4 layers(vec2 uv) {
      vec4 result = vec4(0.0);
      if (uDetail >= 0.999) result = texture2D(uNear, uv);
      else if (uDetail <= 0.001) result = texture2D(uFar, uv);
      else result = mix(texture2D(uFar, uv), texture2D(uNear, uv), uDetail);
      return result;
    }
    void main() {
      vec4 center = layers(vUv);
      if (uBlur < 0.0005) { gl_FragColor = center; return; }
      vec2 offset = (vUv - uFocus) * uBlur;
      // Keep adjacent taps no farther than one texel apart: small background
      // stars become continuous trails rather than a row of detached dots.
      offset *= min(1.0, 12.0 / max(length(offset * uResolution), 0.001));
      vec4 sum = center;
      float total = 1.0;
      for (int i = 1; i <= 12; i++) {
        float along = float(i) / 12.0;
        float weight = exp(-2.2 * along * along);
        sum += (layers(vUv + offset * along) + layers(vUv - offset * along)) * weight;
        total += 2.0 * weight;
      }
      gl_FragColor = sum / total;
    }`,
};

// Null-ray trajectories use a Schwarzschild-inspired central force. This is
// an artistic real-time approximation, not a precision astrophysical solver.
export function blackHoleFragment(steps: number) {
  return `
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    uniform vec3 uCameraPosition;
    uniform mat4 uViewProjection;
    uniform sampler2D uBackground;
    uniform vec2 uResolution;
    uniform float uTime;
    uniform mat3 uDiskFrame;
    uniform vec2 uMatterAges;
    uniform vec2 uMatterSeeds;
    uniform float uMatterMix;
    const float RS = ${ACCRETION_DISK.horizon.toFixed(4)};
    const float INNER = ${ACCRETION_DISK.inner.toFixed(4)};
    const float OUTER = ${ACCRETION_DISK.outer.toFixed(4)};
    const float EXTINCTION = ${ACCRETION_DISK.extinction.toFixed(4)};
    const float LARGE_CLUMP_DENSITY = ${ACCRETION_DISK.largeClumpDensity.toFixed(4)};
    const float OVERLAPPING_CLUMP_DENSITY = ${ACCRETION_DISK.overlappingClumpDensity.toFixed(4)};
    ${noiseGLSL}

    vec3 acceleration(vec3 p, float angularMomentumSq) {
      float r2 = max(dot(p, p), 0.05);
      return -1.5 * RS * angularMomentumSq * p / (r2 * r2 * sqrt(r2));
    }

    float orbitalRate(float radius) {
      return 0.65 + 1.65 * pow(INNER / max(radius, INNER), 1.4);
    }

    float diskHeight(vec2 p) {
      float r = length(p);
      float flow = atan(p.y, p.x) - uTime * 0.85;
      float outerWarp = smoothstep(INNER + 0.25, OUTER, r);
      return outerWarp * (0.045 * sin(flow * 2.0 + r * 0.6)
        + 0.025 * sin(flow * 3.0 - r * 1.1));
    }

    float outerEdge(float flow) {
      return OUTER - 0.55 + 0.38 * sin(flow * 2.0 + 0.6) + 0.24 * sin(flow * 5.0);
    }

    // Analytic ellipsoidal particle in each occupied spatial cell. Its entire
    // support stays inside the cell, so no particle is cut by a grid boundary.
    // Offset grids at several scales fill the disk with different 3D clumps.
    vec2 particleCloud(vec3 p, float salt) {
      vec3 cell = floor(p);
      float random = hash31(cell + vec3(salt, salt * 0.37, salt * 1.17));
      vec3 center = 0.5 + (fract(random * vec3(13.7, 31.3, 73.9)) - 0.5) * 0.5;
      vec3 radii = 0.13 + fract(random * vec3(27.1, 43.7, 8.9)) * 0.11;
      vec3 q = (fract(p) - center) / radii;
      float squared = dot(q, q);
      if (squared >= 1.0) return vec2(0.0);
      float density = pow(1.0 - squared, 1.1) * (0.6 + random * 0.9);
      vec3 normal = q / max(length(q), 0.001);
      float shading = 0.12 + 0.88 * pow(0.5 + 0.5 * dot(normal, normalize(vec3(-0.4, 0.8, 0.35))), 1.5);
      return vec2(density, shading);
    }

    vec3 matterField(vec3 p, float age, float seed) {
      float r = length(p.xz);
      float flow = atan(p.z, p.x) - age * orbitalRate(r);
      vec3 advected = vec3(cos(flow) * r, p.y, sin(flow) * r);
      advected += vec3(0.11 * sin(advected.y * 2.0 + flow * 3.0),
        0.07 * sin(flow * 4.0 + r), 0.09 * cos(advected.y * 2.0 - flow * 2.0));
      // Tilt the cellular lattice in three dimensions: particles must not line
      // up in horizontal rows, especially when the disk is viewed edge-on.
      // Flatten individual clumps along the disk normal without removing their
      // depth. The overall volume remains a thin layer, not a puffy torus.
      vec3 cellSpace = advected * vec3(1.0, 2.8, 1.0);
      cellSpace.xy = mat2(0.8660254, -0.5, 0.5, 0.8660254) * cellSpace.xy;
      cellSpace.yz = mat2(0.92, -0.3919184, 0.3919184, 0.92) * cellSpace.yz;
      vec3 offset = vec3(mod(seed, 127.0) * 3.7, 2.1, 5.4);
      vec3 largePosition = cellSpace * vec3(0.58, 0.85, 0.58) + offset;
      vec2 large = particleCloud(largePosition, 5.7);
      vec2 overlapping = particleCloud(largePosition + vec3(0.5, 0.45, 0.5), 17.3);
      vec2 small = particleCloud(cellSpace * 3.1 + offset * 0.71 + 7.3, 29.4);
      ${steps >= 192 ? 'vec2 micro = particleCloud(cellSpace * 8.3 + offset * 1.3 + 3.1, 71.9);' : 'vec2 micro = vec2(0.0);'}
      float wisps = 0.5 + 0.5 * sin(flow * 7.0 + r * 2.1 + advected.y * 8.0);
      float billow = pow(smoothstep(0.3, 0.72, noise3(cellSpace * 1.9 + offset * 0.3)), 2.0);
      // Large clouds are a faint density variation, not solid, brightly lit
      // lumps. Keep the fine particles and the absorbing continuous layer.
      float density = 0.29 + large.x * LARGE_CLUMP_DENSITY + overlapping.x * OVERLAPPING_CLUMP_DENSITY + small.x * 2.0
        + billow * 0.45 + micro.x * 0.12 + wisps * 0.03;
      float shading = (0.038 + large.x * LARGE_CLUMP_DENSITY * (0.18 + 0.15 * large.y)
        + overlapping.x * OVERLAPPING_CLUMP_DENSITY * (0.18 + 0.15 * overlapping.y)
        + small.x * small.y * 2.0 + billow * 0.14) / max(density, 0.001);
      return vec3(density, clamp(shading, 0.12, 1.0), micro.x * micro.x);
    }

    void sampleAccretion(vec3 p, vec3 direction, out float density, out vec3 source) {
      density = 0.0;
      source = vec3(0.0);
      // The disk's maximum half-height plus its bounded 0.07-unit warp.
      // Most ray steps cross empty space: avoid all trigonometry/noise there.
      if (abs(p.y) > ${(ACCRETION_DISK.outerThickness * 2.5 + 0.071).toFixed(4)}) return;
      float r = length(p.xz);
      if (r < INNER - 0.15 || r > OUTER + 0.1) return;
      float angle = atan(p.z, p.x);
      float edge = outerEdge(angle - uTime * orbitalRate(OUTER));
      float innerEdge = INNER + 0.04 * sin(angle * 3.0 - uTime * orbitalRate(INNER));
      float radial = smoothstep(innerEdge - 0.08, innerEdge + 0.25, r)
        * (1.0 - smoothstep(edge - 0.65, edge + 0.05, r));
      float thickness = mix(${ACCRETION_DISK.innerThickness.toFixed(4)}, ${ACCRETION_DISK.outerThickness.toFixed(4)}, smoothstep(INNER, OUTER, r));
      float height = p.y - diskHeight(p.xz);
      float vertical = exp(-height * height / (thickness * thickness))
        * (1.0 - smoothstep(thickness * 1.8, thickness * 2.5, abs(height)));
      if (radial * vertical < 0.002) return;
      vec3 cloudPosition = vec3(p.x, height, p.z);
      vec3 older = matterField(cloudPosition, uMatterAges.x, uMatterSeeds.x);
      vec3 younger = matterField(cloudPosition, uMatterAges.y, uMatterSeeds.y);
      vec3 matter = mix(older, younger, uMatterMix);
      density = matter.x * radial * vertical * pow(INNER / r, 0.35);
      float heat = pow(INNER / r, 0.75);
      vec3 color = mix(vec3(1.25, 0.12, 0.018), vec3(3.8, 1.35, 0.24), smoothstep(0.3, 0.75, heat));
      color = mix(color, vec3(6.0, 5.0, 3.7), smoothstep(0.75, 1.0, heat));
      vec3 orbitalDirection = normalize(vec3(-p.z, 0.0, p.x));
      float beta = 0.28 * sqrt(INNER / r);
      float doppler = pow(1.0 / (1.0 + beta * dot(orbitalDirection, normalize(direction))), 2.6);
      float redshift = sqrt(max(1.0 - RS / r, 0.0));
      // Differentially advected filaments sharpen the hot flow without adding
      // bulky clouds or a fake ring above the foreground volume.
      float flow = angle - uTime * orbitalRate(r);
      float turbulence = noise3(vec3(cos(flow) * r * 3.0, sin(flow) * r * 3.0, height * 12.0));
      float fine = noise3(vec3(cos(flow) * r * 10.0, sin(flow) * r * 10.0, height * 26.0));
      float filament = pow(0.5 + 0.5 * sin(r * 22.0 + flow * 3.0 + turbulence * 9.0), 4.0)
        * smoothstep(0.18, 0.72, fine);
      // Broken, sheared streams and cooler gaps avoid perfectly concentric
      // painted rings; the hottest inner flow approaches a white thermal glow.
      float emission = (0.24 + matter.y * 0.95) * (0.62 + turbulence * 0.56 + filament * 0.6 + fine * 0.12);
      source = color * pow(INNER / r, 1.05) * redshift * doppler * emission;
      source += vec3(2.6, 1.4, 0.55) * matter.z * heat * 0.55;
    }

    void main() {
      vec2 screenUv = gl_FragCoord.xy / uResolution;
      vec3 background = texture2D(uBackground, screenUv).rgb;
      vec3 ray = normalize(vWorldPosition - uCameraPosition);
      vec3 p = uCameraPosition;
      float b = dot(p, ray);
      float discriminant = b * b - dot(p, p) + 121.0;
      if (discriminant < 0.0) { gl_FragColor = vec4(background, 1.0); return; }
      p += ray * max(0.0, -b - sqrt(discriminant));
      float h2 = dot(cross(p, ray), cross(p, ray));
      vec3 velocity = ray;
      vec3 light = vec3(0.0);
      float transmission = 1.0;
      bool captured = false, opaque = false;
      for (int i = 0; i < ${steps}; i++) {
        float r = length(p);
        if (r < RS * 1.025) { captured = true; break; }
        if (r > 11.1 && dot(p, velocity) > 0.0) break;
        float dt = clamp(r * 0.085, 0.018, 0.75);
        vec3 local = uDiskFrame * p;
        float diskRadius = length(local.xz);
        float thickness = mix(${ACCRETION_DISK.innerThickness.toFixed(4)}, ${ACCRETION_DISK.outerThickness.toFixed(4)}, smoothstep(INNER, OUTER, diskRadius));
        if (diskRadius > INNER - 0.2 && diskRadius < OUTER + 0.2
            && abs(local.y) < ${(ACCRETION_DISK.outerThickness * 2.5 + 0.171).toFixed(4)}
            && abs(local.y - diskHeight(local.xz)) < thickness * 2.5 + 0.1) {
          dt = min(dt, ${steps >= 192 ? '0.13' : '0.18'});
        }
        vec3 halfVelocity = velocity + acceleration(p, h2) * dt * 0.5;
        vec3 next = p + halfVelocity * dt;
        velocity = halfVelocity + acceleration(next, h2) * dt * 0.5;
        float density;
        vec3 source;
        sampleAccretion(uDiskFrame * ((p + next) * 0.5), uDiskFrame * velocity, density, source);
        float absorption = 1.0 - exp(-density * EXTINCTION * dt);
        // Front-to-back volume compositing keeps foreground clumps visible
        // even if the ray subsequently enters the horizon. Nothing behind an
        // opaque clump can be painted over it afterwards.
        light += transmission * absorption * source;
        transmission *= 1.0 - absorption;
        if (transmission < ${ACCRETION_DISK.minimumTransmission.toFixed(4)}) { opaque = true; break; }
        p = next;
      }
      if (!captured && !opaque) {
        vec4 projected = uViewProjection * vec4(uCameraPosition + normalize(velocity) * 450.0, 1.0);
        vec2 bentUv = projected.xy / projected.w * 0.5 + 0.5;
        // The local galaxy is not an infinitely distant environment map.
        // Blend out that approximation as the camera reveals its full extent.
        float backgroundLensing = 1.0 - smoothstep(20.0, 45.0, length(uCameraPosition));
        bentUv = mix(screenUv, bentUv, backgroundLensing);
        if (projected.w > 0.0 && all(greaterThan(bentUv, vec2(0))) && all(lessThan(bentUv, vec2(1)))) {
          light += transmission * texture2D(uBackground, bentUv).rgb;
        } else { light += transmission * vec3(0.0008, 0.0014, 0.004); }
      }
      // Lensed arcs come only from integrated matter. No artificial circle is
      // added on top of the disk, so its inner boundary cannot shine through.
      float quadEdge = 1.0 - smoothstep(0.8, 0.99, max(abs(vUv.x - 0.5), abs(vUv.y - 0.5)) * 2.0);
      light = mix(background, light, quadEdge);
      gl_FragColor = vec4(light, 1.0);
    }
  `;
}
