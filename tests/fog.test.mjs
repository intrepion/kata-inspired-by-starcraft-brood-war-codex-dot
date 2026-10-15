import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createMatch,
  command,
  step,
  canSee,
  fogAt,
  visibleEntities,
  save,
  load,
  replay,
  add,
} from "../build/engine.js";
const run = (state, count) => {
  for (let i = 0; i < count; i++) step(state);
};

test("new matches conceal enemy IDs from rendering and explicit attack orders", () => {
  const s = createMatch("training"),
    scout = s.entities.find((e) => e.team === 0 && e.kind === "dart"),
    enemy = s.entities.find((e) => e.team === 1 && e.kind === "core");
  assert.equal(fogAt(s, 0, enemy), "unexplored");
  assert.equal(
    visibleEntities(s).some((e) => e.id === enemy.id),
    false,
  );
  assert.equal(
    command(s, { type: "order", ids: [scout.id], target: enemy.id }),
    false,
  );
  assert.equal(scout.order, undefined);
  assert.equal(
    command(s, { type: "order", ids: [scout.id], x: 22, y: 13 }),
    true,
  );
  run(s, 70);
  const hostile = s.entities.find((e) => e.team === 1 && e.kind === "dart");
  assert.equal(canSee(s, 0, hostile), true);
  assert.equal(
    visibleEntities(s).some((e) => e.id === hostile.id),
    true,
  );
  assert.equal(
    command(s, { type: "order", ids: [scout.id], x: 6, y: 13 }),
    true,
  );
  run(s, 90);
  assert.equal(canSee(s, 0, hostile), false);
  assert.equal(
    visibleEntities(s).some((e) => e.id === hostile.id),
    false,
  );
  assert.equal(fogAt(s, 0, { x: 21, y: 13 }), "explored");
});

test("sight is shared per team and both teams reject unseen explicit targets", () => {
  const s = createMatch();
  for (const team of [0, 1]) {
    const unit = s.entities.find((e) => e.team === team && e.kind === "dart"),
      foe = s.entities.find((e) => e.team !== team && e.kind === "core");
    assert.equal(
      command(s, { type: "order", ids: [unit.id], target: foe.id }, team),
      false,
    );
    const observer = add(s, "worker", team, foe.x + (team ? 4 : -4), foe.y);
    assert.equal(canSee(s, team, foe), true);
    assert.equal(
      command(s, { type: "order", ids: [unit.id], target: foe.id }, team),
      true,
    );
    observer.hp = 0;
    run(s, 1);
    assert.equal(unit.order?.target, undefined);
    assert.equal(canSee(s, team, foe), false);
  }
});

test("exploration persists and v1 migration keeps economy, queues, orders and historical replay epoch", () => {
  const s = createMatch("training");
  const scout = s.entities.find((e) => e.team === 0 && e.kind === "dart");
  command(s, { type: "order", ids: [scout.id], x: 14, y: 13 });
  run(s, 40);
  const restored = load(save(s));
  assert.deepEqual(restored.explored, s.explored);
  assert.equal(save(restored), save(s));
  const old = JSON.parse(save(s));
  old.version = 1;
  delete old.explored;
  delete old.fogStartTick;
  const migrated = load(JSON.stringify(old));
  assert.equal(migrated.version, 2);
  assert.equal(migrated.fogStartTick, s.tick);
  assert.deepEqual(migrated.entities, old.entities);
  assert.deepEqual(migrated.ore, s.ore);
  assert.deepEqual(migrated.log, s.log);
  assert.equal(canSee(migrated, 0, { x: 29, y: 15 }), false);
  const playback = replay(migrated);
  assert.equal(playback.state.fogStartTick, migrated.tick);
  assert.equal(canSee(playback.state, 0, { x: 29, y: 15 }), true);
  for (const mutate of [
    (v) => v.explored[0].pop(),
    (v) => (v.explored[0][0] = 9),
    (v) => (v.fogStartTick = -1),
  ]) {
    const invalid = JSON.parse(save(s));
    mutate(invalid);
    assert.throws(() => load(JSON.stringify(invalid)));
  }
});

test("new fog matches replay exploration as well as units deterministically", () => {
  const s = createMatch("training"),
    scout = s.entities.find((e) => e.team === 0 && e.kind === "dart");
  command(s, { type: "order", ids: [scout.id], x: 19, y: 13 });
  run(s, 60);
  command(s, { type: "order", ids: [scout.id], x: 6, y: 13 });
  run(s, 70);
  const r = replay(s);
  while (r.state.tick < r.end && r.state.winner === null) {
    while (r.index < r.log.length && r.log[r.index].tick === r.state.tick)
      command(r.state, r.log[r.index++].command, 0, false);
    step(r.state);
  }
  assert.deepEqual(r.state.entities, s.entities);
  assert.deepEqual(r.state.explored, s.explored);
});

test("migration replays the complete saved legacy tick before changing visibility rules", () => {
  const legacy = createMatch("training", 10000);
  const scout = legacy.entities.find((e) => e.team === 0 && e.kind === "dart");
  const core = legacy.entities.find((e) => e.team === 1 && e.kind === "core");
  command(legacy, { type: "order", ids: [scout.id], target: core.id });
  run(legacy, 8);
  const raw = JSON.parse(save(legacy));
  raw.version = 1;
  delete raw.explored;
  delete raw.fogStartTick;
  const migrated = load(JSON.stringify(raw)),
    r = replay(migrated);
  while (r.state.tick < r.end) {
    while (r.index < r.log.length && r.log[r.index].tick === r.state.tick)
      command(r.state, r.log[r.index++].command, 0, false);
    step(r.state);
  }
  assert.deepEqual(r.state.entities, migrated.entities);
  assert.deepEqual(r.state.explored, migrated.explored);
});

test("a baseline-generated v1 moving-worker attack log reproduces its saved order coordinates", () => {
  const migrated = load(
    readFileSync(
      new URL("./fixtures/v1-worker-target.json", import.meta.url),
      "utf8",
    ),
  );
  const r = replay(migrated);
  while (r.state.tick < r.end) {
    while (r.index < r.log.length && r.log[r.index].tick === r.state.tick)
      command(r.state, r.log[r.index++].command, 0, false);
    step(r.state);
  }
  assert.deepEqual(r.state.entities, migrated.entities);
  assert.deepEqual(r.state.explored, migrated.explored);
});

test("baseline tick-200 AI commands do not reveal extra cells before the migration step finishes", () => {
  const migrated = load(
    readFileSync(
      new URL("./fixtures/v1-standard-tick200.json", import.meta.url),
      "utf8",
    ),
  );
  const r = replay(migrated);
  while (r.state.tick < r.end) {
    while (r.index < r.log.length && r.log[r.index].tick === r.state.tick)
      command(r.state, r.log[r.index++].command, 0, false);
    step(r.state);
  }
  assert.deepEqual(
    JSON.parse(JSON.stringify(r.state.entities)),
    migrated.entities,
  );
  assert.deepEqual(r.state.explored, migrated.explored);
});

test("saving is pure and a same-tick construction/cancellation replays explored cells exactly", () => {
  const s = createMatch("training"),
    worker = s.entities.find((e) => e.team === 0 && e.kind === "worker");
  assert.equal(
    command(s, {
      type: "build",
      ids: [worker.id],
      kind: "pylon",
      x: 10,
      y: 10,
    }),
    true,
  );
  const revealed = structuredClone(s.explored);
  save(s);
  assert.deepEqual(s.explored, revealed);
  command(s, { type: "cancel", ids: [s.entities.at(-1).id] });
  step(s);
  const r = replay(s);
  while (r.index < r.log.length)
    command(r.state, r.log[r.index++].command, 0, false);
  step(r.state);
  assert.deepEqual(r.state.explored, s.explored);
  assert.deepEqual(r.state.entities, s.entities);
});

test("ground routing does not report hidden enemy building occupancy before scouting it", () => {
  for (const x of [28, 29]) {
    const s = createMatch("training"),
      scout = s.entities.find((e) => e.team === 0 && e.kind === "dart"),
      core = s.entities.find((e) => e.team === 1 && e.kind === "core");
    assert.equal(canSee(s, 0, core), false);
    assert.equal(
      command(s, { type: "order", ids: [scout.id], x, y: 10 }),
      true,
    );
    assert.equal(s.message, "Move order issued.");
    let revealed = false;
    for (let i = 0; i < 120 && scout.hp > 0; i++) {
      step(s);
      revealed ||= canSee(s, 0, core);
    }
    assert.equal(revealed, true);
    assert.ok(Math.hypot(scout.x - core.x, scout.y - core.y) > 0.95);
  }
});
