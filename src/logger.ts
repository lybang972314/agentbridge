// Request Logger — structured logging for every gateway call
// Feeds into the observability layer (future: persist to DB, export to OTLP)

import { v4 as uuidv4 } from "uuid";

export interface LogEntry {
  id: string;
  timestamp: string;
  tool_name: string;
  method: string;
  upstream_url: string;
  status_code: number;
  latency_ms: number;
  error?: string;
  request_body_snippet?: string;
  response_body_snippet?: string;
  auth_source: "env" | "passthrough" | "none";
  caller_ip: string;
}

// In-memory ring buffer (last 1000 calls — enough for MVP dashboard)
const MAX_LOG_ENTRIES = 1000;
const logEntries: LogEntry[] = [];

export function createLogEntry(partial: Omit<LogEntry, "id" | "timestamp">): LogEntry {
  const entry: LogEntry = {
    id: uuidv4().slice(0, 8),
    timestamp: new Date().toISOString(),
    ...partial,
  };
  logEntries.push(entry);
  if (logEntries.length > MAX_LOG_ENTRIES) {
    logEntries.shift();
  }
  return entry;
}

export function getRecentLogs(limit = 50): LogEntry[] {
  return logEntries.slice(-limit).reverse();
}

export function getLogsByTool(toolName: string, limit = 20): LogEntry[] {
  return logEntries
    .filter((e) => e.tool_name === toolName)
    .slice(-limit)
    .reverse();
}

export function getErrorLogs(limit = 20): LogEntry[] {
  return logEntries
    .filter((e) => e.status_code >= 400)
    .slice(-limit)
    .reverse();
}

export function getLogSummary(): {
  total: number;
  success_rate: number;
  avg_latency_ms: number;
  p99_latency_ms: number;
} {
  const total = logEntries.length;
  if (total === 0) {
    return { total: 0, success_rate: 0, avg_latency_ms: 0, p99_latency_ms: 0 };
  }
  const successCount = logEntries.filter((e) => e.status_code < 400).length;
  const latencies = logEntries.map((e) => e.latency_ms).sort((a, b) => a - b);
  const avg = latencies.reduce((s, l) => s + l, 0) / total;
  const p99 = latencies[Math.floor(total * 0.99)] ?? latencies[total - 1];
  return {
    total,
    success_rate: Math.round((successCount / total) * 10000) / 100,
    avg_latency_ms: Math.round(avg * 100) / 100,
    p99_latency_ms: p99,
  };
}
