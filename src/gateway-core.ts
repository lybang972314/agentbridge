// Gateway Core — reusable tool execution with hard timeout, graceful error handling

import { getTool, recordCall, checkRateLimit } from "./registry.js";
import { checkFirewall, loadFirewallRules } from "./firewall.js";
import { resolveAuth } from "./auth.js";
import { createLogEntry } from "./logger.js";

const DEFAULT_TIMEOUT_MS = 20_000; // 20s hard timeout for all upstream calls

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
  error_type?: string;
  status_code: number;
}

function buildUpstreamUrl(baseUrl: string, endpoint: string, params: Record<string,string>): string {
  let path = endpoint;
  for (const [k, v] of Object.entries(params)) {
    path = path.replace(`:${k}`, encodeURIComponent(v));
  }
  const base = baseUrl.replace(/\/+$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

export function parseEndpointParams(endpoint: string): string[] {
  const matches = endpoint.match(/:\w+/g);
  return matches ? matches.map((m) => m.slice(1)) : [];
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return res;
  } catch(e: any) {
    if (e.name === 'AbortError') throw new Error(`Upstream timeout after ${timeoutMs}ms`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function executeToolCall(call: ToolCallParams): Promise<ToolCallResult> {
  const startTime = performance.now();
  const { toolName, params, authValue, callerIp } = call;

  const tool = getTool(toolName);
  if (!tool) {
    const entry = createLogEntry({
      tool_name: toolName, method: "UNKNOWN", upstream_url: "",
      status_code: 404, latency_ms: 0,
      error: `Tool "${toolName}" not found`, auth_source: "none", caller_ip: callerIp,
    });
    return { success: false, call_id: entry.id, tool: toolName, latency_ms: 0, error: `Tool "${toolName}" not found`, error_type: "ToolNotFound", status_code: 404 };
  }

  if (!tool.enabled) {
    return { success: false, call_id: "disabled", tool: toolName, latency_ms: 0, error: `Tool "${toolName}" is disabled`, error_type: "ToolDisabled", status_code: 403 };
  }

  if (!checkRateLimit(toolName)) {
    const entry = createLogEntry({
      tool_name: toolName, method: tool.method, upstream_url: tool.base_url + tool.endpoint,
      status_code: 429, latency_ms: 0, error: "Rate limit exceeded",
      auth_source: tool.auth.source, caller_ip: callerIp,
    });
    return { success: false, call_id: entry.id, tool: toolName, latency_ms: 0, error: `Rate limit: ${tool.rate_limit_rpm}/min`, error_type: "RateLimitExceeded", status_code: 429 };
  }

  const expectedParams = parseEndpointParams(tool.endpoint);
  const paramMap: Record<string,string> = {};
  for (const p of expectedParams) {
    if (!(p in params)) {
      const entry = createLogEntry({
        tool_name: toolName, method: tool.method, upstream_url: tool.base_url + tool.endpoint,
        status_code: 400, latency_ms: 0, error: `Missing param: "${p}"`,
        auth_source: tool.auth.source, caller_ip: callerIp,
      });
      return { success: false, call_id: entry.id, tool: toolName, latency_ms: 0, error: `Missing required parameter: "${p}"`, error_type: "MissingParam", status_code: 400 };
    }
    paramMap[p] = String(params[p]);
  }

  const authResult = resolveAuth(tool.auth, authValue);
  if ("error" in authResult) {
    const entry = createLogEntry({
      tool_name: toolName, method: tool.method, upstream_url: tool.base_url + tool.endpoint,
      status_code: authResult.status, latency_ms: 0, error: authResult.error,
      auth_source: tool.auth.source, caller_ip: callerIp,
    });
    return { success: false, call_id: entry.id, tool: toolName, latency_ms: 0, error: authResult.error, error_type: "AuthError", status_code: authResult.status };
  }

  const upstreamUrl = buildUpstreamUrl(tool.base_url, tool.endpoint, paramMap);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "AgentBridge/1.0 (transparent-proxy; +https://agentbridge.dev)",
      "Accept": tool.name === "url-fetch" ? "text/markdown,text/plain" : "application/json",
    };
    if (authResult.headerName !== "x-auth-type") {
      headers[authResult.headerName] = authResult.headerValue;
    }

    // Remove params that go into the URL path from the body
    const upstreamBody = { ...params };
    for (const p of expectedParams) {
      delete upstreamBody[p];
    }

    // Special handling for code-run: Piston expects { language, files: [{content}] }
    if (tool.name === "code-run") {
      upstreamBody.files = [{ content: upstreamBody.code }];
      delete (upstreamBody as any).code;
      delete (upstreamBody as any).language_name;
    }
    // For code-run, also send language
    if (tool.name === "code-run" && upstreamBody.language) {
      (upstreamBody as any).language = upstreamBody.language;
    }

    const fetchInit: RequestInit = { method: tool.method, headers };
    if (tool.method !== "GET" && tool.method !== "DELETE") {
      fetchInit.body = JSON.stringify(upstreamBody);
    }

    const upstreamRes = await fetchWithTimeout(upstreamUrl, fetchInit, DEFAULT_TIMEOUT_MS);
    const latencyMs = Math.round((performance.now() - startTime) * 100) / 100;
    const isError = upstreamRes.status >= 400;

    let responseBody: unknown;
    const contentType = upstreamRes.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      responseBody = await upstreamRes.json();
    } else {
      responseBody = { _text: await upstreamRes.text() };
    }

    let error_type: string | undefined;
    if (upstreamRes.status === 403) error_type = "BlockedByWAF";
    else if (upstreamRes.status === 429) error_type = "UpstreamRateLimited";
    else if (isError) error_type = "UpstreamError";

    const entry = createLogEntry({
      tool_name: toolName, method: tool.method, upstream_url: upstreamUrl,
      status_code: upstreamRes.status, latency_ms: latencyMs,
      error: isError ? `Upstream ${upstreamRes.status}` : undefined,
      request_body_snippet: JSON.stringify(params).slice(0, 200),
      response_body_snippet: JSON.stringify(responseBody).slice(0, 200),
      auth_source: tool.auth.source, caller_ip: callerIp,
    });

    recordCall(toolName, latencyMs, isError);

    return {
      success: !isError,
      call_id: entry.id, tool: toolName, latency_ms: latencyMs,
      data: responseBody,
      error: isError ? `Upstream returned ${upstreamRes.status}` : undefined,
      error_type,
      status_code: upstreamRes.status,
    };
  } catch (err: any) {
    const latencyMs = Math.round((performance.now() - startTime) * 100) / 100;
    const errorMsg = err.message || String(err);
    let error_type = "UpstreamError";
    let status_code = 502;

    if (errorMsg.includes("timeout")) {
      error_type = "UpstreamTimeout"; status_code = 504;
    } else if (errorMsg.includes("fetch")) {
      error_type = "ConnectionError";
    }

    const entry = createLogEntry({
      tool_name: toolName, method: tool.method, upstream_url: upstreamUrl,
      status_code, latency_ms: latencyMs, error: errorMsg,
      auth_source: tool.auth.source, caller_ip: callerIp,
    });

    recordCall(toolName, latencyMs, true);

    return { success: false, call_id: entry.id, tool: toolName, latency_ms: latencyMs, error: errorMsg, error_type, status_code };
  }
}
