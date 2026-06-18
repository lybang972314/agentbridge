// Pricing — two tiers, one decision. Free to start. $0.99 to scale.

export interface PricingTier {
  id: string;
  name: string;
  price: number;
  stripe_price_id: string;
  tools: number;
  calls_per_month: number;
  daily_limit: number;
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
    calls_per_month: 1_000,
    daily_limit: 100,
    rate_limit_rpm: 10,
    features: [
      "3 tools from registry",
      "1,000 calls / month",
      "24-hour log retention",
      "Passthrough auth (bring your own keys)",
      "Community support",
    ],
    highlighted: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: 0.99,
    stripe_price_id: process.env.STRIPE_PRO_PRICE_ID ?? "price_xxx",
    tools: 9999,
    calls_per_month: 50_000,
    daily_limit: 5_000,
    rate_limit_rpm: 100,
    features: [
      "Unlimited tools",
      "50,000 calls / month",
      "30-day log retention",
      "Managed auth (store keys server-side)",
      "Priority support",
    ],
    highlighted: true,
  },
];

export function getTierById(id: string): PricingTier | undefined {
  return PRICING_TIERS.find((t) => t.id === id);
}
