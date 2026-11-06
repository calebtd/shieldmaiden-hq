-- Everything the lab sees: charges started, callbacks from the Square app,
-- API lookups, and webhooks. Kept raw so nothing is lost in interpretation.
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,       -- charge_started | callback | lookup | webhook
  ref TEXT,                 -- our reference for the test charge (Square "state"/metadata)
  at INTEGER NOT NULL,
  summary TEXT NOT NULL,
  payload TEXT NOT NULL
);
CREATE INDEX events_at ON events (at);
CREATE INDEX events_ref ON events (ref);
