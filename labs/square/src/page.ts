import { html } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";

type Content = HtmlEscapedString | Promise<HtmlEscapedString>;

export function page(title: string, body: Content) {
  return html`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light dark" />
        <title>${title}</title>
        <style>
          :root {
            --bg: #ecebe4;
            --surface: #f7f6f1;
            --ink: #1f2e26;
            --muted: #56655a;
            --line: #d3d1c5;
            --accent: #3a5a40;
            --warn: #f6ebd4;
            --accent-ink: #fff;
          }
          @media (prefers-color-scheme: dark) {
            :root {
              --bg: #18231d;
              --surface: #213028;
              --ink: #ebe9e1;
              --muted: #a9b59d;
              --line: #344e41;
              --accent: #a3b18a;
              --warn: #3a2e14;
              --accent-ink: #18231d;
            }
          }
          * {
            box-sizing: border-box;
          }
          body {
            margin: 0;
            background: var(--bg);
            color: var(--ink);
            font:
              16px/1.45 system-ui,
              -apple-system,
              sans-serif;
          }
          main {
            max-width: 720px;
            margin: 0 auto;
            padding: 20px 16px 48px;
            display: grid;
            gap: 16px;
          }
          h1 {
            margin: 0;
            font-size: 1.5rem;
          }
          h2 {
            margin: 0;
            font-size: 1rem;
          }
          .panel {
            background: var(--surface);
            border: 1px solid var(--line);
            border-radius: 10px;
            padding: 16px;
            display: grid;
            gap: 12px;
          }
          .banner {
            background: var(--warn);
            border-radius: 10px;
            padding: 10px 14px;
            margin: 0;
          }
          label {
            display: grid;
            gap: 4px;
            color: var(--muted);
            font-size: 0.9rem;
          }
          label.check {
            display: flex;
            align-items: center;
            gap: 8px;
            color: var(--ink);
          }
          input:not([type="checkbox"]) {
            font: inherit;
            min-height: 48px;
            padding: 10px 12px;
            border: 1px solid var(--line);
            border-radius: 8px;
            background: var(--surface);
            color: var(--ink);
          }
          fieldset {
            border: 1px solid var(--line);
            border-radius: 8px;
            display: grid;
            gap: 6px;
          }
          button,
          .btn {
            font: inherit;
            min-height: 48px;
            padding: 10px 16px;
            border-radius: 8px;
            border: 1px solid var(--line);
            background: var(--surface);
            color: var(--ink);
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
          }
          .primary {
            background: var(--accent);
            border-color: var(--accent);
            color: var(--accent-ink);
          }
          .row {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
          }
          pre {
            white-space: pre-wrap;
            word-break: break-word;
            font-size: 0.8rem;
            margin: 0;
          }
          summary {
            cursor: pointer;
          }
        </style>
      </head>
      <body>
        <main>
          <h1>${title}</h1>
          ${body}
        </main>
      </body>
    </html>`;
}
