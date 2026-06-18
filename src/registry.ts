// Tool Registry — stores and manages tool definitions for the AgentBridge
// Tools are defined in JSON files under /tools/ and loaded at startup

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export interface ToolAuth {
  type: "api_key" | "bearer" | "custom_header" | "none";
  /** Header name for the credential (e.g. "X-API-Key", "Authorization") */
  header_name?: string;
  /** Prefix for the credential value (e.g. "Bearer ") */
  prefix?: string;
  /** Where the credential lives: in our env, or passed through from caller */
  source: "env" | "passthrough";
  /** Env var name if source is "env" */
  env_var?: string;
}

export interface ToolSchema {
  /** Unique tool name used in the gateway path */
  name: string;
  /** Human-readable label for dashboards */
  label: string;
  /** Short description of what the tool does */
  description: string;
  /** The upstream API base URL */
  base_url: string;
  /** The upstream endpoint path (supports :param placeholders) */
  endpoint: string;
  /** HTTP method for the upstream call */
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  /** Auth configuration */
  auth: ToolAuth;
  /** Rate limit: max requests per minute (0 = unlimited) */
  rate_limit_rpm: number;
  /** Whether this tool is currently enabled */
  enabled: boolean;
  /** Input schema (JSON Schema subset) for validation */
  input_schema?: Record<string, unknown>;
  /** Category for grouping in the dashboard */
  category?: string;
}

export interface ToolCallMetrics {
  totalCalls: number;
  totalErrors: number;
  lastMinuteCalls: number;
  avgLatencyMs: number;
}

// In-memory registry
const tools = new Map<string, ToolSchema>();
const metrics = new Map<string, ToolCallMetrics>();
const rateLimitWindows = new Map<string, number[]>();

export function loadTools(toolsDir: string): number {
  try {
    const files = readdirSync(toolsDir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const raw = readFileSync(join(toolsDir, file), "utf-8");
      const toolDefs: ToolSchema[] = JSON.parse(raw);
      for (const tool of toolDefs) {
        tools.set(tool.name, tool);
        metrics.set(tool.name, {
          totalCalls: 0,
          totalErrors: 0,
          lastMinuteCalls: 0,
          avgLatencyMs: 0,
        });
        rateLimitWindows.set(tool.name, []);
      }
    }
    return tools.size;
  } catch (err) {
    console.error("Failed to load tools:", err);
    return 0;
  }
}

export function getTool(name: string): ToolSchema | undefined {
  return tools.get(name);
}

export function getAllTools(): ToolSchema[] {
  return Array.from(tools.values());
}

export function getMetrics(name: string): ToolCallMetrics | undefined {
  return metrics.get(name);
}

export function getAllMetrics(): Map<string, ToolCallMetrics> {
  return new Map(metrics);
}

export function recordCall(name: string, latencyMs: number, isError: boolean): void {
  const m = metrics.get(name);
  if (!m) return;

  m.totalCalls++;
  if (isError) m.totalErrors++;

  // Update rolling average latency
  m.avgLatencyMs =
    (m.avgLatencyMs * (m.totalCalls - 1) + latencyMs) / m.totalCalls;

  // Sliding window rate limit tracking
  const now = Date.now();
  const window = rateLimitWindows.get(name)!;
  window.push(now);
  // Keep only calls from the last 60 seconds
  while (window.length > 0 && now - window[0] > 60_000) {
    window.shift();
  }
  m.lastMinuteCalls = window.length;
}

export function checkRateLimit(name: string): boolean {
  const tool = tools.get(name);
  if (!tool || tool.rate_limit_rpm === 0) return true;
  const window = rateLimitWindows.get(name);
  if (!window) return true;
  return window.length < tool.rate_limit_rpm;
}
