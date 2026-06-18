// Stripe Routes — checkout creation, webhook handling, subscription management

import type { FastifyInstance } from "fastify";
import Stripe from "stripe";
import { PRICING_TIERS } from "./pricing.js";
import { createUser, getUserByStripeCustomer, updateSubscription } from "./db.js";

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  return new Stripe(key);
}

export function registerStripeRoutes(app: FastifyInstance): void {
  const stripe = getStripe();

  // Create a Stripe Checkout session
  app.post<{ Body: { tier: string; email: string } }>(
    "/api/checkout",
    async (request, reply) => {
      const { tier, email } = request.body ?? {};
      if (!tier || !email) {
        return reply.status(400).send({ error: "tier and email are required" });
      }

      const plan = PRICING_TIERS.find((t) => t.id === tier && t.price > 0);
      if (!plan) {
        return reply.status(400).send({ error: `Invalid tier: ${tier}` });
      }

      try {
        const session = await stripe.checkout.sessions.create({
          mode: "subscription",
          customer_email: email,
          line_items: [
            {
              price: plan.stripe_price_id,
              quantity: 1,
            },
          ],
          success_url: `${process.env.BASE_URL ?? "http://localhost:3100"}/?checkout=success`,
          cancel_url: `${process.env.BASE_URL ?? "http://localhost:3100"}/?checkout=cancelled`,
          metadata: {
            tier,
          },
        });

        return { url: session.url };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        request.log.error({ err: msg }, "Stripe checkout failed");
        return reply.status(500).send({ error: "Checkout failed. Is STRIPE_SECRET_KEY set?" });
      }
    }
  );

  // Stripe webhook handler
  app.post("/api/stripe-webhook", async (request, reply) => {
    const sig = request.headers["stripe-signature"];
    const secret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !secret) {
      return reply.status(400).send({ error: "Missing signature or webhook secret" });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        request.body as string,
        sig,
        secret
      );
    } catch (err) {
      return reply.status(400).send({ error: "Invalid signature" });
    }

    // Handle subscription events
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;
        const email = session.customer_details?.email;
        const tier = session.metadata?.tier ?? "pro";

        if (email && customerId) {
          const existing = getUserByStripeCustomer(customerId);
          if (!existing) {
            const apiKey = `mgw_${crypto.randomUUID().replace(/-/g, "")}`;
            createUser(email, customerId, apiKey);
            request.log.info({ email, tier }, "New user created via Stripe");
          } else {
            const plan = PRICING_TIERS.find((t) => t.id === tier);
            updateSubscription(customerId, "active", tier, plan?.calls_per_day ?? 10000);
            request.log.info({ email, tier }, "Subscription updated via Stripe");
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        updateSubscription(customerId, "inactive", "free", 100);
        request.log.info({ customerId }, "Subscription cancelled");
        break;
      }
    }

    return { received: true };
  });
}
