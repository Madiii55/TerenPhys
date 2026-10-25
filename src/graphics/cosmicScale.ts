import { smoothRange } from './cameraFlight.ts';

// Artistic scale separation, not a literal conversion to astronomical units.
// Scaling both the galaxy and its far camera distance preserves the wide view.
export const GALAXY_SCALE = 4096;
export const ZOOM_DURATION = 1.65;
export const ORBIT_DURATION = 1.15;
export const GALAXY_ROTATION_RATE = 0.008;
export const GALAXY_MATTER_RATE = 0.18;
export const HOME_DISTANCE = 10.9;
export const FAR_CLIP = GALAXY_SCALE * 720;
export const GALAXY_SHAPE = { x: 1.18, y: 1, z: 0.87 } as const;

export function cosmicVisibility(distance: number) {
  const localDistance = distance / GALAXY_SCALE;
  return {
    // A local star cluster bridges the hole and the large-scale stellar bulge.
    detail: 1 - smoothRange(Math.log(distance), Math.log(90), Math.log(700)),
    nucleus: smoothRange(distance, 22, 100) * (1 - smoothRange(distance, 6000, 26000)),
    disk: smoothRange(localDistance, 2, 30),
    cluster: smoothRange(localDistance, 0.5, 10),
  };
}
