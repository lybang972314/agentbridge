// API Routes — dashboard data endpoints for the admin UI

import type { FastifyInstance } from "fastify";
import { getAllTools, getAllMetrics, getMetrics } from "./registry.js";
import { getRecentLogs, getErrorLogs, getLogSummary, getLogsByTool } from "./logger.js";

export function registerApiRoutes(app: FastifyInstance): void {
  // List all registered tools
  app.get("/api/tools", async () => {
    const tools = getAllTools();
    const allMetrics = getAllMetrics();
    return {
      success: true,
      count: tools.length,
      tools: tools.map((t) => {
        const m = allMetrics.get(t.name);
        return {
          ...t,
          metrics: m ?? { totalCalls: 0, totalErrors: 0, lastMinuteCalls: 0, avgLatencyMs: 0 },
        };
      }),
    };
  });

  // Get metrics for a specific tool
  app.get<{ Params: { toolName: string } }>("/api/tools/:toolName/metrics", async (request) => {
    const m = getMetrics(request.params.toolName);
    if (!m) {
      return { success: false, error: "Tool not found" };
    }
    return { success: true, tool: request.params.toolName, metrics: m };
  });

  // Recent call logs
  app.get<{ Querystring: { limit?: string; tool?: string } }>("/api/logs", async (request) => {
    const limit = parseInt(request.query.limit ?? "50", 10);
    const toolName = request.query.tool;
    const logs = toolName
      ? getLogsByTool(toolName, limit)
      : getRecentLogs(limit);
    return { success: true, count: logs.length, logs };
  });

  // Error logs
  app.get<{ Querystring: { limit?: string } }>("/api/logs/errors", async (request) => {
    const limit = parseInt(request.query.limit ?? "20", 10);
    return { success: true, logs: getErrorLogs(limit) };
  });

  // Log summary stats
  app.get("/api/stats", async () => {
    const summary = getLogSummary();
    const tools = getAllTools();
    const allMetrics = getAllMetrics();
    let totalCalls = 0;
    let totalErrors = 0;
    for (const [, m] of allMetrics) {
      totalCalls += m.totalCalls;
      totalErrors += m.totalErrors;
    }
    return {
      success: true,
      stats: {
        ...summary,
        total_calls: totalCalls,
        total_errors: totalErrors,
        registered_tools: tools.length,
        enabled_tools: tools.filter((t) => t.enabled).length,
      },
    };
  });
}
