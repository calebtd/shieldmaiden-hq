import { Hono } from "hono";
import { html, raw } from "hono/html";
import {
  androidChargeUrl,
  iosChargeUrl,
  parseCallback,
  parseDollars,
  type TenderType,
} from "./pos";
import { listRecentPayments, retrieveOrder, verifyWebhook, type SquareConfig } from "./square-api";
import { page } from "./page";
import { log, type LabEnv } from "./log";
import { chargeScript, offlineRoutes } from "./offline";

const app = new Hono<{ Bindings: LabEnv }>();

/** A single text field from a submitted form, or "" if missing. */
function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function squareConfig(env: LabEnv): SquareConfig | null {
  if (!env.SQUARE_ACCESS_TOKEN) return null;
  return { base: env.SQUARE_API_BASE, version: env.SQUARE_VERSION, token: env.SQUARE_ACCESS_TOKEN };
}

// ---- Start a test charge -------------------------------------------------------------

app.get("/", (c) => {
  const ready = Boolean(c.env.SQUARE_APP_ID);
  return c.html(
    page(
      "Square Lab",
      html`
        ${
          ready
            ? ""
            : html`<p class="banner">Set SQUARE_APP_ID in labs/square/wrangler.jsonc first.</p>`
        }
        <form id="charge" class="panel" method="post" action="/charge">
          <h2>Start a test charge</h2>
          <label>Amount <input name="amount" inputmode="decimal" value="1.00" required /></label>
          <label>Note (shows in Square) <input name="notes" value="Square Lab test" /></label>
          <p>Card only. Cash and Venmo are recorded in HQ, not Square.</p>
          <label class="check"
            ><input type="checkbox" name="skipReceipt" checked /> Skip receipt screen</label
          >
          <button class="primary" ${ready ? "" : "disabled"}>Open Square</button>
        </form>
        ${chargeScript(c.env.SQUARE_APP_ID, `${c.env.PUBLIC_URL}/callback`)} ${checklist}
      `,
    ),
  );
});

app.post("/charge", async (c) => {
  const form = await c.req.parseBody({ all: true });
  const amountCents = parseDollars(text(form.amount));
  if (!amountCents)
    return c.html(page("Square Lab", html`<p class="banner">Enter an amount.</p>`), 400);
  const ref = `lab-${Date.now().toString(36)}`;
  const req = {
    appId: c.env.SQUARE_APP_ID,
    callbackUrl: `${c.env.PUBLIC_URL}/callback`,
    amountCents,
    // Our reference rides in the note too, so it shows on Square's records and exports.
    notes: [text(form.notes).trim(), ref].filter(Boolean).join(" · "),
    ref,
    // Square is for cards only; cash and Venmo are recorded in HQ.
    tenderTypes: ["CREDIT_CARD"] as TenderType[],
    skipReceipt: Boolean(form.skipReceipt),
  };
  const ios = iosChargeUrl(req);
  const android = androidChargeUrl(req);
  await log(
    c.env,
    "charge_started",
    ref,
    `$${(amountCents / 100).toFixed(2)} · ${req.tenderTypes.join(", ")}`,
    {
      request: req,
      ios,
      android,
      userAgent: c.req.header("User-Agent"),
    },
  );

  const isAndroid = /Android/i.test(c.req.header("User-Agent") ?? "");
  return c.html(
    page(
      "Opening Square…",
      html`
        <section class="panel">
          <h2>Test ${ref}</h2>
          <p>If Square doesn't open by itself, tap the button for this device.</p>
          <a class="btn primary" href="${ios}">Open Square (iPhone / iPad)</a>
          <a class="btn" href="${android}">Open Square (Android)</a>
        </section>
        <script>
          location.href = ${raw(JSON.stringify(isAndroid ? android : ios))};
        </script>
      `,
    ),
  );
});

// ---- Square sends the browser back here ----------------------------------------------

app.get("/callback", async (c) => {
  const params = new URL(c.req.url).searchParams;
  const result = parseCallback(params);
  const summary = result.ok
    ? `OK · order ${result.transactionId ?? "(none: offline?)"} · client ${result.clientTransactionId ?? "-"}`
    : `Not paid · ${result.errorCode ?? "unknown"}`;
  await log(c.env, "callback", result.ref, summary, {
    parsed: result,
    raw: Object.fromEntries(params),
  });

  return c.html(
    page(
      result.ok ? "Payment done" : "Payment not completed",
      html`
        <section class="panel">
          <h2>${summary}</h2>
          <pre>${JSON.stringify(result, null, 2)}</pre>
          ${
            result.transactionId
              ? html`<form method="post" action="/lookup/order/${result.transactionId}">
                  <input type="hidden" name="ref" value="${result.ref ?? ""}" />
                  <button class="primary">Look up this order in Square (tip, tenders)</button>
                </form>`
              : ""
          }
          <a class="btn" href="/">Another test</a>
          <a class="btn" href="/log">See log</a>
        </section>
        <section class="panel">
          <h2>Everything Square sent</h2>
          <pre>${JSON.stringify(Object.fromEntries(params), null, 2)}</pre>
        </section>
      `,
    ),
  );
});

// ---- Ask Square's API what really happened --------------------------------------------

app.post("/lookup/order/:id", async (c) => {
  const cfg = squareConfig(c.env);
  if (!cfg)
    return c.html(
      page("Square Lab", html`<p class="banner">Set the SQUARE_ACCESS_TOKEN secret first.</p>`),
      400,
    );
  const form = await c.req.parseBody();
  const result = await retrieveOrder(cfg, c.req.param("id"));
  await log(c.env, "lookup", text(form.ref) || null, `Order ${c.req.param("id")}`, result);
  return c.html(
    page(
      "Order lookup",
      html`<section class="panel">
        <pre>${JSON.stringify(result, null, 2)}</pre>
        <a class="btn" href="/log">See log</a>
      </section>`,
    ),
  );
});

app.post("/lookup/recent", async (c) => {
  const cfg = squareConfig(c.env);
  if (!cfg)
    return c.html(
      page("Square Lab", html`<p class="banner">Set the SQUARE_ACCESS_TOKEN secret first.</p>`),
      400,
    );
  const result = await listRecentPayments(cfg);
  await log(c.env, "lookup", null, "Recent payments (24h)", result);
  return c.html(
    page(
      "Recent payments",
      html`<section class="panel">
        <pre>${JSON.stringify(result, null, 2)}</pre>
        <a class="btn" href="/log">See log</a>
      </section>`,
    ),
  );
});

// ---- Square webhooks (payments taken offline arrive here later) -----------------------

app.post("/webhook", async (c) => {
  const body = await c.req.text();
  const key = c.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  const valid = key
    ? await verifyWebhook(
        key,
        `${c.env.PUBLIC_URL}/webhook`,
        body,
        c.req.header("x-square-hmacsha256-signature") ?? null,
      )
    : false;
  let parsed: { type?: string; data?: { id?: string } } = {};
  try {
    parsed = JSON.parse(body) as typeof parsed;
  } catch {
    /* logged raw below */
  }
  await log(
    c.env,
    "webhook",
    null,
    `${parsed.type ?? "unknown"} · ${parsed.data?.id ?? ""} · signature ${valid ? "valid" : "INVALID"}`,
    {
      valid,
      body: parsed,
    },
  );
  return c.body(null, valid ? 200 : 401);
});

// ---- Everything that happened ---------------------------------------------------------

app.get("/log", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM events ORDER BY at DESC LIMIT 100",
  ).all<{
    id: number;
    kind: string;
    ref: string | null;
    at: number;
    summary: string;
    payload: string;
  }>();
  return c.html(
    page(
      "Square Lab log",
      html`
        <div class="row">
          <a class="btn" href="/">New test</a>
          <form method="post" action="/lookup/recent">
            <button>Look up recent payments</button>
          </form>
        </div>
        ${results.length === 0 ? html`<p class="banner">Nothing yet.</p>` : ""}
        ${results.map(
          (e) =>
            html`<details class="panel">
              <summary>
                <b>${e.kind}</b> ·
                ${new Date(e.at).toLocaleString("en-US", { timeZone: "America/Chicago" })} ·
                ${e.ref ?? ""}<br />${e.summary}
              </summary>
              <pre>${e.payload}</pre>
            </details>`,
        )}
      `,
    ),
  );
});

const checklist = html`
  <section class="panel">
    <h2>What to test</h2>
    <ol>
      <li>Card, no tip. Does Square return to this page with an order ID?</li>
      <li>Card with a tip on Square's screen. Does the order lookup show the tip?</li>
      <li>Start a charge, then cancel in Square. What error comes back?</li>
      <li>
        Offline: open this page once with signal (so the iPad keeps a copy), then turn on airplane
        mode and Square's offline payments. Take a card. Does Square come back here, and with what
        IDs? Turn signal back on and open this page: the saved results are sent to the log. Does a
        webhook arrive, and when?
      </li>
      <li>Same tests from an Android phone, if anyone uses one.</li>
      <li>Refund the test charges in Square afterward.</li>
    </ol>
  </section>
`;

offlineRoutes(app);

export default app;
