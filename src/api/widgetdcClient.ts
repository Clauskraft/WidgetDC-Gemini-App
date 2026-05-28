import type { GovernanceContext, WidgeToolRequest, WidgeToolResponse } from '../types/widgetdc';
import { createCorrelationId } from '../utils/ids';

type FetchJsonOptions = {
  method?: 'GET' | 'POST';
  body?: unknown;
  signal?: AbortSignal;
};

export interface AuthStatus {
  authenticated: boolean;
  serverReachable: boolean;
}

async function fetchJson<T>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
    credentials: 'include'
  });

  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const error = new Error(typeof payload === 'string' ? payload : payload?.error ?? 'Request failed');
    (error as Error & { status?: number; payload?: unknown }).status = response.status;
    (error as Error & { status?: number; payload?: unknown }).payload = payload;
    throw error;
  }

  return payload as T;
}

export async function getAuthStatus(): Promise<AuthStatus> {
  try {
    const status = await fetchJson<{ authenticated: boolean }>('/auth/status');
    return { authenticated: status.authenticated, serverReachable: true };
  } catch {
    return { authenticated: false, serverReachable: false };
  }
}

export async function activateBackendToken(bearerToken: string): Promise<{ success: boolean }> {
  return fetchJson<{ success: boolean }>('/auth/simple', {
    method: 'POST',
    body: { bearer_token: bearerToken }
  });
}

export async function sendChat(contents: string, model = 'gemini-2.0-flash'): Promise<WidgeToolResponse> {
  return fetchJson<WidgeToolResponse>('/api/chat', {
    method: 'POST',
    body: {
      model,
      contents,
      config: {
        systemInstruction: 'You are WidgeTDC Captain UI. Respond with claim-safe, governed language. Do not request direct raw graph writes.'
      }
    }
  });
}

export async function routeWidgetTool<T = unknown>(request: WidgeToolRequest): Promise<WidgeToolResponse<T>> {
  // Governance is displayed client-side for operator clarity only.
  // The server must derive and enforce trusted governance context itself.
  const uiContext = request.governance ?? {};
  return fetchJson<WidgeToolResponse<T>>('/api/widgetdc/route', {
    method: 'POST',
    body: {
      tool: request.tool,
      payload: {
        ...request.payload,
        ui_context: {
          correlation_id: uiContext.correlation_id,
          workflow_id: uiContext.workflow_id,
          evidence_ref: uiContext.evidence_ref,
          requested_from: 'widgetdc-aurora-frontend'
        }
      }
    }
  });
}

export async function mcpProxy<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  return fetchJson<T>('/api/mcp/proxy', {
    method: 'POST',
    body: { method, params }
  });
}

export function defaultGovernanceContext(partial: Partial<GovernanceContext> = {}): GovernanceContext {
  return {
    tenant_id: partial.tenant_id ?? 'default',
    actor_id: partial.actor_id ?? 'captain-ui',
    workflow_id: partial.workflow_id ?? 'widgetdc-aurora-frontend',
    plan_id: partial.plan_id,
    approval_id: partial.approval_id,
    evidence_ref: partial.evidence_ref,
    correlation_id: partial.correlation_id ?? createCorrelationId()
  };
}
