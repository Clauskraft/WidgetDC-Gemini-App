/**
 * POST /api/engagements/$id/deliverable
 *
 * Generates a consulting deliverable for a specific engagement:
 * 1. Fetches engagement context (name, domain, client, description) from graph
 * 2. Calls generateDeliverable with enriched brief
 * 3. Persists result as :WorkArtifact node with [:PRODUCED] edge from Engagement
 * 4. Returns WorkArtifact id + markdown + citations
 *
 * GET /api/engagements/$id/deliverable
 * Returns all WorkArtifacts produced by this engagement.
 */
import { createFileRoute } from "@tanstack/react-router";
import { callMcpTool, generateDeliverable, judgeDeliverable } from "@/lib/widgetdc.server";

export type DeliverableKind = "analysis" | "roadmap" | "assessment";

export type WorkArtifactRow = {
  id: string;
  title: string;
  kind: DeliverableKind;
  markdown: string;
  citations: number;
  signed_status: string | null;
  created_at: string;
};

export type EngagementDeliverablesResponse = {
  artifacts: WorkArtifactRow[];
  error?: string;
};

export type GenerateDeliverableBody = {
  kind: DeliverableKind;
  extra_context?: string;
  validate?: boolean;
};

export type GenerateDeliverableResponse = {
  artifact_id: string;
  markdown: string;
  citations: number;
  kind: DeliverableKind;
  quality?: { score: number } | null;
  error?: string;
};

function escCypher(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function jsonRes(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function extractRows(result: unknown): Array<Record<string, unknown>> {
  if (result == null) return [];
  const r = result as Record<string, unknown>;
  const inner = (r.result as Record<string, unknown>) ?? r;
  const raw: unknown = inner.results ?? inner.rows ?? inner.records ?? inner.data;
  return Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : [];
}

export const Route = createFileRoute("/api/engagements/$id/deliverable")({
  server: {
    handlers: {
      GET: async ({ params }: { params: { id: string } }) => {
        const engId = escCypher(params.id);
        const cypher = `
          MATCH (e:Engagement)-[:PRODUCED]->(wa:WorkArtifact)
          WHERE coalesce(e.id, toString(id(e))) = '${engId}'
          RETURN
            coalesce(wa.id, toString(id(wa))) AS id,
            coalesce(wa.title, 'Deliverable') AS title,
            coalesce(wa.kind, 'analysis') AS kind,
            coalesce(wa.markdown, '') AS markdown,
            coalesce(wa.citations, 0) AS citations,
            wa.signed_status AS signed_status,
            coalesce(wa.created_at, '') AS created_at
          ORDER BY wa.created_at DESC
          LIMIT 20
        `;

        const result = await callMcpTool<unknown>(
          "data_graph_read",
          { query: cypher },
          { timeoutMs: 12000 },
        ).catch(() => null);

        if (result == null) {
          return jsonRes(
            {
              artifacts: [],
              error: "Platform utilgængeligt",
            } satisfies EngagementDeliverablesResponse,
            503,
          );
        }

        const artifacts: WorkArtifactRow[] = extractRows(result).map((row) => ({
          id: String(row.id ?? ""),
          title: String(row.title ?? "Deliverable"),
          kind: (row.kind as DeliverableKind) ?? "analysis",
          markdown: String(row.markdown ?? ""),
          citations: typeof row.citations === "number" ? row.citations : 0,
          signed_status: row.signed_status != null ? String(row.signed_status) : null,
          created_at: String(row.created_at ?? ""),
        }));

        return jsonRes({ artifacts } satisfies EngagementDeliverablesResponse, 200);
      },

      POST: async ({ request, params }: { request: Request; params: { id: string } }) => {
        let body: GenerateDeliverableBody;
        try {
          body = (await request.json()) as GenerateDeliverableBody;
        } catch {
          return jsonRes({ error: "Ugyldig JSON" } as GenerateDeliverableResponse, 400);
        }

        const kind = body.kind ?? "analysis";
        const validate = body.validate !== false;
        const engId = escCypher(params.id);

        // Fetch engagement context
        const contextCypher = `
          MATCH (e:Engagement)
          WHERE coalesce(e.id, toString(id(e))) = '${engId}'
          OPTIONAL MATCH (e)-[:UTILIZED_PATTERN]->(p:Pattern)
          WITH e, collect(p.name)[..5] AS pattern_names
          RETURN
            coalesce(e.name, '') AS name,
            coalesce(e.domain, '') AS domain,
            coalesce(e.client, '') AS client,
            coalesce(e.description, '') AS description,
            pattern_names
        `;

        const ctxResult = await callMcpTool<unknown>(
          "data_graph_read",
          { query: contextCypher },
          { timeoutMs: 10000 },
        ).catch(() => null);

        const ctxRows = extractRows(ctxResult);
        const ctx = ctxRows[0] ?? {};
        const engName = String(ctx.name ?? "Engagement");
        const engDomain = String(ctx.domain ?? "");
        const engClient = String(ctx.client ?? "");
        const engDesc = String(ctx.description ?? "");
        const patternNames = Array.isArray(ctx.pattern_names)
          ? (ctx.pattern_names as string[]).filter(Boolean)
          : [];

        // Build enriched brief
        const brief = [
          `Engagement: ${engName}`,
          engClient ? `Klient: ${engClient}` : "",
          engDomain ? `Domain: ${engDomain}` : "",
          engDesc ? `Kontekst: ${engDesc}` : "",
          patternNames.length > 0 ? `Relevante patterns: ${patternNames.join(", ")}` : "",
          body.extra_context ? `Ekstra kontekst: ${body.extra_context}` : "",
        ]
          .filter(Boolean)
          .join("\n");

        const correlationId = crypto.randomUUID();
        const deliverable = await generateDeliverable(brief, kind, { correlationId });
        if (!deliverable) {
          return jsonRes(
            { error: "Deliverable generation fejlede — prøv igen." } as GenerateDeliverableResponse,
            502,
          );
        }

        const quality = validate
          ? await judgeDeliverable(brief, deliverable.markdown, correlationId)
          : null;

        // Persist WorkArtifact + PRODUCED edge
        const artifactId = `wa-${correlationId.slice(0, 8)}`;
        const title = escCypher(
          `${kind.charAt(0).toUpperCase() + kind.slice(1)}: ${engName}`.slice(0, 120),
        );
        const mdEsc = escCypher(deliverable.markdown.slice(0, 8000));
        const now = new Date().toISOString();

        const writeCypher = `
          MATCH (e:Engagement)
          WHERE coalesce(e.id, toString(id(e))) = '${engId}'
          CREATE (wa:WorkArtifact {
            id: '${escCypher(artifactId)}',
            title: '${title}',
            kind: '${escCypher(kind)}',
            markdown: '${mdEsc}',
            citations: ${deliverable.citations},
            signed_status: null,
            created_at: '${now}'
          })
          CREATE (e)-[:PRODUCED]->(wa)
          RETURN wa.id AS id
        `;

        await callMcpTool<unknown>(
          "data_graph_read",
          { query: writeCypher },
          { timeoutMs: 10000 },
        ).catch(() => null);

        return jsonRes(
          {
            artifact_id: artifactId,
            markdown: deliverable.markdown,
            citations: deliverable.citations,
            kind,
            quality: quality ? { score: quality.score ?? 0 } : null,
          } satisfies GenerateDeliverableResponse,
          201,
        );
      },
    },
  },
});
