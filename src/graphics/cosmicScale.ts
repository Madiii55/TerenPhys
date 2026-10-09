import { smoothRange } from './cameraFlight.ts';

// Artistic scale separation, not a literal conversion to astronomical units.
// Scaling both the galaxy and its far camera distance preserves the wide view.
export const GALAXY_SCALE = 4096;
export const ZOOM_DURATION = 1.6;
export const ORBIT_DURATION = 1.4;
export const HOME_DISTANCE = 10.9;
export const FAR_CLIP = GALAXY_SCALE * 720;
export const GALAXY_SHAPE = { x: 1.18, y: 1, z: 0.87 } as const;

export function cosmicVisibility(distance: number) {
  const localDistance = distance / GALAXY_SCALE;
  return {
    // Handover occurs deep inside the stellar nucleus, while the hole is tiny.
    detail: 1 - smoothRange(Math.log(distance), Math.log(900), Math.log(3600)),
    disk: smoothRange(localDistance, 10, 36),
    cluster: smoothRange(localDistance, 2.2, 22),
    orbit: smoothRange(distance, 32, 72),
  };
}
