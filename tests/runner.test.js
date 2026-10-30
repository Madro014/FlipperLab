import test from 'node:test';
import assert from 'node:assert/strict';
import {newRun, jumpRun, stepRun, validJumpKey} from '../src/runner.js';

test('jump rises, rejects an airborne second jump, and lands', () => {
  let run = stepRun(jumpRun(newRun()), 0.05);
  assert.ok(run.y > 0);
  assert.deepEqual(jumpRun(run), run);
  for (let i = 0; i < 20; i++) run = stepRun(run, 0.05);
  assert.equal(run.y, 0);
  assert.equal(run.velocity, 0);
});
test('collision ends a grounded run; a well-timed jump clears the same obstacle', () => {
  const initial = {...newRun('running'), obstacles: [{id: 0, x: 210, width: 28, height: 42}]};
  let grounded = initial, airborne = jumpRun(initial);
  for (let i = 0; i < 12; i++) {
    grounded = stepRun(grounded, 0.05, () => 0);
    airborne = stepRun(airborne, 0.05, () => 0);
  }
  assert.equal(grounded.status, 'over');
  assert.equal(airborne.status, 'running');
  assert.ok(airborne.score > 0);
  assert.equal(initial.obstacles[0].x, 210);
});
test('pause freezes the world, resume preserves it, restart clears score', () => {
  const paused = {...stepRun(jumpRun(newRun()), 0.05), status: 'paused'};
  assert.deepEqual(stepRun(paused, 10), paused);
  assert.deepEqual(jumpRun(paused), {...paused, status: 'running'});
  assert.equal(jumpRun({...paused, status: 'over'}).score, 0);
});
test('frame rates agree and long stalls cannot teleport past obstacles', () => {
  let fast = jumpRun(newRun()), slow = jumpRun(newRun());
  for (let i = 0; i < 60; i++) fast = stepRun(fast, 1 / 120, () => 0);
  for (let i = 0; i < 15; i++) slow = stepRun(slow, 1 / 30, () => 0);
  assert.ok(Math.abs(fast.y - slow.y) < 0.001);
  assert.ok(Math.abs(fast.distance - slow.distance) < 0.001);
  assert.ok(stepRun(newRun('running'), 10).distance < 23);
});
test('button mapping accepts presentation keys and excludes browser navigation keys', () => {
  for (const key of ['ArrowRight', 'PageDown', 'Enter', 'Space', 'KeyJ']) assert.ok(validJumpKey(key));
  for (const key of ['Tab', 'Escape', 'F5', 'AltLeft', '']) assert.equal(validJumpKey(key), false);
});
