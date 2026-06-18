// Pricing plans for the MCP Gateway

export interface PricingTier {
  id: string;
  name: string;
  price: number;
  stripe_price_id: string;
  tools: number;
  calls_per_day: number;
  rate_limit_rpm: number;
  features: string[];
  highlighted: boolean;
}

export const PRICING_TIERS: PricingTier[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    stripe_price_id: "",
    tools: 3,
    calls_per_day: 100,
    rate_limit_rpm: 10,
    features: [
      "3 tools from registry",
      "100 calls / day",
      "Community support",
      "Basic logging",
    ],
    highlighted: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: 5,
    stripe_price_id: process.env.STRIPE_PRO_PRICE_ID ?? "price_xxx",
    tools: 999,
    calls_per_day: 10_000,
    rate_limit_rpm: 100,
    features: [
      "Unlimited tools",
      "10,000 calls / day",
      "Priority support",
      "Advanced observability",
      "Managed auth (server-side keys)",
    ],
    highlighted: true,
  },
  {
    id: "team",
    name: "Team",
    price: 25,
    stripe_price_id: process.env.STRIPE_TEAM_PRICE_ID ?? "price_yyy",
    tools: 9999,
    calls_per_day: 100_000,
    rate_limit_rpm: 500,
    features: [
      "Everything in Pro",
      "Custom tool integrations",
      "Team access (5 seats)",
      "Audit logs",
      "99.9% SLA",
    ],
    highlighted: false,
  },
];

export function getTierById(id: string): PricingTier | undefined {
  return PRICING_TIERS.find((t) => t.id === id);
}
