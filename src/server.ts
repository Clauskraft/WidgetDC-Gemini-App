import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { logServer, newRequestId, summarizeError } from "./lib/server-logger";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

function buildErrorResponse(error: unknown, requestId: string): Response {
  const { name, message } = summarizeError(error);
  return new Response(renderErrorPage({ requestId, name, message }), {
    status: 500,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "x-request-id": requestId,
    },
  });
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(
  response: Response,
  ctx: { requestId: string; method: string; url: string; startedAt: number },
): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  const captured = consumeLastCapturedError();
  const error = captured ?? new Error(`h3 swallowed SSR error: ${body}`);
  logServer(
    "error",
    {
      event: "ssr.h3_swallowed",
      requestId: ctx.requestId,
      method: ctx.method,
      url: ctx.url,
      status: 500,
      durationMs: Date.now() - ctx.startedAt,
    },
    error,
  );
  return buildErrorResponse(error, ctx.requestId);
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const requestId = request.headers.get("x-request-id") ?? newRequestId();
    const url = request.url;
    const method = request.method;
    const startedAt = Date.now();

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response, {
        requestId,
        method,
        url,
        startedAt,
      });
    } catch (error) {
      logServer(
        "error",
        {
          event: "ssr.unhandled",
          requestId,
          method,
          url,
          status: 500,
          durationMs: Date.now() - startedAt,
        },
        error,
      );
      return buildErrorResponse(error, requestId);
    }
  },
};
