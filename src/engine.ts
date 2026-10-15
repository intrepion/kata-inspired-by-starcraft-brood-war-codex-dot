export type Kind =
  | "core"
  | "worker"
  | "foundry"
  | "pylon"
  | "sentry"
  | "dart"
  | "bulwark"
  | "mortar";
export type Point = { x: number; y: number };
export const W = 32,
  H = 20,
  DT = 0.1;
export const specs: Record<
  Kind,
  {
    cost: number;
    hp: number;
    speed: number;
    range: number;
    damage: number;
    time: number;
    supply: number;
  }
> = {
  core: {
    cost: 0,
    hp: 1400,
    speed: 0,
    range: 5,
    damage: 8,
    time: 0,
    supply: 0,
  },
  worker: {
    cost: 40,
    hp: 55,
    speed: 2.6,
    range: 1,
    damage: 2,
    time: 4,
    supply: 1,
  },
  foundry: {
    cost: 130,
    hp: 420,
    speed: 0,
    range: 0,
    damage: 0,
    time: 8,
    supply: 0,
  },
  pylon: {
    cost: 70,
    hp: 240,
    speed: 0,
    range: 0,
    damage: 0,
    time: 5,
    supply: 0,
  },
  sentry: {
    cost: 100,
    hp: 260,
    speed: 0,
    range: 5,
    damage: 12,
    time: 7,
    supply: 0,
  },
  dart: {
    cost: 45,
    hp: 80,
    speed: 3.2,
    range: 3.2,
    damage: 9,
    time: 4,
    supply: 1,
  },
  bulwark: {
    cost: 75,
    hp: 180,
    speed: 1.7,
    range: 2.2,
    damage: 13,
    time: 6,
    supply: 2,
  },
  mortar: {
    cost: 100,
    hp: 95,
    speed: 1.3,
    range: 6,
    damage: 21,
    time: 8,
    supply: 3,
  },
};
export type Order = {
  mode: "move" | "attack" | "gather" | "build";
  x: number;
  y: number;
  target?: number;
  path: Point[];
  retry: number;
};
export type Entity = Point & {
  id: number;
  team: 0 | 1;
  kind: Kind;
  hp: number;
  progress: number;
  queue: Kind[];
  production: number;
  cooldown: number;
  cargo: number;
  order?: Order;
};
export type Command = {
  type: "order" | "build" | "train" | "cancel" | "stop";
  ids: number[];
  x?: number;
  y?: number;
  target?: number;
  kind?: Kind;
  attack?: boolean;
};
export type State = {
  version: 2;
  fogStartTick: number;
  explored: [number[], number[]];
  difficulty: "training" | "standard";
  tick: number;
  nextId: number;
  ore: [number, number];
  entities: Entity[];
  nodes: (Point & { id: number; amount: number })[];
  relay: [number, number];
  winner: null | 0 | 1;
  message: string;
  log: { tick: number; command: Command }[];
};
export const mobile = (e: Entity) => specs[e.kind].speed > 0;
export const combat = (e: Entity) =>
  ["dart", "bulwark", "mortar"].includes(e.kind);
export function add(
  s: State,
  kind: Kind,
  team: 0 | 1,
  x: number,
  y: number,
  progress = 1,
) {
  const e: Entity = {
    id: s.nextId++,
    kind,
    team,
    x,
    y,
    hp: specs[kind].hp,
    progress,
    queue: [],
    production: 0,
    cooldown: 0,
    cargo: 0,
  };
  s.entities.push(e);
  return e;
}
export function createMatch(
  difficulty: State["difficulty"] = "standard",
  fogStartTick = 0,
): State {
  const s: State = {
    version: 2,
    fogStartTick,
    explored: [Array(W * H).fill(0), Array(W * H).fill(0)],
    difficulty,
    tick: 0,
    nextId: 1,
    ore: [320, 320],
    entities: [],
    nodes: [],
    relay: [0, 0],
    winner: null,
    message: "Select workers, then right-click ore to harvest.",
    log: [],
  };
  add(s, "core", 0, 3, 10);
  add(s, "core", 1, 29, 10);
  for (const team of [0, 1] as const) {
    for (let i = 0; i < 4; i++)
      add(s, "worker", team, team === 0 ? 5 : 27, 8 + i);
    add(s, "foundry", team, team === 0 ? 3 : 29, 15);
    add(s, "dart", team, team === 0 ? 6 : 26, 13);
  }
  s.nodes = [
    { id: 1001, x: 5, y: 6, amount: 1800 },
    { id: 1002, x: 27, y: 6, amount: 1800 },
    { id: 1003, x: 11, y: 15, amount: 1200 },
    { id: 1004, x: 21, y: 15, amount: 1200 },
  ];
  refreshVision(s);
  return s;
}
export function supply(s: State, team: 0 | 1) {
  return {
    used: s.entities
      .filter((e) => e.team === team)
      .reduce(
        (a, e) =>
          a +
          specs[e.kind].supply +
          e.queue.reduce((b, k) => b + specs[k].supply, 0),
        0,
      ),
    cap:
      10 +
      s.entities.filter(
        (e) => e.team === team && e.kind === "pylon" && e.progress === 1,
      ).length *
        8,
  };
}
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const sightRadius: Record<Kind, number> = {
  core: 7,
  worker: 5,
  foundry: 5,
  pylon: 5,
  sentry: 7,
  dart: 6,
  bulwark: 5,
  mortar: 7,
};
/** Team-shared current sight, also used by orders and combat acquisition. */
export function canSee(
  s: State,
  team: 0 | 1,
  point: Point,
  duringStep = false,
): boolean {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
  // A migrated match has already simulated its saved tick under the old rules.
  if (
    s.tick < s.fogStartTick ||
    (duringStep && s.fogStartTick > 0 && s.tick === s.fogStartTick)
  )
    return true;
  return s.entities.some((e) => {
    const radius = e.progress < 1 ? 3 : sightRadius[e.kind];
    return (
      e.team === team &&
      e.hp > 0 &&
      (e.x - point.x) ** 2 + (e.y - point.y) ** 2 <= radius ** 2
    );
  });
}
export function fogAt(
  s: State,
  team: 0 | 1,
  point: Point,
): "visible" | "explored" | "unexplored" {
  if (canSee(s, team, point)) return "visible";
  const x = Math.floor(point.x),
    y = Math.floor(point.y);
  return x >= 0 && x < W && y >= 0 && y < H && s.explored[team][y * W + x] === 1
    ? "explored"
    : "unexplored";
}
export function visibleEntities(s: State, team: 0 | 1 = 0): Entity[] {
  return s.entities.filter((e) => e.team === team || canSee(s, team, e));
}
function refreshVision(s: State, duringStep = false): void {
  if (
    s.tick < s.fogStartTick ||
    (duringStep && s.fogStartTick > 0 && s.tick === s.fogStartTick)
  )
    return;
  for (const entity of s.entities) {
    if (entity.hp <= 0) continue;
    const radius = entity.progress < 1 ? 3 : sightRadius[entity.kind];
    for (
      let y = Math.max(0, Math.floor(entity.y - radius));
      y < Math.min(H, Math.ceil(entity.y + radius));
      y++
    ) {
      for (
        let x = Math.max(0, Math.floor(entity.x - radius));
        x < Math.min(W, Math.ceil(entity.x + radius));
        x++
      ) {
        if (
          (x + 0.5 - entity.x) ** 2 + (y + 0.5 - entity.y) ** 2 <=
          radius ** 2
        )
          s.explored[entity.team][y * W + x] = 1;
      }
    }
  }
}

export function blocked(
  s: State,
  x: number,
  y: number,
  ignore?: number,
  knownTeam?: 0 | 1,
  duringStep = false,
) {
  return (
    x < 1 ||
    y < 1 ||
    x >= W - 1 ||
    y >= H - 1 ||
    ((x === 15 || x === 16) && (y < 6 || y > 14)) ||
    s.entities.some(
      (e) =>
        !mobile(e) &&
        e.id !== ignore &&
        (knownTeam === undefined ||
          e.team === knownTeam ||
          canSee(s, knownTeam, e, duringStep)) &&
        Math.abs(e.x - x) < 0.95 &&
        Math.abs(e.y - y) < 0.95,
    )
  );
}
export function pathfind(
  s: State,
  from: Point & { team?: 0 | 1 },
  to: Point,
  near = 0,
  duringStep = false,
): Point[] {
  const start = { x: Math.round(from.x), y: Math.round(from.y) };
  const goal = { x: Math.round(to.x), y: Math.round(to.y) };
  const q = [start],
    seen = new Set([`${start.x},${start.y}`]),
    parents = new Map<string, Point>();
  let end: Point | undefined;
  for (let i = 0; i < q.length; i++) {
    const p = q[i];
    if (distance(p, goal) <= near + 0.1) {
      end = p;
      break;
    }
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const n = { x: p.x + dx, y: p.y + dy },
        key = `${n.x},${n.y}`;
      if (
        !seen.has(key) &&
        !blocked(s, n.x, n.y, undefined, from.team, duringStep)
      ) {
        seen.add(key);
        parents.set(key, p);
        q.push(n);
      }
    }
  }
  if (!end) return [];
  const out: Point[] = [];
  while (end.x !== start.x || end.y !== start.y) {
    out.unshift(end);
    end = parents.get(`${end.x},${end.y}`)!;
  }
  return out;
}
function setOrder(
  s: State,
  e: Entity,
  mode: Order["mode"],
  to: Point,
  target?: number,
  near = 0,
  duringStep = false,
) {
  const path = pathfind(s, e, to, near, duringStep);
  if (!path.length && distance(e, to) > near + 1) {
    s.message = "Route blocked — choose an accessible destination.";
    e.order = undefined;
    return false;
  }
  e.order = { mode, x: to.x, y: to.y, target, path, retry: 0 };
  return true;
}
export function command(
  s: State,
  c: Command,
  team: 0 | 1 = 0,
  record = true,
  duringStep = false,
) {
  if (
    s.winner !== null ||
    (c.kind !== undefined && !Object.hasOwn(specs, c.kind))
  )
    return false;
  const es = s.entities.filter((e) => c.ids.includes(e.id) && e.team === team);
  if (record && team === 0)
    s.log.push({ tick: s.tick, command: structuredClone(c) });
  if (c.type === "order" && c.target !== undefined) {
    const target = s.entities.find((e) => e.id === c.target),
      node = s.nodes.find((n) => n.id === c.target);
    if (
      (target &&
        target.team !== team &&
        !canSee(s, team, target, duringStep)) ||
      (node && !canSee(s, team, node, duringStep))
    ) {
      s.message =
        "Target outside current vision. Scout or attack-move to a location.";
      return false;
    }
  }
  let ok = false;
  for (const e of es) {
    if (c.type === "stop") {
      e.order = undefined;
      ok = true;
    }
    if (c.type === "train" && c.kind) {
      const k = c.kind,
        sp = specs[k],
        su = supply(s, team);
      if (
        e.progress < 1 ||
        !(e.kind === "core"
          ? k === "worker"
          : e.kind === "foundry" && ["dart", "bulwark", "mortar"].includes(k))
      ) {
        s.message = "Select a completed production structure.";
        continue;
      }
      if (
        e.queue.length >= 5 ||
        su.used + sp.supply > su.cap ||
        s.ore[team] < sp.cost
      ) {
        s.message = "Need ore, supply, or queue space.";
        continue;
      }
      s.ore[team] -= sp.cost;
      e.queue.push(k);
      s.message = `${k} queued`;
      ok = true;
    }
    if (c.type === "cancel") {
      if (e.progress < 1 && !mobile(e)) {
        s.ore[team] += Math.floor(specs[e.kind].cost * 0.75);
        s.entities = s.entities.filter((a) => a.id !== e.id);
        ok = true;
      } else if (e.queue.length) {
        s.ore[team] += Math.floor(specs[e.queue.pop()!].cost * 0.75);
        if (!e.queue.length) e.production = 0;
        ok = true;
      }
      s.message = "Cancellation refunds 75%.";
    }
    if (
      c.type === "build" &&
      e.kind === "worker" &&
      c.kind &&
      ["foundry", "pylon", "sentry"].includes(c.kind)
    ) {
      const p = { x: Math.round(c.x ?? 0), y: Math.round(c.y ?? 0) },
        cost = specs[c.kind].cost;
      if (!canSee(s, team, p, duringStep)) {
        s.message = "Scout the construction site first.";
        continue;
      }
      if (
        blocked(s, p.x, p.y) ||
        s.nodes.some((n) => distance(n, p) < 2) ||
        distance(p, { x: 16, y: 10 }) < 2 ||
        s.entities.some((a) => !mobile(a) && distance(a, p) < 2.5)
      ) {
        s.message =
          "Invalid site — leave space around structures, ore and relay.";
        continue;
      }
      if (s.ore[team] < cost) {
        s.message = "Insufficient ore.";
        continue;
      }
      const path = pathfind(s, e, p, 1.5, duringStep);
      if (!path.length && distance(e, p) > 2) {
        s.message = "Worker cannot reach site.";
        continue;
      }
      s.ore[team] -= cost;
      const b = add(s, c.kind, team, p.x, p.y, 0);
      setOrder(s, e, "build", p, b.id, 1.5, duringStep);
      s.message = `Constructing ${c.kind}; keep worker on site.`;
      ok = true;
      break;
    }
    if (c.type === "order" && mobile(e)) {
      const target = s.entities.find((a) => a.id === c.target),
        node = s.nodes.find((n) => n.id === c.target);
      const p = target ??
        node ?? {
          x: Math.max(1, Math.min(W - 2, c.x ?? e.x)),
          y: Math.max(1, Math.min(H - 2, c.y ?? e.y)),
        };
      let mode: Order["mode"] =
        c.attack || (target?.team !== undefined && target.team !== team)
          ? "attack"
          : "move";
      if (node && e.kind === "worker") mode = "gather";
      if (
        target &&
        target.team === team &&
        target.progress < 1 &&
        e.kind === "worker"
      )
        mode = "build";
      s.message = `${mode === "gather" ? "Harvesting ore" : mode === "build" ? "Resuming construction" : mode === "attack" ? "Attack order issued" : "Move order issued"}.`;
      ok =
        setOrder(
          s,
          e,
          mode,
          p,
          c.target,
          mode === "gather" || mode === "build"
            ? 1.5
            : target
              ? specs[e.kind].range * 0.8
              : 0,
          duringStep,
        ) || ok;
    }
  }
  refreshVision(s, duringStep);
  return ok;
}
function move(s: State, e: Entity) {
  const o = e.order;
  if (!o) return;
  const p = o.path[0];
  if (!p) return;
  if (blocked(s, p.x, p.y)) {
    o.path = pathfind(
      s,
      e,
      { x: o.x, y: o.y },
      o.mode === "build" || o.mode === "gather" ? 1.5 : 0,
      true,
    );
    if (!o.path.length) {
      e.order = undefined;
      s.message = "A new structure blocked the route.";
    }
    return;
  }
  const d = distance(e, p),
    speed = specs[e.kind].speed * DT;
  if (d <= speed) {
    e.x = p.x;
    e.y = p.y;
    o.path.shift();
  } else {
    e.x += ((p.x - e.x) / d) * speed;
    e.y += ((p.y - e.y) / d) * speed;
  }
}
function ai(s: State) {
  for (const w of s.entities.filter(
    (e) => e.team === 1 && e.kind === "worker" && !e.order,
  )) {
    const n = s.nodes
      .filter((n) => n.amount > 0)
      .sort((a, b) => distance(w, a) - distance(w, b))[0];
    if (n)
      command(s, { type: "order", ids: [w.id], target: n.id }, 1, false, true);
  }
  const base = s.entities.find((e) => e.team === 1 && e.kind === "core");
  if (!base) return;
  const w = s.entities.find((e) => e.team === 1 && e.kind === "worker");
  if (
    w &&
    supply(s, 1).cap - supply(s, 1).used < 4 &&
    !s.entities.some(
      (e) => e.team === 1 && e.kind === "pylon" && e.progress < 1,
    )
  ) {
    const count = s.entities.filter(
      (e) => e.team === 1 && e.kind === "pylon",
    ).length;
    command(
      s,
      {
        type: "build",
        ids: [w.id],
        kind: "pylon",
        x: 25 - (count % 3) * 3,
        y: 17 - Math.floor(count / 3) * 3,
      },
      1,
      false,
      true,
    );
  }
  if (s.difficulty === "standard" || (s.tick >= 600 && s.tick % 60 === 0))
    for (const f of s.entities.filter(
      (e) => e.team === 1 && e.kind === "foundry" && e.queue.length < 2,
    )) {
      const k: Kind = ["dart", "bulwark", "mortar"][
        Math.floor(s.tick / 60) % 3
      ] as Kind;
      command(s, { type: "train", ids: [f.id], kind: k }, 1, false, true);
    }
  if (
    (s.difficulty === "standard" || s.tick >= 1800) &&
    s.tick % (s.difficulty === "training" ? 600 : 200) === 0
  ) {
    const army = s.entities.filter((e) => e.team === 1 && combat(e));
    command(
      s,
      {
        type: "order",
        ids: army.map((e) => e.id),
        x: s.tick > 1800 ? 3 : 16,
        y: 10,
        attack: true,
      },
      1,
      false,
      true,
    );
  }
}
export function step(s: State) {
  if (s.winner !== null) return;
  s.tick++;
  if (s.tick % 20 === 0) {
    const msg = s.message;
    ai(s);
    s.message = msg;
  }
  for (const e of [...s.entities]) {
    if (e.hp <= 0) continue;
    const sp = specs[e.kind];
    e.cooldown = Math.max(0, e.cooldown - DT);
    if (e.progress === 1 && e.queue.length) {
      e.production += DT;
      if (e.production >= specs[e.queue[0]].time) {
        const spots = [
          { x: e.x + 2, y: e.y },
          { x: e.x - 2, y: e.y },
          { x: e.x, y: e.y - 2 },
        ];
        const p = spots.find((p) => !blocked(s, p.x, p.y));
        if (p) {
          add(s, e.queue.shift()!, e.team, p.x, p.y);
          e.production = 0;
        }
      }
    }
    if (e.progress < 1) continue;
    const o = e.order;
    if (o?.mode === "build") {
      const b = s.entities.find((a) => a.id === o.target);
      if (!b || b.progress === 1) e.order = undefined;
      else if (distance(e, b) < 2) {
        b.progress = Math.min(1, b.progress + DT / specs[b.kind].time);
        o.path = [];
      }
    }
    if (o?.mode === "gather") {
      const n = s.nodes.find((n) => n.id === o.target);
      const core = s.entities.find(
        (a) => a.team === e.team && a.kind === "core",
      );
      if (!n || !core) {
        e.order = undefined;
      } else if (e.cargo >= 10 || (n.amount === 0 && e.cargo > 0)) {
        if (distance(e, core) < 2) {
          s.ore[e.team] += e.cargo;
          e.cargo = 0;
          o.path = pathfind(s, e, n, 1.5, true);
        } else if (!o.path.length) o.path = pathfind(s, e, core, 1.5, true);
      } else if (n.amount === 0) {
        e.order = undefined;
      } else if (distance(e, n) < 2) {
        const mined = Math.min(10 - e.cargo, n.amount, DT * 5);
        e.cargo += mined;
        n.amount -= mined;
        o.path = [];
      } else if (!o.path.length) o.path = pathfind(s, e, n, 1.5, true);
    }
    let enemy = s.entities.find(
      (a) =>
        a.id === o?.target &&
        a.team !== e.team &&
        a.hp > 0 &&
        canSee(s, e.team, a, true),
    );
    if (!enemy || distance(e, enemy) > sp.range)
      enemy = s.entities
        .filter(
          (a) =>
            a.team !== e.team &&
            a.hp > 0 &&
            distance(e, a) <= sp.range &&
            canSee(s, e.team, a, true),
        )
        .sort((a, b) => distance(e, a) - distance(e, b))[0];
    if (enemy && sp.damage && (!o || o.mode === "attack" || !mobile(e))) {
      if (e.cooldown === 0) {
        let bonus = 1;
        if (
          (e.kind === "dart" && enemy.kind === "mortar") ||
          (e.kind === "bulwark" && enemy.kind === "dart") ||
          (e.kind === "mortar" && (enemy.kind === "bulwark" || !mobile(enemy)))
        )
          bonus = 1.8;
        enemy.hp -= sp.damage * bonus;
        e.cooldown = e.kind === "mortar" ? 1.8 : 0.8;
      }
      continue;
    }
    if (o?.mode === "attack" && o.target) {
      const t = s.entities.find((a) => a.id === o.target);
      if (!t) e.order = undefined;
      else if (!canSee(s, e.team, t, true)) {
        o.target = undefined; // Continue only to the last observed position.
        o.path = pathfind(s, e, o, 0, true);
      } else {
        if (s.tick > s.fogStartTick || s.fogStartTick === 0) {
          o.x = t.x;
          o.y = t.y;
        }
        if (!o.path.length && distance(e, t) > sp.range)
          o.path = pathfind(s, e, t, sp.range * 0.8, true);
      }
    }
    if (mobile(e)) move(s, e);
    if (
      e.order &&
      ["move", "attack"].includes(e.order.mode) &&
      !e.order.path.length &&
      !e.order.target
    )
      e.order = undefined;
  }
  for (const e of s.entities.filter(mobile)) {
    for (const other of s.entities.filter((a) => mobile(a) && a.id > e.id)) {
      const d = distance(e, other);
      if (d < 0.55) {
        const dx = d === 0 ? 0.025 : ((e.x - other.x) / d) * 0.025,
          dy = d === 0 ? 0.025 : ((e.y - other.y) / d) * 0.025;
        if (!blocked(s, e.x + dx, e.y + dy)) {
          e.x += dx;
          e.y += dy;
        }
        if (!blocked(s, other.x - dx, other.y - dy)) {
          other.x -= dx;
          other.y -= dy;
        }
      }
    }
  }
  s.entities = s.entities.filter((e) => e.hp > 0);
  refreshVision(s);
  for (const team of [0, 1] as const) {
    const own = s.entities.some(
      (e) =>
        e.team === team && combat(e) && distance(e, { x: 16, y: 10 }) < 2.7,
    );
    const foe = s.entities.some(
      (e) =>
        e.team !== team && combat(e) && distance(e, { x: 16, y: 10 }) < 2.7,
    );
    if (own && !foe) s.relay[team] += DT;
    if (s.relay[team] >= 60) s.winner = team;
    if (!s.entities.some((e) => e.team === team && e.kind === "core"))
      s.winner = team === 0 ? 1 : 0;
  }
}
export function save(s: State) {
  return JSON.stringify(s);
}
export function load(raw: string): State {
  const s = JSON.parse(raw) as State;
  const version = (s as { version: number }).version;
  if (
    ![1, 2].includes(version) ||
    !["training", "standard"].includes(s.difficulty) ||
    !Number.isInteger(s.tick) ||
    s.tick < 0 ||
    !Number.isInteger(s.nextId) ||
    !Array.isArray(s.entities) ||
    s.entities.length > 500 ||
    !Array.isArray(s.nodes) ||
    !Array.isArray(s.log) ||
    !Array.isArray(s.ore) ||
    s.ore.length !== 2 ||
    !s.ore.every((n) => Number.isFinite(n) && n >= 0) ||
    !Array.isArray(s.relay) ||
    s.relay.length !== 2 ||
    !s.relay.every((n) => Number.isFinite(n) && n >= 0) ||
    ![null, 0, 1].includes(s.winner)
  )
    throw Error("Invalid save");
  for (const e of s.entities) {
    if (
      !Object.hasOwn(specs, e.kind) ||
      ![0, 1].includes(e.team) ||
      ![
        e.id,
        e.x,
        e.y,
        e.hp,
        e.progress,
        e.production,
        e.cooldown,
        e.cargo,
      ].every(Number.isFinite) ||
      e.x < 0 ||
      e.x > W ||
      e.y < 0 ||
      e.y > H ||
      e.progress < 0 ||
      e.progress > 1 ||
      !Array.isArray(e.queue) ||
      e.queue.length > 5 ||
      e.queue.some((k) => !Object.hasOwn(specs, k)) ||
      (e.order &&
        (!Array.isArray(e.order.path) ||
          !e.order.path.every(
            (p) => Number.isFinite(p.x) && Number.isFinite(p.y),
          )))
    )
      throw Error("Invalid entity");
  }
  if (
    new Set(s.entities.map((e) => e.id)).size !== s.entities.length ||
    s.entities.some((e) => e.id >= s.nextId)
  )
    throw Error("Invalid identifiers");
  if (
    !s.nodes.every(
      (n) => [n.id, n.x, n.y, n.amount].every(Number.isFinite) && n.amount >= 0,
    )
  )
    throw Error("Invalid ore");
  validateStateDetails(s);
  if (version === 1) {
    s.version = 2;
    s.fogStartTick = s.tick;
    s.explored = [Array(W * H).fill(0), Array(W * H).fill(0)];
    refreshVision(s);
  } else if (
    !Number.isInteger(s.fogStartTick) ||
    s.fogStartTick < 0 ||
    s.fogStartTick > s.tick ||
    !Array.isArray(s.explored) ||
    s.explored.length !== 2 ||
    !s.explored.every(
      (grid) =>
        Array.isArray(grid) &&
        grid.length === W * H &&
        grid.every((cell) => cell === 0 || cell === 1),
    )
  ) {
    throw Error("Invalid visibility state");
  }
  return s;
}
export function replay(s: State) {
  return {
    state: createMatch(s.difficulty, s.fogStartTick),
    log: structuredClone(s.log),
    end: s.tick,
    index: 0,
  };
}

function validateStateDetails(s: State) {
  const coordinate = (p: Point) =>
    p &&
    Number.isFinite(p.x) &&
    Number.isFinite(p.y) &&
    p.x >= 0 &&
    p.x <= W &&
    p.y >= 0 &&
    p.y <= H;
  const validCommand = (c: Command) =>
    c &&
    ["order", "build", "train", "cancel", "stop"].includes(c.type) &&
    Array.isArray(c.ids) &&
    c.ids.every(Number.isInteger) &&
    (c.kind === undefined || Object.hasOwn(specs, c.kind)) &&
    (c.x === undefined || Number.isFinite(c.x)) &&
    (c.y === undefined || Number.isFinite(c.y)) &&
    (c.target === undefined || Number.isInteger(c.target)) &&
    (c.attack === undefined || typeof c.attack === "boolean");
  if (
    typeof s.message !== "string" ||
    s.log.length > 100000 ||
    !s.log.every(
      (l, i) =>
        l &&
        Number.isInteger(l.tick) &&
        l.tick >= 0 &&
        l.tick <= s.tick &&
        (i === 0 || l.tick >= s.log[i - 1].tick) &&
        validCommand(l.command),
    )
  )
    throw Error("Invalid command history");
  for (const e of s.entities) {
    if (
      e.hp <= 0 ||
      e.hp > specs[e.kind].hp ||
      e.cargo < 0 ||
      e.cargo > 10 ||
      e.production < 0 ||
      e.cooldown < 0 ||
      e.queue.some((k) =>
        e.kind === "core"
          ? k !== "worker"
          : e.kind !== "foundry" || !["dart", "bulwark", "mortar"].includes(k),
      )
    )
      throw Error("Invalid entity ranges");
    const o = e.order;
    if (
      o &&
      (!["move", "attack", "gather", "build"].includes(o.mode) ||
        !coordinate(o) ||
        !Number.isFinite(o.retry) ||
        (o.target !== undefined && !Number.isInteger(o.target)) ||
        !o.path.every(coordinate))
    )
      throw Error("Invalid order");
  }
}
