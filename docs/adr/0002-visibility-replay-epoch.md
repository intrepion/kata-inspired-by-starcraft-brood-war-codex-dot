# Versioned explored terrain and replay transition

Current sight is derived from living team sources; only explored terrain is durable. UI, orders and combat query the same boundary, preventing a visual fog mask from leaving invisible enemy IDs actionable. The renderer omits unseen entities entirely rather than retaining potentially misleading building snapshots.

An old command log was recorded under omniscient rules. Enabling new restrictions from tick zero would retroactively reject valid historical target orders and change the saved battle. V1 migration therefore records its saved tick as the rule transition; replay keeps old rules through that already-completed tick and enables fog afterward. The live migrated match immediately uses fog for new orders. This costs one small persisted epoch field, while retaining resources, queues, orders and replay history without resetting progress.
