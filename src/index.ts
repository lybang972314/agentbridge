import Fastify from "fastify";
async function main() {
  const app = Fastify({ logger: true });
  app.get("/health", async () => ({ status: "ok", version: "minimal" }));
  app.get("*", async (req) => ({ path: req.url }));
  await app.listen({ port: parseInt(process.env.PORT ?? "3100"), host: "0.0.0.0" });
  console.log("Minimal Fastify on " + (process.env.PORT ?? "3100"));
}
main().catch(err => { console.error("Fatal:", err); process.exit(1); });
