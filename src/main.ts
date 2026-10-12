import {
  createMatch,
  command,
  step,
  supply,
  specs,
  save,
  load,
  replay,
  combat,
  mobile,
  W,
  H,
  DT,
  type State,
  type Kind,
  type Point,
} from "./engine.js";
const $ = (id: string) => document.getElementById(id)!;
const canvas = $("map") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
let state = createMatch(),
  selected: number[] = [],
  active = false,
  paused = false,
  placement: Kind | undefined,
  attack = false,
  contextMove = false,
  drag: Point | undefined,
  pointer: Point = { x: 0, y: 0 },
  replaying: ReturnType<typeof replay> | undefined,
  storedReplay: State | undefined,
  replaySpeed = 8,
  sound = false,
  audio: AudioContext | undefined;
try {
  const previous = localStorage.getItem("cinder-last");
  if (previous) storedReplay = load(previous);
} catch {
  /* A corrupt prior replay does not block a new match. */
}
function tone(freq: number) {
  if (!sound) return;
  try {
    audio ??= new AudioContext();
    void audio.resume();
    const o = audio.createOscillator(),
      g = audio.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(freq, audio.currentTime);
    o.frequency.exponentialRampToValueAtTime(
      freq * 0.6,
      audio.currentTime + 0.12,
    );
    g.gain.setValueAtTime(0.04, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.18);
    o.connect(g);
    g.connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + 0.2);
  } catch {
    state.message = "Audio unavailable; visual play remains active.";
  }
}
function persist() {
  try {
    localStorage.setItem("cinder-save", save(state));
    state.message = "Expedition saved locally.";
  } catch {
    state.message = "Save storage unavailable.";
  }
}
function resetInput() {
  placement = undefined;
  attack = false;
  contextMove = false;
  drag = undefined;
  signature = "";
}
function restore() {
  try {
    state = load(localStorage.getItem("cinder-save") ?? "");
    selected = [];
    resetInput();
    active = true;
    paused = false;
    replaying = undefined;
    $("overlay").classList.add("hidden");
  } catch {
    state.message = "No valid save found.";
  }
}
function issue(c: Parameters<typeof command>[1]) {
  if (c.type === "stop") resetInput();
  if (!active || paused || replaying) return;
  command(state, c);
  tone(240);
  renderUI();
}
function start() {
  state = createMatch(
    ($("difficulty") as HTMLSelectElement).value as State["difficulty"],
  );
  selected = [];
  resetInput();
  active = true;
  paused = false;
  placement = undefined;
  contextMove = false;
  attack = false;
  replaying = undefined;
  $("overlay").classList.add("hidden");
  tone(420);
  renderUI();
}
$("start").onclick = start;
$("continue").onclick = restore;
$("save").onclick = () => {
  persist();
  renderUI();
};
$("load").onclick = restore;
$("audio").onclick = () => {
  sound = !sound;
  $("audio").textContent = sound ? "Sound on" : "Sound off";
  tone(360);
};
$("pause").onclick = () => {
  if (active) {
    paused = !paused;
    renderUI();
  }
};
$("restart").onclick = () => {
  if (active && !replaying) storedReplay = structuredClone(state);
  active = false;
  paused = false;
  resetInput();
  replaying = undefined;
  $("overlay").innerHTML = initialOverlay;
  $("overlay").classList.remove("hidden");
  $("start").onclick = start;
  $("continue").onclick = restore;
};
const initialOverlay = $("overlay").innerHTML;
$("replay-speed").onclick = () => {
  replaySpeed = replaySpeed === 8 ? 1 : 8;
  $("replay-speed").textContent = `Replay ${replaySpeed}×`;
};
$("replay").onclick = () => {
  const s = storedReplay ?? state;
  if (!s.tick) {
    state.message = "Play a match before replaying.";
    return;
  }
  replaying = replay(s);
  state = replaying.state;
  selected = [];
  resetInput();
  active = true;
  paused = false;
  $("overlay").classList.add("hidden");
};
function selectAll(kind: "army" | "workers" | "home") {
  selected = state.entities
    .filter(
      (e) =>
        e.team === 0 &&
        (kind === "army"
          ? combat(e)
          : kind === "workers"
            ? e.kind === "worker"
            : e.kind === "core"),
    )
    .map((e) => e.id);
  renderUI();
}
$("army").onclick = () => selectAll("army");
$("workers").onclick = () => selectAll("workers");
$("home").onclick = () => selectAll("home");
function point(e: PointerEvent) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) / r.width) * W,
    y: ((e.clientY - r.top) / r.height) * H,
  };
}
function order(p: Point) {
  const target =
    state.entities.find(
      (e) => Math.hypot(e.x - p.x, e.y - p.y) < (mobile(e) ? 0.65 : 1),
    ) ?? state.nodes.find((n) => Math.hypot(n.x - p.x, n.y - p.y) < 1);
  issue({
    type: "order",
    ids: selected,
    x: p.x,
    y: p.y,
    target: target?.id,
    attack,
  });
  attack = false;
  contextMove = false;
}
canvas.oncontextmenu = (e) => e.preventDefault();
canvas.onpointerdown = (e) => {
  if (!active || paused || replaying) return;
  canvas.focus();
  const p = point(e);
  if (e.button === 2) {
    order(p);
    return;
  }
  if (e.button !== 0) return;
  if (placement) {
    issue({ type: "build", ids: selected, kind: placement, x: p.x, y: p.y });
    placement = undefined;
    return;
  }
  if (attack || contextMove) {
    order(p);
    contextMove = false;
    return;
  }
  drag = p;
  pointer = p;
  canvas.setPointerCapture(e.pointerId);
};
canvas.onpointermove = (e) => {
  pointer = point(e);
};
canvas.onpointerup = (e) => {
  if (!drag) return;
  const p = point(e),
    d = Math.hypot(p.x - drag.x, p.y - drag.y);
  const chosen = state.entities
    .filter(
      (a) =>
        a.team === 0 &&
        (d < 0.3
          ? Math.hypot(a.x - p.x, a.y - p.y) < (mobile(a) ? 0.7 : 1)
          : mobile(a) &&
            a.x >= Math.min(drag!.x, p.x) &&
            a.x <= Math.max(drag!.x, p.x) &&
            a.y >= Math.min(drag!.y, p.y) &&
            a.y <= Math.max(drag!.y, p.y)),
    )
    .map((a) => a.id);
  selected = e.shiftKey ? [...new Set([...selected, ...chosen])] : chosen;
  drag = undefined;
  renderUI();
};
canvas.onpointercancel = () => {
  drag = undefined;
};
window.onkeydown = (e) => {
  if (e.target instanceof HTMLSelectElement) return;
  const k = e.key.toLowerCase();
  if (k === "1") selectAll("army");
  if (k === "w") selectAll("workers");
  if (k === "a") {
    placement = undefined;
    contextMove = false;
    attack = true;
    state.message = "Attack-move: click a destination.";
  }
  if (k === "s") issue({ type: "stop", ids: selected });
  if (k === "escape") {
    if (placement || attack || contextMove) {
      placement = undefined;
      attack = false;
      contextMove = false;
    } else $("pause").click();
  }
  renderUI();
};
let signature = "";
function renderUI() {
  selected = selected.filter((id) => state.entities.some((e) => e.id === id));
  const es = state.entities.filter((e) => selected.includes(e.id)),
    first = es[0],
    su = supply(state, 0);
  $("economy").innerHTML =
    `ORE <b>${Math.floor(state.ore[0])}</b> &nbsp; SUPPLY <b>${su.used}/${su.cap}</b><br><small>Relay: ${state.relay[0].toFixed(1)} / 60s · Hostile: ${state.relay[1].toFixed(1)}s</small>`;
  $("clock").textContent =
    `${Math.floor(state.tick / 600)}:${String(Math.floor(state.tick / 10) % 60).padStart(2, "0")}`;
  $("status").textContent = replaying
    ? paused && state.tick >= replaying.end
      ? "REPLAY COMPLETE · choose New expedition"
      : "REPLAY · recorded expedition"
    : paused
      ? "PAUSED · simulation frozen"
      : placement
        ? `Place ${placement}: click a clear site. Escape cancels.`
        : state.message;
  $("pause").textContent = paused ? "Resume" : "Pause";
  ($("save") as HTMLButtonElement).disabled = !!replaying;
  $("replay-speed").hidden = !replaying;
  $("selection").textContent =
    es.length > 1
      ? `${es.length} units selected`
      : first
        ? first.kind[0].toUpperCase() + first.kind.slice(1)
        : "No selection";
  $("details").textContent = first
    ? `Integrity ${Math.ceil(first.hp)} / ${specs[first.kind].hp}${first.progress < 1 ? ` · Building ${Math.floor(first.progress * 100)}%` : ""}${first.queue.length ? ` · Queue: ${first.queue.join(" → ")} (${Math.floor((first.production / specs[first.queue[0]].time) * 100)}%)` : ""}`
    : "Click a unit or drag a box around your forces.";
  const key = es.map((e) => e.kind).join(",") + paused + !!replaying;
  if (key !== signature) {
    signature = key;
    const commands = $("commands");
    commands.replaceChildren();
    function button(label: string, fn: () => void) {
      const b = document.createElement("button");
      b.textContent = label;
      b.disabled = paused || !!replaying;
      b.onclick = fn;
      commands.append(b);
    }
    if (es.some((e) => mobile(e))) {
      button("Move / interact → click destination", () => {
        attack = false;
        contextMove = true;
        placement = undefined;
        state.message = "Click destination (or right-click).";
      });
      button("Attack-move [A] → click destination", () => {
        attack = true;
        contextMove = false;
        placement = undefined;
        state.message = "Click destination to attack-move.";
      });
      button("Stop [S]", () => issue({ type: "stop", ids: selected }));
    }
    if (first?.kind === "worker") {
      for (const k of ["foundry", "pylon", "sentry"] as Kind[])
        button(`Build ${k} · ${specs[k].cost} ore`, () => {
          placement = k;
          attack = false;
          contextMove = false;
          renderUI();
        });
    }
    if (first && (first.kind === "core" || first.kind === "foundry")) {
      for (const k of (first.kind === "core"
        ? ["worker"]
        : ["dart", "bulwark", "mortar"]) as Kind[])
        button(
          `Train ${k} · ${specs[k].cost} ore · ${specs[k].supply} supply`,
          () => issue({ type: "train", ids: [first.id], kind: k }),
        );
    }
    if (first)
      button("Cancel last queue / construction · 75% refund", () =>
        issue({ type: "cancel", ids: [first.id] }),
      );
  }
}
function draw() {
  const scale = 40;
  ctx.clearRect(0, 0, 1280, 800);
  ctx.fillStyle = "#172630";
  ctx.fillRect(0, 0, 1280, 800);
  for (let x = 0; x < W; x++)
    for (let y = 0; y < H; y++) {
      ctx.fillStyle = (x * 13 + y * 7) % 9 === 0 ? "#1b2e36" : "#182932";
      ctx.fillRect(x * scale + 1, y * scale + 1, 38, 38);
      if ((x === 15 || x === 16) && (y < 6 || y > 14)) {
        ctx.fillStyle = "#33414a";
        ctx.beginPath();
        ctx.moveTo(x * 40, y * 40 + 40);
        ctx.lineTo(x * 40 + 8, y * 40 + 8);
        ctx.lineTo(x * 40 + 30, y * 40);
        ctx.lineTo(x * 40 + 40, y * 40 + 32);
        ctx.fill();
      }
    }
  ctx.strokeStyle = "#95af9a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(640, 400, 108, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#84968d";
  ctx.font = "11px monospace";
  ctx.textAlign = "center";
  ctx.fillText("ASTER RELAY", 640, 536);
  ctx.save();
  ctx.translate(640, 400);
  ctx.rotate(state.tick * 0.005);
  ctx.strokeStyle = "#c0d6a5";
  ctx.strokeRect(-20, -20, 40, 40);
  ctx.restore();
  for (const n of state.nodes) {
    const x = n.x * 40,
      y = n.y * 40;
    ctx.fillStyle = n.amount ? "#48bfbf" : "#3a4c56";
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(x - 23 + i * 13, y + 12);
      ctx.lineTo(x - 16 + i * 13, y - 14 - (i % 2) * 10);
      ctx.lineTo(x - 8 + i * 13, y + 12);
      ctx.fill();
    }
    ctx.font = "10px monospace";
    ctx.fillStyle = "#80c6c8";
    ctx.fillText(String(Math.floor(n.amount)), x, y + 30);
  }
  for (const e of state.entities) {
    const x = e.x * 40,
      y = e.y * 40,
      c = e.team === 0 ? "#76edd5" : "#f19579";
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = e.progress < 1 ? 0.45 : 1;
    ctx.shadowColor = c;
    ctx.shadowBlur = 5;
    ctx.fillStyle = e.team === 0 ? "#284f50" : "#623e37";
    ctx.strokeStyle = c;
    ctx.lineWidth = 2;
    if (selected.includes(e.id)) {
      ctx.strokeStyle = "#effed0";
      ctx.beginPath();
      ctx.ellipse(
        0,
        8,
        mobile(e) ? 20 : 43,
        mobile(e) ? 12 : 27,
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
      ctx.strokeStyle = c;
    }
    ctx.beginPath();
    if (!mobile(e)) {
      ctx.roundRect(-30, -27, 60, 54, 5);
      ctx.fill();
      ctx.stroke();
      ctx.strokeRect(-18, -15, 36, 30);
      if (e.kind === "core") {
        ctx.beginPath();
        ctx.moveTo(0, -20);
        ctx.lineTo(16, 0);
        ctx.lineTo(0, 20);
        ctx.lineTo(-16, 0);
        ctx.closePath();
        ctx.fillStyle = c;
        ctx.fill();
      }
      if (e.kind === "foundry") {
        ctx.fillStyle = c;
        ctx.fillRect(-20, -7, 40, 14);
      }
      if (e.kind === "pylon") {
        ctx.fillStyle = c;
        ctx.fillRect(-5, -23, 10, 46);
      }
      if (e.kind === "sentry") {
        ctx.strokeStyle = c;
        ctx.beginPath();
        ctx.moveTo(-12, 0);
        ctx.lineTo(23, -14);
        ctx.stroke();
      }
    } else {
      const r = e.kind === "bulwark" ? 17 : e.kind === "mortar" ? 15 : 12;
      ctx.moveTo(0, -r);
      ctx.lineTo(r, r * 0.7);
      ctx.lineTo(0, r * 0.35);
      ctx.lineTo(-r, r * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = c;
      ctx.fillRect(-3, -5, 6, 8);
      if (e.kind === "mortar") {
        ctx.fillRect(-2, -23, 4, 22);
      }
      if (e.kind === "worker") {
        ctx.fillStyle = e.cargo ? "#ffc973" : c;
        ctx.fillRect(8, -3, 7, 7);
      }
    }
    ctx.shadowBlur = 0;
    if (selected.includes(e.id)) {
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = c;
      ctx.fillText(e.kind.toUpperCase(), 0, -(mobile(e) ? 30 : 40));
    }

    ctx.fillStyle = "#081319";
    ctx.fillRect(-20, 34, 40, 4);
    ctx.fillStyle = c;
    ctx.fillRect(-20, 34, 40 * Math.max(0, e.hp / specs[e.kind].hp), 4);
    if (e.progress < 1) {
      ctx.fillStyle = "#ffd287";
      ctx.fillRect(-25, 42, 50 * e.progress, 3);
    }
    ctx.restore();
    if (e.cooldown > (e.kind === "mortar" ? 1.6 : 0.6)) {
      const target = state.entities
        .filter(
          (a) =>
            a.team !== e.team &&
            Math.hypot(a.x - e.x, a.y - e.y) <= specs[e.kind].range,
        )
        .sort(
          (a, b) =>
            Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y),
        )[0];
      if (target) {
        ctx.strokeStyle = c;
        ctx.lineWidth = e.kind === "mortar" ? 4 : 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(target.x * 40, target.y * 40);
        ctx.stroke();
      }
    }
    if (selected.includes(e.id) && e.order) {
      ctx.strokeStyle = "#83d9ca66";
      ctx.setLineDash([5, 7]);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(e.order.x * 40, e.order.y * 40);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  if (drag) {
    ctx.strokeStyle = "#b5ffee";
    ctx.fillStyle = "#76edd520";
    ctx.fillRect(
      drag.x * 40,
      drag.y * 40,
      (pointer.x - drag.x) * 40,
      (pointer.y - drag.y) * 40,
    );
    ctx.strokeRect(
      drag.x * 40,
      drag.y * 40,
      (pointer.x - drag.x) * 40,
      (pointer.y - drag.y) * 40,
    );
  }
  if (placement) {
    ctx.strokeStyle = "#fff2a8";
    ctx.strokeRect(
      Math.round(pointer.x) * 40 - 30,
      Math.round(pointer.y) * 40 - 27,
      60,
      54,
    );
  }
  ctx.fillStyle = "#96c7c5";
  ctx.font = "12px monospace";
  ctx.textAlign = "left";
  ctx.fillText("LUMEN LANDING", 32, 750);
  ctx.textAlign = "right";
  ctx.fillStyle = "#c99480";
  ctx.fillText("HOLLOW ARRAY", 1248, 750);
}
let last = performance.now(),
  acc = 0,
  lastUI = 0,
  lastSound = 0;
function frame(now: number) {
  acc += Math.min(0.25, (now - last) / 1000) * (replaying ? replaySpeed : 1);
  last = now;
  if (active && !paused) {
    while (acc >= DT) {
      if (replaying) {
        while (
          replaying.index < replaying.log.length &&
          replaying.log[replaying.index].tick === state.tick
        )
          command(state, replaying.log[replaying.index++].command, 0, false);
        if (state.tick >= replaying.end) {
          paused = true;
          state.message = "Replay complete.";
          break;
        }
      }
      step(state);
      acc -= DT;
      if (!replaying && state.tick % 100 === 0) {
        try {
          localStorage.setItem("cinder-save", save(state));
        } catch {
          /* Manual save reports storage errors. */
        }
      }
    }
    if (!replaying && state.winner !== null) {
      active = false;
      storedReplay = structuredClone(state);
      try {
        localStorage.setItem("cinder-last", save(state));
      } catch {
        /* Replay remains available in this session. */
      }
      persist();
      $("overlay").innerHTML =
        `<div class="brief"><span class="eyebrow">EXPEDITION REPORT</span><h2>${state.winner === 0 ? "Signal secured." : "Signal lost."}</h2><p>${state.winner === 0 ? "Your expedition has won control of Aster." : "The Hollow Array prevailed. Expand supply early, protect your workers, and mix combat roles."}</p><button id="retry" class="primary">Deploy again</button><button id="watch">Watch replay</button></div>`;
      $("overlay").classList.remove("hidden");
      $("retry").onclick = () => {
        $("restart").click();
      };
      $("watch").onclick = () => {
        $("replay").click();
      };
      tone(state.winner === 0 ? 520 : 120);
    }
  } else acc = 0;
  if (now - lastUI > 150) {
    renderUI();
    lastUI = now;
  }
  if (sound && active && !paused && now - lastSound > 2200) {
    tone([110, 146.8, 164.8, 220][Math.floor(state.tick / 22) % 4]);
    lastSound = now;
  }
  draw();
  requestAnimationFrame(frame);
}
renderUI();
requestAnimationFrame(frame);
