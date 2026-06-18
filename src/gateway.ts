// Core Gateway — HTTP proxy routes using shared gateway-core logic

import type { FastifyInstance } from "fastify";
import { getAllTools } from "./registry.js";
import { executeToolCall } from "./gateway-core.js";

interface GatewayRequestBody {
  params?: Record<string, unknown>;
  auth_value?: string;
}

function getToolList(): string {
  const tools = getAllTools();
  return tools
    .filter((t) => t.enabled)
    .map((t) => t.name)
    .join(", ");
}

export function registerGatewayRoutes(app: FastifyInstance): void {
  app.post<{
    Params: { toolName: string };
    Body: GatewayRequestBody;
  }>("/gateway/:toolName", async (request, reply) => {
    const { toolName } = request.params;
    const { params = {}, auth_value } = request.body ?? {};

    const result = await executeToolCall({
      toolName,
      params,
      authValue: auth_value,
      callerIp: request.ip,
    });

    return reply.status(result.status_code).send({
      success: result.success,
      call_id: result.call_id,
      tool: result.tool,
      latency_ms: result.latency_ms,
      data: result.data,
      error: result.error,
    });
  });

  // Health check
  app.get("/health", async () => ({
    status: "ok",
    version: "0.2.0",
    uptime: process.uptime(),
  }));
}
