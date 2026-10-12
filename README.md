# Cinder Relay
An original compact science-fiction real-time strategy game. The Lumen Expedition and the autonomous Hollow Array fight over a signal site on Aster. One playable faction, one hand-designed battlefield, two AI difficulty settings. All visual assets are procedural Canvas art; original synthesized ambient tones and command signals use Web Audio. No runtime dependencies, paid services, or public deployment.

## Play
`npm ci && npm run build && python3 scripts/serve.py 5203`
Open http://127.0.0.1:5203. The launcher detaches a localhost-only server for this Mac session; no boot/login settings are changed. It refuses occupied ports. Server PID is in `.server.pid`; logs are in `server.log`. To restart after reboot, repeat `python3 scripts/serve.py 5203` from this directory. Build again after editing source.

## Field manual
Select by click or drag, Shift-click adds. Right-click ore to gather, enemies to attack, ground to move. Workers return finite cargo to the core. Select worker → Build → click valid site. A worker must stay nearby to finish construction; right-click an unfinished structure to resume it. Select core to train workers; foundries train combat units. Queues reserve supply immediately, are capped at five, and costs are paid once. Cancel refunds 75% of the last queued unit or unfinished building. Queue destruction loses invested ore.
Pylons add eight supply. Darts are fast and counter Mortars; Bulwarks counter Darts; Mortars counter Bulwarks and structures. Select army with 1; workers with W; A then click attack-moves; S stops; Escape cancels placement or toggles pause. Context commands also have buttons. Buildings and basalt walls block routes; blocked orders report failure. Units separate locally.
Hold the central relay uncontested with combat units for 60 cumulative seconds or destroy the enemy core. Own core loss is defeat. Enemy relay time persists too: contest early! Pause stops simulation. Save and Load use browser-local storage. New expedition opens the briefing; completed matches offer retry and command replay. Replay uses the original deterministic simulation, including AI. Midbattle reload: choose Continue saved expedition.

## Development
`npm run check` runs strict type checking, deterministic Node tests and build. `npm audit --audit-level=moderate` checks development tools. GitHub Actions repeats these checks. Source simulation is independent from rendering. Test seams and delegated choices are in docs/spec.md; language is in CONTEXT.md and GLOSSARY.md.

## Boundaries
No multiplayer, fog of war, technology tree, air units, multiple playable factions, touch-specific interface, or imported assets. This is a compact combined-arms RTS rather than a recreation of a commercial game. Local storage can be unavailable in restricted browser modes. Physical keyboard/mouse and audible sound require human device verification. Browser and simulation evidence is recorded in docs/verification.md.
