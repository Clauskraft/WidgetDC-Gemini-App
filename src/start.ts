import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { logServer, newRequestId, summarizeError } from "./lib/server-logger";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    const requestId = newRequestId();
    const { name, message } = summarizeError(error);
    logServer("error", { event: "ssr.middleware", requestId }, error);
    return new Response(renderErrorPage({ requestId, name, message }), {
      status: 500,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "x-request-id": requestId,
      },
    });
  }
});


export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware],
}));
