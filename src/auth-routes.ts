// Auth Routes — free signup and API key management

import type { FastifyInstance } from "fastify";
import { createUser, getUserByEmail } from "./db.js";

export function registerAuthRoutes(app: FastifyInstance): void {
  // Free signup — no Stripe needed
  app.post<{ Body: { email: string } }>(
    "/api/free-signup",
    async (request, reply) => {
      const { email } = request.body ?? {};
      if (!email || !email.includes("@")) {
        return reply.status(400).send({ error: "Valid email required" });
      }

      const existing = getUserByEmail(email);
      if (existing) {
        return reply.status(200).send({
          api_key: existing.api_key,
          message: "Existing account found. Here's your key.",
        });
      }

      try {
        const apiKey = `mgw_${crypto.randomUUID().replace(/-/g, "")}`;
        const user = createUser(email, null, apiKey);
        return reply.status(201).send({
          api_key: user.api_key,
          message: "Welcome! Use this key in your agent's requests.",
        });
      } catch (err) {
        return reply.status(500).send({ error: "Signup failed. Try again." });
      }
    }
  );
}
