import { Router } from "express";
import { db, aiResponsesTable, reviewsTable } from "@workspace/db";
import { eq, and, count } from "drizzle-orm";
import { requireAuth, requireCompanyAccess } from "../lib/auth.js";

const router = Router();

router.get("/companies/:companyId/ai-responses", requireAuth, requireCompanyAccess, async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId);
    const { status } = req.query;

    let conditions: any[] = [eq(aiResponsesTable.companyId, companyId)];
    if (status) {
      conditions.push(eq(aiResponsesTable.status, status as any));
    }

    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

    const responses = await db
      .select()
      .from(aiResponsesTable)
      .where(whereClause)
      .orderBy(aiResponsesTable.createdAt);

    const [{ value: total }] = await db
      .select({ value: count() })
      .from(aiResponsesTable)
      .where(whereClause);

    res.json({ responses, total });
  } catch (err) {
    console.error("GetAiResponses error:", err);
    res.status(500).json({ error: "Erreur lors de la récupération des réponses" });
  }
});

export default router;
