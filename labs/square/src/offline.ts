/**
 * Offline support, so the Lab can test Square's offline mode:
 * - the start page builds the Square link in the browser (no server round trip),
 * - a service worker keeps copies of the start page and a callback page,
 * - anything that happens offline waits in an outbox (localStorage) and is sent to /report
 *   when signal returns.
 * The browser code is plain JS in strings because the Lab has no client build.
 */
import type { Hono } from "hono";
import { html, raw } from "hono/html";
import { log, type LabEnv } from "./log";
import { page } from "./page";

const CACHE = "square-lab-v1";

/** Outbox shared by the start page and the offline callback page. */
const outbox = `
const OUTBOX = "square-lab-outbox";
function readOutbox() { try { return JSON.parse(localStorage.getItem(OUTBOX) || "[]"); } catch { return []; } }
function queue(entry) {
  const box = readOutbox();
  box.push({ ...entry, id: crypto.randomUUID(), clientAt: new Date().toISOString(), online: navigator.onLine });
  try { localStorage.setItem(OUTBOX, JSON.stringify(box)); } catch {}
}
let flushing = null;
function flush() {
  flushing ??= send().finally(() => (flushing = null));
  return flushing;
}
async function send() {
  const box = readOutbox();
  if (!box.length || !navigator.onLine) return;
  try {
    const res = await fetch("/report", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(box) });
    if (res.ok) {
      const left = readOutbox().slice(box.length);
      localStorage.setItem(OUTBOX, JSON.stringify(left));
      const el = document.getElementById("outbox");
      if (el) el.textContent = "Sent " + box.length + " saved result(s) to the log.";
    }
  } catch {}
}
addEventListener("online", flush);
addEventListener("load", flush);
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
`;

/** Start page: build the iPad link here so "Open Square" works with no signal. */
export function chargeScript(appId: string, callbackUrl: string) {
  return html`<p id="outbox" class="muted"></p>
    <script>
      ${raw(outbox)};
      const CFG = ${raw(JSON.stringify({ appId, callbackUrl }))};
      document.getElementById("charge").addEventListener("submit", (e) => {
        if (/Android/i.test(navigator.userAgent)) return; // Android uses the server form
        e.preventDefault();
        const fd = new FormData(e.target);
        const cents = Math.round(Number(String(fd.get("amount")).replace(/[$,\\s]/g, "")) * 100);
        if (!(cents > 0)) return alert("Enter an amount.");
        const ref = "lab-" + Date.now().toString(36);
        const notes = [String(fd.get("notes") || "").trim(), ref].filter(Boolean).join(" · ");
        const data = {
          amount_money: { amount: cents, currency_code: "USD" },
          callback_url: CFG.callbackUrl,
          client_id: CFG.appId,
          version: "1.3",
          notes,
          state: ref,
          options: {
            supported_tender_types: ["CREDIT_CARD"],
            skip_receipt: Boolean(fd.get("skipReceipt")),
            auto_return: true,
          },
        };
        const url =
          "square-commerce-v1://payment/create?data=" + encodeURIComponent(JSON.stringify(data));
        queue({
          kind: "charge_started",
          ref,
          summary:
            "$" +
            (cents / 100).toFixed(2) +
            " · CREDIT_CARD" +
            (navigator.onLine ? "" : " · OFFLINE"),
          payload: { request: data, ios: url, userAgent: navigator.userAgent },
        });
        // Open Square right away; never make the button wait on the network.
        location.href = url;
        void flush();
      });
    </script>`;
}

/** Shown in place of /callback when there's no signal: reads Square's answer in the browser. */
const offlineCallback = page(
  "Payment result (saved offline)",
  html`<section class="panel">
      <h2 id="title">Reading Square's answer…</h2>
      <p>No signal, so this result is saved on this device and sent to the log later.</p>
      <pre id="data"></pre>
      <p id="outbox" class="muted"></p>
      <a class="btn" href="/">Another test</a>
    </section>
    <script>
      ${raw(outbox)};
      const params = new URLSearchParams(location.search);
      let d = {};
      try {
        d = JSON.parse(params.get("data") || "{}");
      } catch {}
      const ok = d.status === "ok";
      document.getElementById("title").textContent = ok
        ? "OK · order " +
          (d.transaction_id || "(none: offline?)") +
          " · client " +
          (d.client_transaction_id || "-")
        : "Not paid · " + (d.error_code || "unknown");
      document.getElementById("data").textContent = JSON.stringify(
        Object.fromEntries(params),
        null,
        2,
      );
      const seen = "seen:" + location.search;
      if (!sessionStorage.getItem(seen)) {
        sessionStorage.setItem(seen, "1");
        queue({
          kind: "callback",
          ref: d.state || null,
          summary: document.getElementById("title").textContent + " · OFFLINE",
          payload: { raw: Object.fromEntries(params), servedOffline: true },
        });
      }
      flush();
    </script>`,
);

/** Network first; with no signal, fall back to the saved pages. */
const serviceWorker = `
const CACHE = ${JSON.stringify(CACHE)};
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/", "/callback-offline"])).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  if (e.request.mode !== "navigate") return;
  const url = new URL(e.request.url);
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (url.pathname === "/" && res.ok && !res.redirected) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("/", copy));
        }
        return res;
      })
      .catch(async () => {
        const c = await caches.open(CACHE);
        if (url.pathname === "/callback") return c.match("/callback-offline");
        return (await c.match("/")) || Response.error();
      }),
  );
});
`;

interface Reported {
  id?: unknown;
  kind?: unknown;
  ref?: unknown;
  summary?: unknown;
  payload?: unknown;
  clientAt?: unknown;
  online?: unknown;
}

export function offlineRoutes(app: Hono<{ Bindings: LabEnv }>) {
  app.get("/sw.js", (c) =>
    c.body(serviceWorker, 200, {
      "content-type": "text/javascript",
      "cache-control": "no-cache",
    }),
  );

  app.get("/callback-offline", (c) => c.html(offlineCallback));

  /** The browser's outbox: things that happened on the device, possibly while offline. */
  app.post("/report", async (c) => {
    const entries = await c.req.json<Reported[]>().catch(() => null);
    if (!Array.isArray(entries) || entries.length > 50) return c.body(null, 400);
    for (const e of entries) {
      if (e.kind !== "charge_started" && e.kind !== "callback") continue;
      if (typeof e.id !== "string") continue;
      // A page can resend if it was closed mid-send; skip what's already logged.
      const dup = await c.env.DB.prepare(
        "SELECT 1 FROM events WHERE json_extract(payload, '$.entryId') = ?",
      )
        .bind(e.id)
        .first();
      if (dup) continue;
      await log(
        c.env,
        e.kind,
        typeof e.ref === "string" ? e.ref : null,
        typeof e.summary === "string" ? e.summary.slice(0, 200) : "",
        { entryId: e.id, device: e.payload, clientAt: e.clientAt, onlineWhenSaved: e.online },
      );
    }
    return c.body(null, 204);
  });
}
