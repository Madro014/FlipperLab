export const RUNNER = {width: 800, ground: 240, x: 110, size: 36, height: 42, gravity: 1800, jump: 620};
export function newRun(status = 'ready') {
  return {status, y: 0, velocity: 0, distance: 0, score: 0, obstacles: [{id: 0, x: 800, width: 28, height: 42}], nextId: 1};
}
export function jumpRun(state) {
  if (state.status === 'paused') return {...state, status: 'running'};
  const run = state.status === 'ready' || state.status === 'over' ? newRun('running') : state;
  return run.y === 0 ? {...run, velocity: RUNNER.jump} : run;
}
export function stepRun(state, elapsed, random = Math.random) {
  if (state.status !== 'running') return state;
  const run = {...state, obstacles: state.obstacles.map(item => ({...item}))};
  // Small steps keep collisions consistent across display refresh rates.
  let remaining = Math.min(Math.max(elapsed, 0), 0.05);
  while (remaining > 0) {
    const dt = Math.min(remaining, 1 / 120);
    remaining -= dt;
    const speed = Math.min(440, 280 + run.distance / 140);
    run.distance += speed * dt;
    run.velocity -= RUNNER.gravity * dt;
    run.y = Math.max(0, run.y + run.velocity * dt);
    if (run.y === 0) run.velocity = 0;
    for (const obstacle of run.obstacles) {
      obstacle.x -= speed * dt;
      if (obstacle.x < RUNNER.x + RUNNER.size - 4 && obstacle.x + obstacle.width > RUNNER.x + 4 && run.y + 5 < obstacle.height) run.status = 'over';
    }
    run.obstacles = run.obstacles.filter(item => item.x + item.width > 0);
    if (!run.obstacles.length || run.obstacles.at(-1).x < 350) run.obstacles.push({id: run.nextId++, x: 800 + random() * 160, width: 24 + random() * 14, height: 32 + random() * 20});
    run.score = Math.floor(run.distance / 12);
    if (run.status === 'over') break;
  }
  return run;
}
export const validJumpKey = code => /^(Space|Enter|Arrow(Up|Down|Left|Right)|Page(Up|Down)|Key[A-Z]|Digit[0-9])$/.test(code);
export const keyLabel = code => ({Space: 'Espacio', Enter: 'Enter', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', PageDown: 'Av. pág.', PageUp: 'Re. pág.'}[code] || code.replace(/^(Key|Digit)/, ''));
