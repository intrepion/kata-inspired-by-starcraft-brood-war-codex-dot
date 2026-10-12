import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createMatch,
  command,
  step,
  supply,
  add,
  save,
  load,
  replay,
  pathfind,
} from "../build/engine.js";
const run = (s, n) => {
  for (let i = 0; i < n; i++) step(s);
};
test("invalid construction spends nothing; cancellation refunds 75 percent", () => {
  const s = createMatch();
  const w = s.entities.find((e) => e.kind === "worker");
  const before = s.ore[0];
  assert.equal(
    command(s, { type: "build", ids: [w.id], kind: "pylon", x: 3, y: 10 }),
    false,
  );
  assert.equal(s.ore[0], before);
  assert.equal(
    command(s, { type: "build", ids: [w.id], kind: "pylon", x: 8, y: 9 }),
    true,
  );
  const b = s.entities.at(-1);
  assert.equal(s.ore[0], 250);
  command(s, { type: "cancel", ids: [b.id] });
  assert.equal(s.ore[0], 302);
});
test("worker construction completes and increases supply", () => {
  const s = createMatch();
  command(s, {
    type: "build",
    ids: [s.entities.find((e) => e.kind === "worker").id],
    kind: "pylon",
    x: 8,
    y: 9,
  });
  run(s, 140);
  assert.equal(supply(s, 0).cap, 18);
});
test("queues reserve supply and reject overflow without charging", () => {
  const s = createMatch();
  s.ore[0] = 1000;
  const f = s.entities.find((e) => e.team === 0 && e.kind === "foundry");
  command(s, { type: "train", ids: [f.id], kind: "mortar" });
  const before = s.ore[0];
  assert.equal(
    command(s, { type: "train", ids: [f.id], kind: "mortar" }),
    false,
  );
  assert.equal(s.ore[0], before);
  assert.equal(supply(s, 0).used, 8);
  command(s, { type: "cancel", ids: [f.id] });
  assert.equal(s.ore[0], 975);
  assert.equal(supply(s, 0).used, 5);
});
test("production pays once and spawns in accessible space", () => {
  const s = createMatch();
  const f = s.entities.find((e) => e.team === 0 && e.kind === "foundry");
  command(s, { type: "train", ids: [f.id], kind: "dart" });
  run(s, 45);
  assert.equal(
    s.entities.filter((e) => e.team === 0 && e.kind === "dart").length,
    2,
  );
  assert.equal(s.ore[0], 275);
  assert.equal(f.queue.length, 0);
});
test("unreachable destination and repeated stop do not trap units", () => {
  const s = createMatch();
  const d = s.entities.find((e) => e.team === 0 && e.kind === "dart");
  assert.deepEqual(pathfind(s, d, { x: 15, y: 2 }), []);
  assert.equal(command(s, { type: "order", ids: [d.id], x: 15, y: 2 }), false);
  command(s, { type: "order", ids: [d.id], x: 9, y: 10 });
  run(s, 40);
  assert.ok(d.x > 7);
  command(s, { type: "stop", ids: [d.id] });
  command(s, { type: "stop", ids: [d.id] });
  const x = d.x;
  run(s, 10);
  assert.equal(d.x, x);
});
test("counter roles inflict greater damage against their preferred targets", () => {
  const damage = (kind, target) => {
    const s = createMatch();
    s.entities = [];
    add(s, "core", 0, 3, 10);
    add(s, "core", 1, 29, 10);
    const a = add(s, kind, 0, 10, 10),
      b = add(s, target, 1, 11, 10);
    command(s, { type: "order", ids: [a.id], target: b.id });
    step(s);
    return [b.hp, b.kind];
  };
  assert.equal(damage("dart", "mortar")[0], 78.8);
  assert.equal(damage("bulwark", "dart")[0], 56.599999999999994);
  assert.equal(damage("mortar", "bulwark")[0], 142.2);
});
test("relay grants victory only for uncontested combat presence", () => {
  const s = createMatch("training");
  s.entities = s.entities.filter((e) => e.kind === "core");
  add(s, "worker", 0, 16, 10);
  run(s, 20);
  assert.equal(s.relay[0], 0);
  const d = add(s, "dart", 0, 16, 10),
    enemy = add(s, "bulwark", 1, 16, 11);
  run(s, 10);
  assert.equal(s.relay[0], 0);
  s.entities = s.entities.filter((e) => e.id !== enemy.id);
  d.hp = 80;
  run(s, 610);
  assert.equal(s.winner, 0);
});
test("death releases queue supply and own core death causes defeat", () => {
  const s = createMatch();
  const f = s.entities.find((e) => e.team === 0 && e.kind === "foundry");
  command(s, { type: "train", ids: [f.id], kind: "mortar" });
  f.hp = 0;
  step(s);
  assert.equal(supply(s, 0).used, 5);
  s.entities.find((e) => e.team === 0 && e.kind === "core").hp = 0;
  step(s);
  assert.equal(s.winner, 1);
  const tick = s.tick;
  step(s);
  assert.equal(s.tick, tick);
});
test("AI harvests, trains, expands and contests relay", () => {
  const s = createMatch();
  run(s, 900);
  assert.ok(s.nodes[1].amount < 1800);
  assert.ok(s.entities.some((e) => e.team === 1 && e.kind === "pylon"));
  assert.ok(
    s.entities.filter(
      (e) => e.team === 1 && ["dart", "mortar", "bulwark"].includes(e.kind),
    ).length > 2,
  );
  assert.ok(s.relay[1] > 0);
});
test("save roundtrip keeps pending production and orders deterministic", () => {
  const s = createMatch();
  const f = s.entities.find((e) => e.team === 0 && e.kind === "foundry");
  command(s, { type: "train", ids: [f.id], kind: "dart" });
  command(s, {
    type: "order",
    ids: s.entities
      .filter((e) => e.team === 0 && e.kind === "worker")
      .map((e) => e.id),
    target: 1001,
  });
  run(s, 25);
  const other = load(save(s));
  run(s, 200);
  run(other, 200);
  assert.equal(save(other), save(s));
  assert.throws(() => load('{"version":2}'));
});
test("command replay reproduces whole match state", () => {
  const s = createMatch();
  command(s, {
    type: "order",
    ids: [s.entities.find((e) => e.team === 0 && e.kind === "dart").id],
    x: 16,
    y: 10,
    attack: true,
  });
  run(s, 900);
  const r = replay(s);
  while (r.state.tick < r.end && r.state.winner === null) {
    while (r.index < r.log.length && r.log[r.index].tick === r.state.tick)
      command(r.state, r.log[r.index++].command, 0, false);
    step(r.state);
  }
  assert.deepEqual(r.state.entities, s.entities);
  assert.deepEqual(r.state.relay, s.relay);
});
test("long unattended simulation reaches defeat without nonfinite coordinates", () => {
  const s = createMatch();
  run(s, 12000);
  assert.equal(s.winner, 1);
  assert.ok(
    s.entities.every((e) => Number.isFinite(e.x) && Number.isFinite(e.y)),
  );
});
test("coincident units separate after production and never remain stacked", () => {
  const s = createMatch();
  const a = add(s, "dart", 0, 8, 10),
    b = add(s, "dart", 0, 8, 10);
  run(s, 20);
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > 0.4);
});
test("malformed saved histories, orders and cargo are rejected", () => {
  for (const mutate of [
    (s) => (s.log = [null]),
    (s) => (s.entities[0].cargo = -1),
    (s) =>
      (s.entities[0].order = { mode: "oops", x: 1, y: 1, path: [], retry: 0 }),
    (s) => (s.log = [{ tick: 0, command: { type: "oops", ids: [] } }]),
  ]) {
    const s = createMatch();
    mutate(s);
    assert.throws(() => load(save(s)));
  }
});
test("seeded interrupted campaigns stay valid through orders, refunds, saves and replay", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const s = createMatch(seed % 2 ? "training" : "standard");
    let rng = seed;
    const random = () => {
      rng = (rng * 1664525 + 1013904223) >>> 0;
      return rng / 4294967296;
    };
    for (let t = 0; t < 1600 && s.winner === null; t++) {
      if (t % 17 === 0) {
        const own = s.entities.filter((e) => e.team === 0),
          e = own[Math.floor(random() * own.length)];
        if (e) {
          const choice = Math.floor(random() * 5);
          const c =
            choice === 0
              ? { type: "stop", ids: [e.id] }
              : choice === 1
                ? { type: "cancel", ids: [e.id] }
                : choice === 2
                  ? {
                      type: "train",
                      ids: [e.id],
                      kind: ["worker", "dart", "bulwark", "mortar"][
                        Math.floor(random() * 4)
                      ],
                    }
                  : choice === 3
                    ? {
                        type: "build",
                        ids: [e.id],
                        kind: "pylon",
                        x: 2 + Math.floor(random() * 27),
                        y: 2 + Math.floor(random() * 15),
                      }
                    : {
                        type: "order",
                        ids: [e.id],
                        x: 2 + random() * 27,
                        y: 2 + random() * 15,
                        attack: true,
                      };
          command(s, c);
        }
      }
      step(s);
      if (t % 100 === 0) assert.equal(save(load(save(s))), save(s));
      assert.ok(s.ore.every((n) => n >= 0));
      assert.ok(s.nodes.every((n) => n.amount >= 0));
    }
    const r = replay(s);
    while (r.state.tick < s.tick && r.state.winner === null) {
      while (r.index < r.log.length && r.log[r.index].tick === r.state.tick)
        command(r.state, r.log[r.index++].command, 0, false);
      step(r.state);
    }
    assert.deepEqual(r.state.entities, s.entities);
  }
});
test("save validation rejects inherited prototype names as unit kinds", () => {
  for (const mutate of [
    (s) => (s.entities[0].kind = "toString"),
    (s) => (s.entities[0].queue = ["constructor"]),
    (s) =>
      (s.log = [
        { tick: 0, command: { type: "train", ids: [], kind: "__proto__" } },
      ]),
  ]) {
    const s = createMatch();
    mutate(s);
    assert.throws(() => load(save(s)));
  }
});
