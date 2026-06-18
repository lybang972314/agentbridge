// Auth Manager — resolves credentials for tool calls
// Supports: API key (from env or passthrough), Bearer token, custom headers

import type { ToolAuth } from "./registry.js";

export interface ResolvedAuth {
  headerName: string;
  headerValue: string;
}

/**
 * Resolve the authentication header for a tool call.
 * - "env" source: reads the credential from process.env
 * - "passthrough" source: expects the caller to provide it in the request
 */
export function resolveAuth(
  auth: ToolAuth,
  passthroughValue?: string
): ResolvedAuth | { error: string; status: number } {
  if (auth.type === "none") {
    return { headerName: "x-auth-type", headerValue: "none" };
  }

  const headerName = auth.header_name ?? "Authorization";

  if (auth.source === "passthrough") {
    if (!passthroughValue) {
      return {
        error: `Tool requires auth via "${headerName}" header. Pass it in the request body as "auth_value".`,
        status: 401,
      };
    }
    const prefix = auth.prefix ?? "";
    return { headerName, headerValue: `${prefix}${passthroughValue}` };
  }

  // source === "env"
  if (!auth.env_var) {
    return {
      error: "Tool configured with env auth but no env_var specified.",
      status: 500,
    };
  }
  const envValue = process.env[auth.env_var];
  if (!envValue) {
    return {
      error: `Server misconfiguration: env var "${auth.env_var}" is not set.`,
      status: 500,
    };
  }
  const prefix = auth.prefix ?? "";
  return { headerName, headerValue: `${prefix}${envValue}` };
}
