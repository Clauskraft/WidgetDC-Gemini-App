export interface ErrorPageInfo {
  requestId?: string;
  message?: string;
  name?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderErrorPage(info: ErrorPageInfo = {}): string {
  const message = escapeHtml(info.message ?? "Something went wrong on our end.");
  const name = info.name ? escapeHtml(info.name) : "";
  const requestId = info.requestId ? escapeHtml(info.requestId) : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>This page didn't load</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #fafafa; color: #111; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 32rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
      p { color: #4b5563; margin: 0 0 1rem; }
      .detail { background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 0.75rem 1rem; margin: 0 0 1.5rem; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: #111; text-align: left; word-break: break-word; white-space: pre-wrap; }
      .detail strong { color: #b91c1c; }
      .meta { color: #6b7280; font-size: 12px; margin-top: 0.75rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 0.375rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: #111; color: #fff; }
      .secondary { background: #fff; color: #111; border-color: #d1d5db; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>This page didn't load</h1>
      <p>The server failed to render this page. Details are below for debugging.</p>
      <div class="detail"><strong>${name || "SSR error"}:</strong> ${message}${requestId ? `\n\nRequest ID: ${requestId}` : ""}</div>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Try again</button>
        <a class="secondary" href="/">Go home</a>
      </div>
    </div>
  </body>
</html>`;
}
