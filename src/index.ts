import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTools } from "./registry.js";
import { registerGatewayRoutes } from "./gateway.js";
import { registerApiRoutes } from "./api.js";
import { registerStripeRoutes } from "./stripe-routes.js";
import { registerAuthRoutes } from "./auth-routes.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT ?? "3100", 10);
const TOOLS_DIR = join(__dirname, "..", "tools");
const PUBLIC_DIR = join(__dirname, "..", "public");

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await app.register(fastifyStatic, { root: PUBLIC_DIR, prefix: "/" });

  const toolCount = loadTools(TOOLS_DIR);
  console.log(`\n  Tools loaded: ${toolCount}`);

  registerGatewayRoutes(app);
  registerApiRoutes(app);
  registerAuthRoutes(app);

  if (process.env.STRIPE_SECRET_KEY) {
    registerStripeRoutes(app);
    console.log("  Stripe: enabled");
  } else {
    console.log("  Stripe: disabled (set STRIPE_SECRET_KEY to enable)");
  }

  app.get("/", async (_req, reply) => reply.sendFile("index.html"));

  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`\n  AgentBridge v0.3.0 — http://localhost:${PORT}\n`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
