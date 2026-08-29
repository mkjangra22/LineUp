/**
 * Centralized LineUp Subscription & Pricing Plan Configuration
 *
 * This configuration is the single source of truth for both frontend
 * plan displays and future server-side Razorpay order generation.
 * Prices and plan specifications should NEVER be hardcoded across UI components.
 */

export const PLANS = {
  free: {
    id: "free",
    name: "Free",
    price: 0,
    currency: "INR",
    billingPeriod: "monthly",
    intervalDisplay: "/month",
    priceDisplay: "₹0",
    description: "Essential queue management for single-counter setups.",
    status: "active",
    isAvailable: true,
    badge: "Forever Free",
    cta: "Start with Free",
    features: [
      "1 live queue counter",
      "Printable branded QR code",
      "Real-time customer status page",
      "Call, serve & skip queue actions",
      "Queue pause & resume control",
      "Standard community support",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 999,
    currency: "INR",
    billingPeriod: "monthly",
    intervalDisplay: "/month",
    priceDisplay: "₹999",
    description: "Advanced branding & multi-queue capabilities for busy clinics & salons.",
    status: "coming_soon",
    isAvailable: false,
    badge: "Coming Soon",
    cta: "Coming Soon",
    features: [
      "Up to 5 concurrent queues",
      "Custom brand colors & logo display",
      "SMS & WhatsApp notifications",
      "Queue analytics & peak-hour insights",
      "Priority customer support",
      "Custom wait-time estimations",
    ],
  },
  business: {
    id: "business",
    name: "Business",
    price: 2499,
    currency: "INR",
    billingPeriod: "monthly",
    intervalDisplay: "/month",
    priceDisplay: "₹2,499",
    description: "Complete queue management system for hospitals, banks & service centers.",
    status: "coming_soon",
    isAvailable: false,
    badge: "Coming Soon",
    cta: "Coming Soon",
    features: [
      "Unlimited queues & counters",
      "Multi-staff accounts & role permissions",
      "Kiosk mode & digital display screens",
      "Automated counter routing",
      "Dedicated account manager",
      "Custom domain & webhook integration",
    ],
  },
};

export const PLAN_LIST = Object.values(PLANS);

export function getPlan(planId) {
  return PLANS[planId?.toLowerCase()] ?? PLANS.free;
}

export function formatPrice(amount, currency = "INR") {
  if (amount === 0) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
