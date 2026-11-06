-- The single row every write bumps (see src/server/sync/version.ts).
INSERT INTO `sync_counter` (`id`, `value`) VALUES (1, 0);
--> statement-breakpoint
-- Identifies this copy of the data; devices reset their local copy when it changes.
INSERT INTO `server_meta` (`key`, `value`) VALUES ('epoch', lower(hex(randomblob(8))));
