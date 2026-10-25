import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CameraFlight, smoothRange, type CameraView } from '../src/graphics/cameraFlight.ts';
import { cosmicVisibility, GALAXY_SCALE, GALAXY_SHAPE, HOME_DISTANCE, ORBIT_DURATION, ZOOM_DURATION } from '../src/graphics/cosmicScale.ts';
import { CAMERA_ROLL_END_DISTANCE, CAMERA_ROLL_START_DISTANCE, cosmicCameraOrientation } from '../src/graphics/orientation.ts';

const home: CameraView = { distance: HOME_DISTANCE, polar: 1.42, azimuth: 0.16, panX: 0.205, panY: 0.015 };
const galaxy: CameraView = { distance: 89 * GALAXY_SCALE, polar: 0.94, azimuth: -1.65, panX: 0, panY: 0 };
const keys = ['distance', 'polar', 'azimuth', 'panX', 'panY'] as const;
const near = (a: number, b: number, tolerance = 1e-8) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);

test('zoom is monotonic, finite and finishes exactly in both directions', () => {
  for (const [from, to] of [[home, galaxy], [galaxy, home]]) {
    const flight = new CameraFlight(from);
    flight.retarget(to, 0, ZOOM_DURATION);
    let previous = from.distance;
    for (let time = 0; time <= ZOOM_DURATION; time += 0.004) {
      const current = flight.read(time);
      keys.forEach(key => assert.ok(Number.isFinite(current[key])));
      assert.ok((current.distance - previous) * Math.sign(to.distance - from.distance) >= -1e-8);
      previous = current.distance;
    }
    keys.forEach(key => near(flight.read(ZOOM_DURATION)[key], to[key]));
  }
});

test('only the middle of the logarithmic zoom is fast, endpoints are at rest', () => {
  const flight = new CameraFlight(home);
  flight.retarget(galaxy, 0, ZOOM_DURATION);
  const speed = (time: number) => flight.logDistanceSpeed(time);
  assert.ok(speed(ZOOM_DURATION / 2) > speed(ZOOM_DURATION * 0.1) * 6);
  assert.ok(speed(ZOOM_DURATION / 2) > speed(ZOOM_DURATION * 0.9) * 6);
  near(speed(0), 0);
  near(speed(ZOOM_DURATION), 0);
});

test('interrupting and reversing a flight preserves position and velocity', () => {
  for (const time of [0.12, 0.45, 0.8, 1.3]) {
    const flight = new CameraFlight(home);
    flight.retarget(galaxy, 0, ZOOM_DURATION);
    const epsilon = 0.000001;
    const before = flight.read(time - epsilon);
    const at = flight.read(time);
    flight.retarget(home, time, ZOOM_DURATION);
    const after = flight.read(time + epsilon);
    keys.forEach(key => {
      near(flight.read(time)[key], at[key]);
      const value = (view: CameraView) => key === 'distance' ? Math.log(view.distance) : view[key];
      const velocityBefore = (value(at) - value(before)) / epsilon;
      const velocityAfter = (value(after) - value(at)) / epsilon;
      near(velocityBefore, velocityAfter, 0.003);
    });
    near(flight.read(time + ZOOM_DURATION).distance, home.distance);
  }
});

test('orbital motion takes the shortest route across the angle seam', () => {
  const flight = new CameraFlight({ ...galaxy, azimuth: 3.08 });
  flight.retarget({ ...galaxy, azimuth: -3.08 }, 0, ORBIT_DURATION);
  near(flight.read(ORBIT_DURATION / 2).azimuth, Math.PI);
});

test('reduced motion switches instantly and repeated retargeting remains finite', () => {
  const flight = new CameraFlight(home);
  for (let time = 0; time < 6; time += 0.06) {
    flight.retarget(Math.floor(time / 0.06) % 2 ? home : galaxy, time, ZOOM_DURATION);
    const current = flight.read(time + 0.06);
    keys.forEach(key => assert.ok(Number.isFinite(current[key])));
    assert.ok(current.distance > HOME_DISTANCE * 0.7 && current.distance < galaxy.distance * 3);
  }
  flight.retarget(home, 7, 0);
  keys.forEach(key => near(flight.read(7)[key], home[key]));
});

test('the elongated galaxy stays much larger than the unchanged near-hole scale', () => {
  assert.ok(GALAXY_SHAPE.x / GALAXY_SHAPE.z > 1.35);
  assert.equal(GALAXY_SHAPE.y, 1);
  assert.ok(galaxy.distance / home.distance > 25000);
  assert.ok(13.6 / (120 * GALAXY_SCALE) < 0.0001);
});

test('the flight spans the full galaxy scale within the quicker bounded duration', () => {
  const flight = new CameraFlight(home);
  flight.retarget(galaxy, 0, ZOOM_DURATION);
  const ratio = flight.read(ZOOM_DURATION * 0.75).distance / flight.read(ZOOM_DURATION * 0.25).distance;
  assert.ok(ratio > 3000);
  assert.ok(ZOOM_DURATION >= 1.5 && ZOOM_DURATION <= 1.7);
  assert.ok(ORBIT_DURATION >= 1 && ORBIT_DURATION <= 1.3);
});

test('the detail handover overlaps a visible nuclear cluster in both directions', () => {
  for (const [from, to] of [[home, galaxy], [galaxy, home]]) {
    const flight = new CameraFlight(from);
    flight.retarget(to, 0, ZOOM_DURATION);
    const samples: number[] = [];
    for (let time = 0; time <= ZOOM_DURATION; time += 0.001) {
      const current = flight.read(time);
      const visibility = cosmicVisibility(current.distance);
      if (visibility.detail > 0.001 && visibility.detail < 0.999) {
        samples.push(time);
        near(visibility.disk, 0);
        near(visibility.cluster, 0);
        assert.ok(visibility.nucleus > .9);
        // Keep the same eased trajectory while its overall duration is shorter.
        assert.ok(Math.abs(flight.logDistanceSpeed(time)) * ZOOM_DURATION < 21.45);
      }
    }
    assert.ok(samples.length > 0);
    // The handover still spans at least eight frames at 60 FPS.
    assert.ok(samples.at(-1)! - samples[0] > 8 / 60);
    assert.ok(samples.at(-1)! - samples[0] < 0.6);
  }
  near(cosmicVisibility(home.distance).detail, 1);
  near(cosmicVisibility(galaxy.distance).detail, 0);
  near(cosmicVisibility(galaxy.distance).disk, 1);
  near(cosmicVisibility(galaxy.distance).cluster, 1);
});

test('an interrupted deep zoom brakes smoothly without huge scale overshoots', () => {
  for (const [from, to] of [[home, galaxy], [galaxy, home]]) {
    const flight = new CameraFlight(from);
    flight.retarget(to, 0, ZOOM_DURATION);
    const changedAt = ZOOM_DURATION / 2;
    flight.retarget(from, changedAt, ZOOM_DURATION);
    for (let time = changedAt; time <= changedAt + ZOOM_DURATION; time += 0.001) {
      const current = flight.read(time);
      assert.ok(current.distance > HOME_DISTANCE * 0.7 && current.distance < galaxy.distance * 3);
    }
    const join = changedAt + 0.09;
    near(flight.logDistanceSpeed(join - 0.000001), 0, 0.00001);
    near(flight.logDistanceSpeed(join + 0.000001), 0, 0.00001);
    near(flight.read(changedAt + ZOOM_DURATION).distance, from.distance);
  }
});

test('detail crossfade is bounded and has smooth endpoints', () => {
  near(smoothRange(23, 24, 49), 0);
  near(smoothRange(50, 24, 49), 1);
  let previous = 0;
  for (let d = 24; d <= 49; d += 0.01) {
    const opacity = smoothRange(d, 24, 49);
    assert.ok(opacity >= previous && opacity >= 0 && opacity <= 1);
    previous = opacity;
  }
});

test('quintic zoom has one symmetric velocity peak and continuous acceleration', () => {
  for (const [from, to] of [[home, galaxy], [galaxy, home]]) {
    const flight = new CameraFlight(from);
    flight.retarget(to, 0, ZOOM_DURATION);
    let previous = 0;
    for (let fraction = 0; fraction <= 0.5; fraction += 0.002) {
      const speed = Math.abs(flight.logDistanceSpeed(fraction * ZOOM_DURATION));
      assert.ok(speed >= previous - 1e-9);
      near(speed, Math.abs(flight.logDistanceSpeed((1 - fraction) * ZOOM_DURATION)));
      previous = speed;
    }
    const range = Math.log(to.distance) - Math.log(from.distance);
    near(flight.logDistanceSpeed(ZOOM_DURATION / 2), range * 1.875 / ZOOM_DURATION);
    near((Math.log(flight.read(ZOOM_DURATION / 4).distance) - Math.log(from.distance)) / range, 0.103515625);
    near((Math.log(flight.read(ZOOM_DURATION * 3 / 4).distance) - Math.log(from.distance)) / range, 0.896484375);
    const epsilon = 0.00001;
    for (const time of [0, ZOOM_DURATION / 2, ZOOM_DURATION]) {
      const left = (flight.logDistanceSpeed(time) - flight.logDistanceSpeed(time - epsilon)) / epsilon;
      const right = (flight.logDistanceSpeed(time + epsilon) - flight.logDistanceSpeed(time)) / epsilon;
      near(left, right, .002);
    }
  }
});

test('camera completion is available only after the actual flight ends', () => {
  const flight = new CameraFlight(home);
  assert.ok(flight.isSettled(0));
  flight.retarget(galaxy, 0.4, ZOOM_DURATION);
  assert.equal(flight.isSettled(0.4), false);
  assert.equal(flight.isSettled(0.4 + ZOOM_DURATION - 0.000001), false);
  assert.ok(flight.isSettled(0.4 + ZOOM_DURATION));
  flight.retarget(home, 3, 0);
  assert.ok(flight.isSettled(3));
});

test('an interrupted flight cannot report completion at the old arrival time', () => {
  const flight = new CameraFlight(home);
  flight.retarget(galaxy, 0, ZOOM_DURATION);
  flight.retarget(home, 0.9, ZOOM_DURATION);
  assert.equal(flight.isSettled(ZOOM_DURATION), false);
  assert.ok(flight.isSettled(0.9 + ZOOM_DURATION));
});

test('rendered orientation preserves endpoint views without the abrupt near-hole roll', () => {
  near(cosmicCameraOrientation(home).roll, -0.24);
  near(cosmicCameraOrientation({ ...home, distance: home.distance * 1.3 }).roll, -0.24);
  near(cosmicCameraOrientation(galaxy).roll, 0.34);
  for (const [from, to] of [[home, galaxy], [galaxy, home]]) {
    const flight = new CameraFlight(from);
    flight.retarget(to, 0, ZOOM_DURATION);
    let previous = cosmicCameraOrientation(from);
    for (let time = 1 / 60; time <= ZOOM_DURATION; time += 1 / 60) {
      const view = flight.read(time);
      const actual = cosmicCameraOrientation(view);
      near(actual.polar, view.polar);
      near(actual.azimuth, view.azimuth);
      assert.ok(actual.roll >= -0.24 && actual.roll <= 0.340000001);
      assert.ok(Math.abs(actual.polar - previous.polar) < .01);
      assert.ok(Math.abs(actual.azimuth - previous.azimuth) < .035);
      assert.ok(Math.abs(actual.roll - previous.roll) < .028);
      if (view.distance < 90) {
        // While full BH detail is visible, roll cannot snap across the old
        // 32–72 handover: at 60 FPS its step stays below one fifth of a degree.
        assert.ok(Math.abs(actual.roll - previous.roll) < .0035);
      }
      previous = actual;
    }
  }
});

test('rendered orientation preserves velocity through retargets and azimuth seams', () => {
  const orientationKeys = ['polar', 'azimuth', 'roll'] as const;
  const epsilon = .000001;
  for (const fromAzimuth of [home.azimuth, Math.PI + home.azimuth - .1]) {
    const from = { ...home, azimuth: fromAzimuth };
    const flight = new CameraFlight(from);
    flight.retarget({ ...galaxy, azimuth: fromAzimuth + .3 }, 0, ZOOM_DURATION);
    // At this time the orbital branch crosses home+PI. A distance-dependent
    // blend of a wrapped home angle would jump; the actual camera must not.
    const changedAt = ZOOM_DURATION * .45;
    let incoming = cosmicCameraOrientation(from);
    for (let time = 1 / 60; time < changedAt; time += 1 / 60) {
      const actual = cosmicCameraOrientation(flight.read(time));
      assert.ok(Math.abs(actual.azimuth - incoming.azimuth) < .006);
      incoming = actual;
    }
    const before = cosmicCameraOrientation(flight.read(changedAt - epsilon));
    const at = cosmicCameraOrientation(flight.read(changedAt));
    flight.retarget(home, changedAt, ZOOM_DURATION);
    const after = cosmicCameraOrientation(flight.read(changedAt + epsilon));
    orientationKeys.forEach(key => {
      near(cosmicCameraOrientation(flight.read(changedAt))[key], at[key]);
      const velocityBefore = (at[key] - before[key]) / epsilon;
      const velocityAfter = (after[key] - at[key]) / epsilon;
      near(velocityBefore, velocityAfter, .003);
    });
    let previous = after;
    for (let time = changedAt + 1 / 60; time <= changedAt + ZOOM_DURATION; time += 1 / 60) {
      const actual = cosmicCameraOrientation(flight.read(time));
      orientationKeys.forEach(key => {
        assert.ok(Number.isFinite(actual[key]));
        assert.ok(Math.abs(actual[key] - previous[key]) < .08, `${key} snapped at ${time}`);
      });
      previous = actual;
    }
  }
});

test('roll is continuous with zero velocity at both scale boundaries', () => {
  const roll = (distance: number) => cosmicCameraOrientation({ ...home, distance }).roll;
  const epsilon = .000001;
  for (const boundary of [CAMERA_ROLL_START_DISTANCE, CAMERA_ROLL_END_DISTANCE]) {
    const at = roll(boundary);
    near((at - roll(boundary * Math.exp(-epsilon))) / epsilon, 0, .000001);
    near((roll(boundary * Math.exp(epsilon)) - at) / epsilon, 0, .000001);
  }
});
