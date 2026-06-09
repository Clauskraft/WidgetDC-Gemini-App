import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  requestId: z.string().min(1).max(128),
  limit: z.number().int().min(1).max(200).optional(),
});

export const fetchServerLogs = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("server_logs")
      .select("id, request_id, level, event, payload, created_at")
      .eq("request_id", data.requestId)
      .order("created_at", { ascending: true })
      .limit(data.limit ?? 50);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });
