import { Router } from "express";
import { db, companiesTable, reviewsTable, aiResponsesTable, subscriptionsTable } from "@workspace/db";
import { eq, count, avg, sql } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth.js";

const router = Router();

router.get("/admin/companies", requireAuth, requireAdmin, async (req, res) => {
  try {
    const companies = await db.select().from(companiesTable);

    const companiesWithStats = await Promise.all(
      companies.map(async (company) => {
        const [{ total }] = await db
          .select({ total: count() })
          .from(reviewsTable)
          .where(eq(reviewsTable.companyId, company.id));

        const [{ unreplied }] = await db
          .select({ unreplied: count() })
          .from(reviewsTable)
          .where(eq(reviewsTable.companyId, company.id));

        const [{ avgRating }] = await db
          .select({ avgRating: avg(reviewsTable.rating) })
          .from(reviewsTable)
          .where(eq(reviewsTable.companyId, company.id));

        const subs = await db
          .select()
          .from(subscriptionsTable)
          .where(eq(subscriptionsTable.companyId, company.id))
          .limit(1);

        const totalNum = Number(total);
        const unrepliedNum = Number(unreplied);
        const repliedNum = totalNum - unrepliedNum;

        return {
          id: company.id,
          name: company.name,
          sector: company.sector,
          totalReviews: totalNum,
          unrepliedReviews: unrepliedNum,
          responseRate: totalNum > 0 ? Math.round((repliedNum / totalNum) * 100) : 0,
          averageRating: Number(avgRating || 0),
          subscriptionStatus: subs[0]?.status || "none",
          createdAt: company.createdAt,
        };
      })
    );

    res.json({ companies: companiesWithStats, total: companies.length });
  } catch (err) {
    console.error("AdminGetCompanies error:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/admin/stats", requireAuth, requireAdmin, async (req, res) => {
  try {
    const [{ totalCompanies }] = await db
      .select({ totalCompanies: count() })
      .from(companiesTable);

    const [{ totalReviews }] = await db
      .select({ totalReviews: count() })
      .from(reviewsTable);

    const [{ totalResponses }] = await db
      .select({ totalResponses: count() })
      .from(aiResponsesTable);

    const [{ totalPublished }] = await db
      .select({ totalPublished: count() })
      .from(aiResponsesTable)
      .where(eq(aiResponsesTable.status, "publié"));

    const [{ activeSubscriptions }] = await db
      .select({ activeSubscriptions: count() })
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.status, "active"));

    res.json({
      totalCompanies: Number(totalCompanies),
      totalReviews: Number(totalReviews),
      totalResponses: Number(totalResponses),
      totalPublished: Number(totalPublished),
      activeSubscriptions: Number(activeSubscriptions),
    });
  } catch (err) {
    console.error("AdminGetStats error:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
