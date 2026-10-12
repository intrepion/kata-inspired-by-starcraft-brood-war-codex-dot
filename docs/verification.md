# Verification — 2026-10-12

## Mac Chrome play through visible controls
Used the user's installed Chrome tab, normal buttons, pointer clicks/right-clicks/drag and browser keyboard events. No game-state injection or accelerated live matches.
- Training expedition: workers harvested and delivered ore; core queued two workers; supply pylon built; foundry queued Dart/Bulwark/Mortar; last queue cancellation returned 75%; paused simulation; manual save and page reload resumed economy, orders and unfinished queue. Army claimed relay; complete victory at 1:47 and 60 relay seconds. Victory screenshot retained.
- Earlier contested expedition reached defeat at 1:43; retry returned to briefing.
- Combined-arms assault: interrupted pylon construction by retasking workers, resumed it through right-click, then completed it (supply 5/18). Trained all three combat roles plus a second Bulwark. Five combat units attacked Hollow territory, suffered deaths, and released supply. AI harvested its initial field to depletion, expanded pylons, and claimed relay. Complete defeat at 4:04; finished save survived reload. Captured assault/aftermath and defeat.
- Entire saved 4:04 command replay ran to completion at 8× viewing speed. Final visible economy (1755 ore), supply (4/18), relay (0/60 hostile 60), time and outcome matched the recorded expedition. Replay screenshot retained. Replay speed changes viewing time only; every fixed step still runs.
- Follow-up visible regression flows: box-select four workers; repeated Move then Escape; Move then right-click followed by normal Core selection; Build then keyboard A spent no construction ore; Load during placement reset it and permitted normal selection. Unfinished pylon cancellation changed 320 → 250 → 302 ore. Queue cancellation also verified separately. Invalid placement over the core displayed its failure reason and spent no ore. Final compact briefing keeps both deployment controls visible at desktop and narrow sizes.
- Inspected screenshots at normal desktop and 640×900. Desktop command panel now scrolls independently and battlefield remains fixed within the viewport. Narrow layout stacks panels; touch gestures are not certified.
- Sound toggle activated without application error. Audibility and physical device input are untested because the Mac is locked. Native foreground inspection reported that lock; supported Chrome interactions remained available. No lock/security settings changed.
- Browser log review found extension warnings, with no game-origin application errors.

## Automated simulation and build
17 Node tests cover harvesting/depletion, placement cost/refunds, resumed construction/supply, reserved queue capacity/cancellation, production, unreachable movement/stop, three counter relationships, contested relay/victory, death/defeat, AI economy/production/expansion/objective, deterministic save/load and replay, long unattended defeat, coincident collisions, malformed saves and prototype-name rejection.
The stress test runs 30 seeded campaigns (up to 1600 steps each), mixing repeated/interrupted orders, invalid production/build attempts, cancellations and saves, asserting nonnegative economy/resources and exact replay entities. These are simulations, not browser play.
Strict TypeScript and production build pass. Development dependency audit: zero vulnerabilities. No runtime packages or network-fetched game assets. GitHub Actions repeats check and audit.

## Independent review and scope
See reviews.md for separate Standards and Spec reports and resolution of all reported findings. Grill with Docs and Implement were read locally, including their dependencies; delegated decisions replaced interviews and seam approval. Only the first economy tracer was written before its implementation; broader regression tests were added as functionality and review fixes evolved. No full interactive interview or universal test-first process is claimed.
One playable faction and a hostile AI using a shared roster, one map, two difficulties. Fog of war, multiple playable factions, multiplayer and touch-specific controls are outside scope. Browser core-destruction victory and physical audio/input were not tested; core destruction/defeat and all counter multipliers were checked through simulation. Collision separation is local steering with grid routing, not large-army formation simulation.

## Delivery
Session-only detached Python localhost server, port 5203 inspected/bound successfully with existing ports preserved; no login/boot registration. HTTP page and game asset verified after launcher returned. Final repository SHA and exact-commit CI are verified at delivery; see final response for their links.
