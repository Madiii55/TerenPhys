export type CameraView = {
  distance: number;
  polar: number;
  azimuth: number;
  panX: number;
  panY: number;
};

const properties = ['distance', 'polar', 'azimuth', 'panX', 'panY'] as const;
type Coordinates = Record<(typeof properties)[number], number>;

export function smoothRange(value: number, low: number, high: number) {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function coordinates(view: CameraView): Coordinates {
  return { ...view, distance: Math.log(view.distance) };
}

/** A finite camera flight in logarithmic distance, with continuous velocity on retarget. */
export class CameraFlight {
  private start: Coordinates;
  private end: Coordinates;
  private velocity: Coordinates;
  private startedAt = 0;
  private duration = 0;
  private brakingDuration = 0;

  constructor(view: CameraView) {
    this.start = coordinates(view);
    this.end = { ...this.start };
    this.velocity = { distance: 0, polar: 0, azimuth: 0, panX: 0, panY: 0 };
  }

  private sample(now: number) {
    const age = Math.max(0, now - this.startedAt);
    const position = {} as Coordinates;
    const velocity = {} as Coordinates;

    // Short, bounded braking preserves velocity when a user interrupts the
    // flight. A full-flight tangent could overshoot by orders of magnitude
    // now that the logarithmic journey spans several scales.
    if (this.brakingDuration > 0 && age < this.brakingDuration) {
      const s = age / this.brakingDuration;
      const coast = s - s ** 3 + 0.5 * s ** 4;
      const slowing = 1 - 3 * s * s + 2 * s ** 3;
      for (const key of properties) {
        position[key] = this.start[key] + this.velocity[key] * this.brakingDuration * coast;
        velocity[key] = this.velocity[key] * slowing;
      }
      return { position, velocity };
    }

    const movingDuration = this.duration - this.brakingDuration;
    const t = movingDuration <= 0 ? 1 : Math.max(0, Math.min(1, (age - this.brakingDuration) / movingDuration));
    // Quintic easing keeps both velocity and acceleration continuous, including
    // the centre of the flight. Log distance spans the astronomical scales.
    const ease = t * t * t * (t * (t * 6 - 15) + 10);
    const easeDerivative = 30 * t * t * (1 - t) * (1 - t);
    for (const key of properties) {
      const brakedStart = this.start[key] + this.velocity[key] * this.brakingDuration * 0.5;
      const difference = this.end[key] - brakedStart;
      position[key] = brakedStart + difference * ease;
      velocity[key] = movingDuration <= 0 ? 0 : difference * easeDerivative / movingDuration;
    }
    return { position, velocity };
  }

  retarget(view: CameraView, now: number, duration: number) {
    const sample = this.sample(now);
    this.start = sample.position;
    this.velocity = duration === 0 ? { distance: 0, polar: 0, azimuth: 0, panX: 0, panY: 0 } : sample.velocity;
    this.end = coordinates(view);
    this.end.azimuth = this.start.azimuth + Math.atan2(Math.sin(view.azimuth - this.start.azimuth), Math.cos(view.azimuth - this.start.azimuth));
    this.startedAt = now;
    this.duration = duration;
    this.brakingDuration = duration > 0 && properties.some(key => Math.abs(this.velocity[key]) > 0.00001)
      ? Math.min(0.09, duration * 0.15) : 0;
  }

  read(now: number): CameraView {
    const { position } = this.sample(now);
    return { ...position, distance: Math.exp(position.distance) };
  }

  logDistanceSpeed(now: number) {
    return this.sample(now).velocity.distance;
  }

  isSettled(now: number) {
    return now >= this.startedAt + this.duration;
  }
}
