/** Artistic, browser-scale accretion parameters; not an astrophysical solver. */
export const ACCRETION_DISK = {
  horizon: 0.64,
  inner: 1.92,
  outer: 6.05,
  innerThickness: 0.065,
  outerThickness: 0.16,
  extinction: 8.2,
  minimumTransmission: 0.002,
  largeClumpDensity: 0.45,
  overlappingClumpDensity: 0.35,
  clumpLifetime: 5.5,
  innerOrbitalRate: 1.05,
  // Put the approaching, brighter edge beside the home-page text.
  spinDirection: -1,
  tiltX: 2 * Math.PI / 180,
  tiltZ: -8 * Math.PI / 180,
} as const;

export const ACCRETION_STEPS = { mobile: 192, desktop: 256 } as const;

/** Keplerian shear, with time scaled for a readable real-time visualization. */
export function accretionOrbitalRate(radius: number) {
  return ACCRETION_DISK.innerOrbitalRate * (ACCRETION_DISK.inner / Math.max(radius, ACCRETION_DISK.inner)) ** 1.5;
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
