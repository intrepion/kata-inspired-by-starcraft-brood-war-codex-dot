# Scouting and fog — focused correction

2026-10-15. Exact audited repository: `task-19/kata-inspired-by-starcraft-brood-war-codex-dot`, baseline `a58867a85124aea10f6adbcb9042896186ec066c`, clean at reinspection. Existing Python preview PID 47971 at http://localhost:5203 was preserved.

## Source and settled contract

Read [Blizzard's original Reconnaissance guide](https://classic.battle.net/scc/GS/recon.shtml) before planning: locate the opponent, periodically inspect enemy production and forces, and weigh worker/army scouting against economic and defensive costs. This correction makes that information require current sight. Black unexplored cells and dim explored terrain use the audit's established fog baseline. No original executable or quantitative sight-radius comparison was run.

Grill with Docs/Implement defaults are delegated by the user; the public seams remain `createMatch`, `command`, `step`, `save/load` and `replay`. New observations are `canSee`, `fogAt` and `visibleEntities`. No new dependency or remote assets. No commit/push.

- Living friendly units/buildings provide shared current sight for each team. Authored radii range from 5–7 tiles (unfinished structures: 3), keeping weapon range within own sight.
- Enemy units, structures, health and construction disappear immediately outside current sight. Only explored terrain is retained; there are no building-memory ghosts. Unseen ore displays no live amount/depletion state.
- UI targeting, explicit enemy-ID orders and automatic combat use the same visibility rule. A lost attack target becomes a ground order toward its last observed coordinates. Movement and attack-move can scout unknown terrain; construction requires observing the site.
- V2 saves persist validated two-team explored grids. V1 loads retain economy, entities, production, orders, winner and command log, initialize exploration around current living sources, and record the migration tick. A replay runs historical rules through the already-simulated migration tick, then adopts fog. This avoids changing old logged target orders retroactively.

## Checks and status

Final original-checkout strict typecheck, **26/26 Node tests and production build passed**, including the retained economy/production/combat/save/AI/replay suite and nine new fog cases. A source-simulation command route sends the initial Dart into enemy vision and back, proving reveal, retreat concealment and retained explored ground. Explicit hidden target IDs are rejected for both teams; losing the spotting unit drops tracking. Save-grid validation, complete v1 migration and old/new replay determinism are exercised.

The new vision update visits only cells within each source radius; the full suite, including 30 interrupted campaign/replay seeds, completed in 4.38 s. Independent review passed with no remaining blockers. Normal-input browser acceptance passed after the renewed unlock and exclusive handoff, as recorded below. Native acceptance is recorded below; no preview restart was needed.

## Normal-input route

1. New expedition → Training → Deploy. Verify the right side and enemy base start black; home troops and nearby cyan ore remain visible.
2. Select the initial Dart at logical canvas `(240,520)` = world `(6,13)`. Right-click ground near `(960,520)` = `(24,13)`; allow about 7.5 s. Observe revealed red Dart, enemy foundry/core, their current health and surrounding terrain. Pause while inspecting if needed so the scout does not wait under fire.
3. Resume and right-click back at `(240,520)`; allow about 9 s. Verify red troops/structures disappear and the traversed frontier stays dim. Clicking hidden troop positions must issue ground movement, not a target-ID attack. Clicking dim ore must not expose its live count.
4. Use W to select workers and right-click home ore `(200,240)`. Train a Dart at the foundry; build supply if needed. Move the army through the visible central corridor, attack-move onto the relay and contest to a match outcome. New expedition is available if the first scout is lost.
5. Save after exploring, reload/Continue and verify the explored frontier remains dim with current friendly sight restored. Watch a completed replay and verify fog follows the same scouting path.

Coordinates are relative to the 1280×800 canvas; scale to its actual visible rectangle. These are acceptance instructions, not browser evidence.

## Limits and remaining work

Fixed whole-map camera, circular sight and authored range values; no high-ground/cover occlusion, detectors/cloak, second resource, tech/faction expansion, air units or control groups. Relay timers remain public objective information. Independent review and the final production build passed; normal-input browser acceptance passed as recorded below. Automated simulation is not E2E browser acceptance.

## Independent review corrections

All four reported P2 issues are corrected: historical target coordinates remain unchanged through the pre-fog epoch (covered by a v1 fixture generated from baseline HEAD, with a Dart targeting a moving enemy worker for 30 ticks); saving is pure and exploration records domain transitions, including same-tick construction/cancellation; ground paths ignore unseen enemy structures and resolve physical blockers after scouting reveals them. Added regressions cover each reported reproduction. Final original-checkout `npm run check` passed: strict typecheck, all 26 tests and production build (37.4 kB bundle, esbuild 10 ms). Parent-coordinated native acceptance passed as recorded below. The final baseline tick-200 AI regression also verifies no pre-movement exploration leaks at the migration epoch.

## Native browser acceptance passed — 2026-10-15

The earlier 17:08 UTC locked-Mac inventory is historical. After the user confirmed unlock and the parent explicitly regranted exclusive access at 17:30 UTC, native inventory succeeded. The worker used only its new tab `222225564` at `http://fidelity-gta-worker-20261015.localhost:5203/`. Existing user/root/Witness tabs, original save origins and preview listeners were preserved. No game-state/model/DOM event injection or clock manipulation was used.

Native Training scout reveal at 0:08 → alive retreat/concealment at 0:14 → Save/browser Reload/Continue restored the explored frontier. Normal worker harvesting and three trained Darts led to a 60-second relay hold and Signal secured at 1:36 (1,265 ore, 8/10 supply, scout 53/80). A normal 1× replay showed the same reveal and concealment; 8× replay completed at 1:36 with identical outcome.

Fixed whole-map top-down camera and native click/right-click, W/1/A/Escape plus Save/Continue/replay controls were exercised. Historical migration edge cases remain source-test evidence. No source fix, test/build rerun or preview restart was required by native QA.

See [detailed local acceptance](LOCAL_ACCEPTANCE_2026-10-15.md) and the [screenshots and acceptance record](LOCAL_ACCEPTANCE_2026-10-15.md). Simulated guides and historical fixtures remain source-only evidence; the native results above are a separate observed pass. After all four projects, the worker closed only its own QA tab and explicitly released native ownership.
