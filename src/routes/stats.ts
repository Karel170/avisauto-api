import { Router } from "express";
import { db, reviewsTable, aiResponsesTable } from "@workspace/db";
import { eq, and, count, avg, sql } from "drizzle-orm";
import { requireAuth, requireCompanyAccess } from "../lib/auth.js";

const router = Router();

router.get("/companies/:companyId/stats", requireAuth, requireCompanyAccess, async (req, res) => {
  try {
    const companyId = req.params.companyId as any;

    const [{ total }] = await db
      .select({ total: count() })
      .from(reviewsTable)
      .where(eq(reviewsTable.companyId, companyId));

    const [{ unreplied }] = await db
      .select({ unreplied: count() })
      .from(reviewsTable)
      .where(and(eq(reviewsTable.companyId, companyId), eq(reviewsTable.status, "nouveau")));

    const [{ replied }] = await db
      .select({ replied: count() })
      .from(reviewsTable)
      .where(and(eq(reviewsTable.companyId, companyId), eq(reviewsTable.status, "publié")));

    const [{ avgRating }] = await db
      .select({ avgRating: avg(reviewsTable.rating) })
      .from(reviewsTable)
      .where(eq(reviewsTable.companyId, companyId));

    const [{ positif }] = await db
      .select({ positif: count() })
      .from(reviewsTable)
      .where(and(eq(reviewsTable.companyId, companyId), eq(reviewsTable.sentiment, "positif")));

    const [{ neutre }] = await db
      .select({ neutre: count() })
      .from(reviewsTable)
      .where(and(eq(reviewsTable.companyId, companyId), eq(reviewsTable.sentiment, "neutre")));

    const [{ negatif }] = await db
      .select({ negatif: count() })
      .from(reviewsTable)
      .where(and(eq(reviewsTable.companyId, companyId), eq(reviewsTable.sentiment, "négatif")));

    const ratingDistribution = await Promise.all([1,2,3,4,5].map(async (r) => {
      const [{ cnt }] = await db
        .select({ cnt: count() })
        .from(reviewsTable)
        .where(and(eq(reviewsTable.companyId, companyId), sql`${reviewsTable.rating} = ${r}`));
      return { rating: r, count: Number(cnt) };
    }));

    const responseRate = total > 0 ? Math.round((Number(replied) / Number(total)) * 100) : 0;
    const publishedCount = Number(replied);
    const timeSaved = `${Math.round(publishedCount * 6)} minutes économisées`;

    const reviewsByDay = await db
      .select({
        date: sql<string>`DATE(${reviewsTable.createdAt})`.as("date"),
        count: count(),
      })
      .from(reviewsTable)
      .where(eq(reviewsTable.companyId, companyId))
      .groupBy(sql`DATE(${reviewsTable.createdAt})`)
      .orderBy(sql`DATE(${reviewsTable.createdAt})`);

    res.json({
      totalReviews: Number(total),
      unrepliedReviews: Number(unreplied),
      repliedReviews: Number(replied),
      responseRate,
      averageRating: Number(avgRating || 0),
      sentimentBreakdown: {
        positif: Number(positif),
        neutre: Number(neutre),
        negatif: Number(negatif),
      },
      reviewsByDay: reviewsByDay.map((r) => ({ date: r.date, count: Number(r.count) })),
      responseRateByDay: reviewsByDay.map((r) => ({ date: r.date, rate: responseRate })),
      timeSaved,
      ratingDistribution,
    });
  } catch (err) {
    console.error("GetStats error:", err);
    res.status(500).json({ error: "Erreur lors de la récupération des statistiques" });
  }
});

export default router;
