import type { FastifyInstance } from "fastify";
import vm from "node:vm";

export function registerCodeRunRoutes(app: FastifyInstance): void {
  app.post<{ Body: { language?: string; code?: string } }>(
    "/gateway/code-run",
    async (request, reply) => {
      const { language = "javascript", code = "" } = request.body ?? {};

      if (!code.trim()) {
        return reply.status(400).send({
          success: false, error: "No code provided", error_type: "MissingParam",
        });
      }

      if (language !== "javascript") {
        return reply.status(400).send({
          success: false,
          error: `Language "${language}" not supported. Currently only JavaScript is available.`,
          error_type: "UnsupportedLanguage",
        });
      }

      const start = performance.now();

      try {
        let output = "";
        const context = {
          console: {
            log: (...args: any[]) => { output += args.map(String).join(" ") + "\n"; },
            error: (...args: any[]) => { output += "[ERR] " + args.map(String).join(" ") + "\n"; },
            warn: (...args: any[]) => { output += "[WARN] " + args.map(String).join(" ") + "\n"; },
          },
          setTimeout: () => { throw new Error("setTimeout is disabled"); },
          setInterval: () => { throw new Error("setInterval is disabled"); },
          fetch: () => { throw new Error("fetch is disabled (sandbox)"); },
          require: () => { throw new Error("require is disabled (sandbox)"); },
        };

        const result = vm.runInNewContext(code, context, { timeout: 10_000 });
        const latency = Math.round((performance.now() - start) * 100) / 100;

        if (result !== undefined && output === "") {
          output = String(result);
        }

        return {
          success: true,
          call_id: "cr_" + Date.now().toString(36),
          tool: "code-run",
          latency_ms: latency,
          data: { output: output || "(no output)", language: "javascript" },
        };
      } catch (err: any) {
        const latency = Math.round((performance.now() - start) * 100) / 100;
        const errorMsg = err?.message || String(err);
        const isTimeout = errorMsg.includes("timed out") || errorMsg.includes("execution timed out");

        return {
          success: false,
          call_id: "cr_" + Date.now().toString(36),
          tool: "code-run",
          latency_ms: latency,
          error: errorMsg,
          error_type: isTimeout ? "UpstreamTimeout" : "CodeExecutionError",
          status_code: isTimeout ? 504 : 400,
          data: { output: errorMsg, language: "javascript" },
        };
      }
    }
  );
}
