import { Router } from "express";
import { db, subscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireCompanyAccess } from "../lib/auth.js";

const router = Router();

router.get("/companies/:companyId/subscription", requireAuth, requireCompanyAccess, async (req, res) => {
  try {
    const companyId = req.params.companyId as any;

    const subs = await db
      .select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.companyId, companyId))
      .limit(1);

    if (!subs.length) {
      res.json({ companyId, status: "none" });
      return;
    }

    res.json(subs[0]);
  } catch (err) {
    console.error("GetSubscription error:", err);
    res.status(500).json({ error: "Erreur lors de la récupération de l'abonnement" });
  }
});

router.post("/companies/:companyId/subscription/checkout", requireAuth, requireCompanyAccess, async (req, res) => {
  try {
    const { plan, billingPeriod } = req.body;

    const prices: Record<string, Record<string, number>> = {
      starter: { monthly: 2900, annual: 29000 },
      pro: { monthly: 7900, annual: 79000 },
      agency: { monthly: 19900, annual: 199000 },
    };

    const amount = prices[plan]?.[billingPeriod] || 2900;

    res.json({
      url: `${req.headers.origin || ""}/?checkout=success&plan=${plan}&amount=${amount}`,
    });
  } catch (err) {
    console.error("Checkout error:", err);
    res.status(500).json({ error: "Erreur lors de la création du paiement" });
  }
});

router.post("/webhooks/stripe", async (req, res) => {
  res.json({ success: true });
});

export default router;
