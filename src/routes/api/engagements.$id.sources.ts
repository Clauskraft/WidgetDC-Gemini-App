/**
 * GET  /api/engagements/$id/sources — list pinned AssemblyBlocks for this engagement.
 * POST /api/engagements/$id/sources — pin an AssemblyBlock as a source.
 *   Body: { block_id?: string; text?: string; source_label?: string }
 *   If block_id is provided, creates HAS_SOURCE edge Engagement→AssemblyBlock (idempotent MERGE).
 *   If text is provided (no block_id), creates a new AssemblyBlock from the text and links it.
 * DELETE /api/engagements/$id/sources/:block_id — unpin (not implemented here, extend as needed).
 */
import { createFileRoute } from "@tanstack/react-router";
import { callMcpTool } from "@/lib/widgetdc.server";

export type PinnedSource = {
  id: string;
  title: string | null;
  content_preview: string;
  domain: string | null;
  quality_score: number;
  pinned_at: string | null;
};

export type EngagementSourcesResponse = {
  sources: PinnedSource[];
  total: number;
  error?: string;
};

export type PinSourceBody = {
  block_id?: string;
  text?: string;
  source_label?: string;
};

export type PinSourceResponse = {
  pinned: boolean;
  block_id: string;
  error?: string;
};

function jsonRes(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/engagements/$id/sources")({
  server: {
    handlers: {
      GET: async ({ params }: { params: { id: string } }) => {
        const engId = params.id?.trim();
        if (!engId) {
          return jsonRes(
            { sources: [], total: 0, error: "id påkrævet" } satisfies EngagementSourcesResponse,
            400,
          );
        }

        const result = await callMcpTool<unknown>(
          "data_graph_read",
          {
            query: `
              MATCH (e:Engagement {id: $eid})-[:HAS_SOURCE]->(ab:AssemblyBlock)
              WHERE ab.content IS NOT NULL
              RETURN
                coalesce(ab.id, toString(id(ab))) AS id,
                ab.title AS title,
                ab.content[..200] AS content_preview,
                ab.domain AS domain,
                coalesce(ab.quality_score, 0.5) AS quality_score,
                toString(ab.pinned_at) AS pinned_at
              ORDER BY ab.pinned_at DESC, quality_score DESC
              LIMIT 20
            `,
            params: { eid: engId },
          },
          { timeoutMs: 8000 },
        ).catch(() => null);

        if (result == null) {
          return jsonRes(
            {
              sources: [],
              total: 0,
              error: "Platform utilgængeligt",
            } satisfies EngagementSourcesResponse,
            503,
          );
        }

        const r = result as Record<string, unknown>;
        const inner = (r.result as Record<string, unknown>) ?? r;
        const raw = inner.results ?? inner.rows ?? inner.records ?? inner.data;
        const rows = Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : [];

        const sources: PinnedSource[] = rows.map((row) => ({
          id: String(row.id ?? ""),
          title: row.title != null ? String(row.title).slice(0, 120) : null,
          content_preview: String(row.content_preview ?? ""),
          domain: row.domain != null ? String(row.domain) : null,
          quality_score: typeof row.quality_score === "number" ? row.quality_score : 0.5,
          pinned_at: row.pinned_at != null ? String(row.pinned_at) : null,
        }));

        return jsonRes({ sources, total: sources.length } satisfies EngagementSourcesResponse, 200);
      },

      POST: async ({ request, params }: { request: Request; params: { id: string } }) => {
        const engId = params.id?.trim();
        if (!engId) {
          return jsonRes(
            { pinned: false, block_id: "", error: "id påkrævet" } satisfies PinSourceResponse,
            400,
          );
        }

        let body: PinSourceBody;
        try {
          body = (await request.json()) as PinSourceBody;
        } catch {
          return jsonRes(
            { pinned: false, block_id: "", error: "Ugyldig JSON" } satisfies PinSourceResponse,
            400,
          );
        }

        let blockId = body.block_id?.trim() ?? "";

        // If no block_id but text provided: create an AssemblyBlock from the text
        if (!blockId && body.text?.trim()) {
          const text = body.text.trim().slice(0, 2000);
          const label = body.source_label?.trim() ?? text.slice(0, 80);
          blockId = `pinned-${crypto.randomUUID()}`;

          const createResult = await callMcpTool<unknown>(
            "data_graph_read",
            {
              query: `
                MERGE (ab:AssemblyBlock {id: $id})
                SET
                  ab.content = $content,
                  ab.title = $title,
                  ab.source = "pinned",
                  ab.quality_score = 0.7,
                  ab.created_at = datetime()
                RETURN ab.id AS id
              `,
              params: { id: blockId, content: text, title: label },
            },
            { timeoutMs: 8000 },
          ).catch(() => null);

          if (createResult == null) {
            return jsonRes(
              {
                pinned: false,
                block_id: "",
                error: "Kunne ikke oprette block",
              } satisfies PinSourceResponse,
              503,
            );
          }
        }

        if (!blockId) {
          return jsonRes(
            {
              pinned: false,
              block_id: "",
              error: "block_id eller text påkrævet",
            } satisfies PinSourceResponse,
            400,
          );
        }

        // MERGE HAS_SOURCE edge — idempotent
        const edgeResult = await callMcpTool<unknown>(
          "data_graph_read",
          {
            query: `
              MATCH (e:Engagement {id: $eid})
              MATCH (ab:AssemblyBlock {id: $bid})
              MERGE (e)-[r:HAS_SOURCE]->(ab)
              ON CREATE SET r.pinned_at = datetime()
              RETURN ab.id AS block_id
            `,
            params: { eid: engId, bid: blockId },
          },
          { timeoutMs: 8000 },
        ).catch(() => null);

        if (edgeResult == null) {
          return jsonRes(
            {
              pinned: false,
              block_id: blockId,
              error: "Platform utilgængeligt",
            } satisfies PinSourceResponse,
            503,
          );
        }

        return jsonRes({ pinned: true, block_id: blockId } satisfies PinSourceResponse, 200);
      },
    },
  },
});
