/** Artistic, browser-scale accretion parameters; not an astrophysical solver. */
export const ACCRETION_DISK = {
  horizon: 0.58,
  inner: 1.82,
  outer: 5.4,
  innerThickness: 0.08,
  outerThickness: 0.2,
  extinction: 10.5,
  minimumTransmission: 0.002,
  largeClumpDensity: 0.45,
  overlappingClumpDensity: 0.35,
  clumpLifetime: 2.6,
  tiltX: 2 * Math.PI / 180,
  tiltZ: -8 * Math.PI / 180,
} as const;

export function accretionOrbitalRate(radius: number) {
  return 0.65 + 1.65 * (ACCRETION_DISK.inner / Math.max(radius, ACCRETION_DISK.inner)) ** 1.4;
}

/** Overlapping populations keep motion continuous at each renewal boundary. */
export function accretionMatterPhase(time: number) {
  const cycle = Math.max(0, time) / ACCRETION_DISK.clumpLifetime;
  const seed = Math.floor(cycle);
  const fraction = cycle - seed;
  return {
    olderAge: (fraction + 1) * ACCRETION_DISK.clumpLifetime,
    youngerAge: fraction * ACCRETION_DISK.clumpLifetime,
    olderSeed: seed - 1,
    youngerSeed: seed,
    mix: fraction * fraction * (3 - 2 * fraction),
  };
}

/** Beer–Lambert attenuation, also used by the volume shader's compositing. */
export function accretionTransmission(density: number, distance: number) {
  return Math.exp(-Math.max(0, density) * Math.max(0, distance) * ACCRETION_DISK.extinction);
}
