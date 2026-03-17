import { Router } from "express";
import { db, companiesTable, reviewsTable, aiResponsesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, requireCompanyAccess } from "../lib/auth.js";
import { fetchApifyReviews } from "../lib/apify.js";
import { detectSentiment } from "../lib/openai.js";

const router = Router();

router.get("/companies/:companyId", requireAuth, requireCompanyAccess, async (req, res) => {
  try {
    const companyId = req.params.companyId as any;
    const companies = await db
      .select()
      .from(companiesTable)
      .where(eq(companiesTable.id, companyId))
      .limit(1);

    if (!companies.length) {
      res.status(404).json({ error: "Entreprise non trouvée" });
      return;
    }

    res.json(companies[0]);
  } catch (err) {
    console.error("GetCompany error:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.put("/companies/:companyId", requireAuth, requireCompanyAccess, async (req, res) => {
  try {
    const companyId = req.params.companyId as any;
    const {
      name, sector, address, googleLocationId, apifyDatasetUrl,
      defaultTone, signature, primaryColor, secondaryColor
    } = req.body;

    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name;
    if (sector !== undefined) updateData.sector = sector;
    if (address !== undefined) updateData.address = address;
    if (googleLocationId !== undefined) updateData.googleLocationId = googleLocationId;
    if (apifyDatasetUrl !== undefined) updateData.apifyDatasetUrl = apifyDatasetUrl;
    if (defaultTone !== undefined) updateData.defaultTone = defaultTone;
    if (signature !== undefined) updateData.signature = signature;
    if (primaryColor !== undefined) updateData.primaryColor = primaryColor;
    if (secondaryColor !== undefined) updateData.secondaryColor = secondaryColor;

    const [updated] = await db
      .update(companiesTable)
      .set(updateData)
      .where(eq(companiesTable.id, companyId))
      .returning();

    res.json(updated);
  } catch (err) {
    console.error("UpdateCompany error:", err);
    res.status(500).json({ error: "Erreur lors de la mise à jour" });
  }
});

router.post("/companies/:companyId/sync", requireAuth, requireCompanyAccess, async (req, res) => {
  try {
    const companyId = req.params.companyId as any;

    const companies = await db
      .select()
      .from(companiesTable)
      .where(eq(companiesTable.id, companyId))
      .limit(1);

    if (!companies.length) {
      res.status(404).json({ error: "Entreprise non trouvée" });
      return;
    }

    const company = companies[0];
    const datasetUrl =
      company.apifyDatasetUrl ||
      process.env.APIFY_DATASET_URL ||
      "https://api.apify.com/v2/datasets/LMbHHO0LQcLICM1eB/items?format=json&clean=true";

    const apifyReviews = await fetchApifyReviews(datasetUrl);

    let newCount = 0;
    const existingReviews = await db
      .select()
      .from(reviewsTable)
      .where(eq(reviewsTable.companyId, companyId));

    const existingExternalIds = new Set(
      existingReviews
        .filter((r) => r.externalId)
        .map((r) => r.externalId)
    );

    for (const apifyReview of apifyReviews) {
      const externalId = apifyReview.reviewId || `${apifyReview.name}-${apifyReview.publishedAtDate}`;

      if (existingExternalIds.has(externalId)) continue;

      const rating = apifyReview.stars || apifyReview.rating || 3;
      const text = apifyReview.text || apifyReview.textTranslated || "";
      const sentiment = await detectSentiment(text);

      await db.insert(reviewsTable).values({
        companyId,
        authorName: apifyReview.name || "Anonyme",
        rating,
        text: text || null,
        publishDate: apifyReview.publishedAtDate || apifyReview.publishAt || null,
        ownerReply: apifyReview.responseFromOwnerText || null,
        externalId,
        status: apifyReview.responseFromOwnerText ? "publié" : "nouveau",
        sentiment,
      });

      newCount++;
    }

    res.json({
      synced: apifyReviews.length,
      total: apifyReviews.length,
      newReviews: newCount,
      message: `${newCount} nouveaux avis importés sur ${apifyReviews.length} au total`,
    });
  } catch (err) {
    console.error("Sync error:", err);
    res.status(500).json({ error: "Erreur lors de la synchronisation" });
  }
});

export default router;
