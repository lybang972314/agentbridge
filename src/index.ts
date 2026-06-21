import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import crypto from "crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTools } from "./registry.js";
import { registerGatewayRoutes } from "./gateway.js";
import { registerApiRoutes } from "./api.js";
import { registerCodeRunRoutes } from "./code-run.js";
import { loadFirewallRules } from "./firewall.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT ?? "3100", 10);
const TOOLS_DIR = join(__dirname, "..", "tools");
const PUBLIC_DIR = join(__dirname, "..", "public");
const users = new Map<string, string>();
let totalViews = 0;
let uniqueIPs = new Set<string>();

async function main() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });
  await app.register(fastifyStatic, { root: PUBLIC_DIR, prefix: "/" });

  app.addHook("onRequest", async (req) => {
    if (req.url === "/" || req.url === "/index.html" || req.url === "/dashboard" || req.url === "/dashboard.html" || !req.url.includes(".")) {
      totalViews++;
      uniqueIPs.add(req.ip);
    }
  });

  const toolCount = loadTools(TOOLS_DIR);
  const ruleCount = loadFirewallRules();
  console.log(`Tools: ${toolCount} | Security Rules: ${ruleCount}`);

  registerGatewayRoutes(app);
  registerApiRoutes(app);
  registerCodeRunRoutes(app);

  app.get("/api/analytics", async () => ({
    total_views: totalViews, unique_visitors: uniqueIPs.size,
    registered_users: users.size, uptime: process.uptime(),
    tools: toolCount, security_rules: ruleCount,
  }));

  app.post("/api/free-signup", async (req, reply) => {
    const { email } = (req.body as any) || {};
    if (!email || !email.includes("@")) return reply.status(400).send({ error: "Valid email required" });
    if (users.has(email)) return reply.send({ api_key: users.get(email), message: "Existing account" });
    const key = "ab_" + crypto.randomUUID().replace(/-/g, "").substring(0, 32);
    users.set(email, key);
    return reply.status(201).send({ api_key: key, message: "Welcome!" });
  });

  if (process.env.STRIPE_SECRET_KEY) {
    try { const { registerStripeRoutes } = await import("./stripe-routes.js"); registerStripeRoutes(app); console.log("Stripe: enabled"); }
    catch(e) { console.log("Stripe: error"); }
  }

  app.get("/", async (_req, reply) => reply.sendFile("index.html"));
  app.get("/dashboard", async (_req, reply) => reply.sendFile("dashboard.html"));

  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`AgentBridge v1.7.0 — http://localhost:${PORT} | Firewall: ${ruleCount} rules`);
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
