// Gateway Core — reusable tool execution logic, shared by HTTP and MCP handlers

import { getTool, recordCall, checkRateLimit } from "./registry.js";
import { resolveAuth } from "./auth.js";
import { createLogEntry } from "./logger.js";

export interface ToolCallParams {
  toolName: string;
  params: Record<string, unknown>;
  authValue?: string;
  callerIp: string;
}

export interface ToolCallResult {
  success: boolean;
  call_id: string;
  tool: string;
  latency_ms: number;
  data?: unknown;
  error?: string;
  status_code: number;
}

interface ToolEndpointParam {
  name: string;
  value: string;
}

function buildUpstreamUrl(
  baseUrl: string,
  endpoint: string,
  params: ToolEndpointParam[]
): string {
  let path = endpoint;
  for (const p of params) {
    path = path.replace(`:${p.name}`, encodeURIComponent(p.value));
  }
  const base = baseUrl.replace(/\/+$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

export function parseEndpointParams(endpoint: string): string[] {
  const matches = endpoint.match(/:\w+/g);
  return matches ? matches.map((m) => m.slice(1)) : [];
}

export async function executeToolCall(call: ToolCallParams): Promise<ToolCallResult> {
  const startTime = performance.now();
  const { toolName, params, authValue, callerIp } = call;

  // 1. Look up the tool
  const tool = getTool(toolName);
  if (!tool) {
    const entry = createLogEntry({
      tool_name: toolName,
      method: "UNKNOWN",
      upstream_url: "",
      status_code: 404,
      latency_ms: 0,
      error: `Tool "${toolName}" not found`,
      auth_source: "none",
      caller_ip: callerIp,
    });
    return { success: false, call_id: entry.id, tool: toolName, latency_ms: 0, error: `Tool "${toolName}" not found`, status_code: 404 };
  }

  if (!tool.enabled) {
    return { success: false, call_id: "disabled", tool: toolName, latency_ms: 0, error: `Tool "${toolName}" is disabled`, status_code: 403 };
  }

  // 2. Check rate limit
  if (!checkRateLimit(toolName)) {
    const entry = createLogEntry({
      tool_name: toolName, method: tool.method, upstream_url: tool.base_url + tool.endpoint,
      status_code: 429, latency_ms: 0, error: "Rate limit exceeded",
      auth_source: tool.auth.source, caller_ip: callerIp,
    });
    return { success: false, call_id: entry.id, tool: toolName, latency_ms: 0, error: `Rate limit exceeded (max ${tool.rate_limit_rpm}/min)`, status_code: 429 };
  }

  // 3. Validate required params
  const expectedParams = parseEndpointParams(tool.endpoint);
  const paramList: ToolEndpointParam[] = [];
  for (const p of expectedParams) {
    if (!(p in params)) {
      const entry = createLogEntry({
        tool_name: toolName, method: tool.method, upstream_url: tool.base_url + tool.endpoint,
        status_code: 400, latency_ms: 0, error: `Missing param: "${p}"`,
        auth_source: tool.auth.source, caller_ip: callerIp,
      });
      return { success: false, call_id: entry.id, tool: toolName, latency_ms: 0, error: `Missing required parameter: "${p}"`, status_code: 400 };
    }
    paramList.push({ name: p, value: String(params[p]) });
  }

  // 4. Resolve auth
  const authResult = resolveAuth(tool.auth, authValue);
  if ("error" in authResult) {
    const entry = createLogEntry({
      tool_name: toolName, method: tool.method, upstream_url: tool.base_url + tool.endpoint,
      status_code: authResult.status, latency_ms: 0, error: authResult.error,
      auth_source: tool.auth.source, caller_ip: callerIp,
    });
    return { success: false, call_id: entry.id, tool: toolName, latency_ms: 0, error: authResult.error, status_code: authResult.status };
  }

  const upstreamUrl = buildUpstreamUrl(tool.base_url, tool.endpoint, paramList);

  // 5. Proxy to upstream
  try {
    const headers: Record<string, string> = {
      [authResult.headerName]: authResult.headerValue,
      "Content-Type": "application/json",
      "User-Agent": "MCP-Gateway/0.1",
    };

    const upstreamBody = { ...params };
    for (const p of expectedParams) {
      delete upstreamBody[p];
    }

    const fetchInit: RequestInit = { method: tool.method, headers };
    if (tool.method !== "GET" && tool.method !== "DELETE") {
      fetchInit.body = JSON.stringify(upstreamBody);
    }

    const upstreamRes = await fetch(upstreamUrl, fetchInit);
    const latencyMs = Math.round((performance.now() - startTime) * 100) / 100;
    const isError = upstreamRes.status >= 400;

    let responseBody: unknown;
    const contentType = upstreamRes.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      responseBody = await upstreamRes.json();
    } else {
      responseBody = { _raw: await upstreamRes.text() };
    }

    const entry = createLogEntry({
      tool_name: toolName, method: tool.method, upstream_url: upstreamUrl,
      status_code: upstreamRes.status, latency_ms: latencyMs,
      error: isError ? `Upstream returned ${upstreamRes.status}` : undefined,
      request_body_snippet: JSON.stringify(params).slice(0, 200),
      response_body_snippet: JSON.stringify(responseBody).slice(0, 200),
      auth_source: tool.auth.source, caller_ip: callerIp,
    });

    recordCall(toolName, latencyMs, isError);

    return {
      success: !isError,
      call_id: entry.id,
      tool: toolName,
      latency_ms: latencyMs,
      data: responseBody,
      error: isError ? `Upstream returned ${upstreamRes.status}` : undefined,
      status_code: upstreamRes.status,
    };
  } catch (err) {
    const latencyMs = Math.round((performance.now() - startTime) * 100) / 100;
    const errorMsg = err instanceof Error ? err.message : String(err);

    const entry = createLogEntry({
      tool_name: toolName, method: tool.method, upstream_url: upstreamUrl,
      status_code: 502, latency_ms: latencyMs, error: errorMsg,
      auth_source: tool.auth.source, caller_ip: callerIp,
    });

    recordCall(toolName, latencyMs, true);

    return { success: false, call_id: entry.id, tool: toolName, latency_ms: latencyMs, error: errorMsg, status_code: 502 };
  }
}
