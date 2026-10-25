import { smoothRange, type CameraView } from './cameraFlight.ts';
import { GALAXY_SCALE } from './cosmicScale.ts';

export const CAMERA_ROLL_START_DISTANCE = 64;
export const CAMERA_ROLL_END_DISTANCE = 60 * GALAXY_SCALE;

/**
 * CameraFlight already eases the angular coordinates over the whole flight.
 * Re-easing them over the short 32–72 distance interval made the near hole
 * turn abruptly, and wrapping a second home angle could jump by a full turn.
 * Keep its continuous angular branch; only roll needs its own scale handover.
 */
export function cosmicCameraOrientation(view: CameraView) {
  const rollProgress = smoothRange(
    Math.log(view.distance), Math.log(CAMERA_ROLL_START_DISTANCE), Math.log(CAMERA_ROLL_END_DISTANCE),
  );
  return {
    polar: view.polar,
    azimuth: view.azimuth,
    roll: -0.24 + 0.58 * rollProgress,
  };
}
