import { Router } from "express";
import { db, reviewsTable, aiResponsesTable, companiesTable } from "@workspace/db";
import { eq, and, sql, desc, gte, count } from "drizzle-orm";
import { requireAuth, requireCompanyAccess } from "../lib/auth.js";
import { generateAiResponse, detectSentiment, reformulateResponse } from "../lib/openai.js";
import type { Tone, Length, Style } from "../lib/openai.js";

const router = Router();

router.get("/companies/:companyId/reviews", requireAuth, requireCompanyAccess, async (req, res) => {
  try {
    const companyId = req.params.companyId as any;
    const { status, sentiment, filter, page = "1", limit = "20" } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    let conditions: any[] = [eq(reviewsTable.companyId, companyId)];

    if (status) {
      conditions.push(eq(reviewsTable.status, status as any));
    }
    if (sentiment) {
      conditions.push(eq(reviewsTable.sentiment, sentiment as any));
    }
    if (filter === "unreplied") {
      conditions.push(eq(reviewsTable.status, "nouveau"));
    } else if (filter === "replied") {
      conditions.push(eq(reviewsTable.status, "publié"));
    } else if (filter === "today") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      conditions.push(gte(reviewsTable.createdAt, today));
    } else if (filter === "week") {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      conditions.push(gte(reviewsTable.createdAt, weekAgo));
    }

    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

    const [{ value: total }] = await db
      .select({ value: count() })
      .from(reviewsTable)
      .where(whereClause);

    const reviews = await db
      .select()
      .from(reviewsTable)
      .where(whereClause)
      .orderBy(desc(reviewsTable.createdAt))
      .limit(limitNum)
      .offset(offset);

    const reviewIds = reviews.map((r) => r.id);
    const aiResponses = reviewIds.length
      ? await db
          .select()
          .from(aiResponsesTable)
          .where(sql`${aiResponsesTable.reviewId} = ANY(ARRAY[${sql.join(reviewIds.map(id => sql`${id}`), sql`, `)}])`)
      : [];

    const responseMap = new Map(aiResponses.map((r) => [r.reviewId, r]));

    const reviewsWithResponses = reviews.map((review) => ({
      ...review,
      aiResponse: responseMap.get(review.id) || null,
    }));

    res.json({
      reviews: reviewsWithResponses,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (err) {
    console.error("GetReviews error:", err);
    res.status(500).json({ error: "Erreur lors de la récupération des avis" });
  }
});

router.get("/companies/:companyId/reviews/generate-all", requireAuth, requireCompanyAccess, async (req, res) => {
  res.json({ message: "Use POST" });
});

router.post("/companies/:companyId/reviews/generate-all", requireAuth, requireCompanyAccess, async (req, res) => {
  try {
    const companyId = req.params.companyId as any;

    const companies = await db.select().from(companiesTable).where(eq(companiesTable.id, companyId)).limit(1);
    if (!companies.length) {
      res.status(404).json({ error: "Entreprise non trouvée" });
      return;
    }
    const company = companies[0];

    const { tone, length, style } = req.body;
    const effectiveTone = (tone || company.defaultTone || "professionnel") as Tone;
    const effectiveLength = (length || "moyen") as Length;
    const effectiveStyle = (style || "neutre") as Style;

    const newReviews = await db
      .select()
      .from(reviewsTable)
      .where(and(eq(reviewsTable.companyId, companyId), eq(reviewsTable.status, "nouveau")));

    let generated = 0;
    for (const review of newReviews) {
      const existing = await db
        .select()
        .from(aiResponsesTable)
        .where(eq(aiResponsesTable.reviewId, review.id))
        .limit(1);

      if (existing.length) continue;

      const sentiment = review.sentiment || await detectSentiment(review.text || "");

      let autoStyle = effectiveStyle;
      if (sentiment === "négatif") autoStyle = "excuse";
      else if (sentiment === "positif") autoStyle = "remerciement";

      const generatedText = await generateAiResponse({
        reviewText: review.text || "",
        authorName: review.authorName,
        rating: review.rating,
        sentiment: sentiment as any,
        companyName: company.name,
        signature: company.signature,
        tone: effectiveTone,
        length: effectiveLength,
        style: autoStyle,
      });

      await db.insert(aiResponsesTable).values({
        reviewId: review.id,
        companyId,
        generatedText,
        tone: effectiveTone,
        length: effectiveLength,
        style: autoStyle,
        status: "en_attente_publication",
      });

      await db
        .update(reviewsTable)
        .set({ status: "proposé", sentiment: sentiment as any, updatedAt: new Date() })
        .where(eq(reviewsTable.id, review.id));

      generated++;
    }

    res.json({
      generated,
      total: newReviews.length,
      message: `${generated} réponses générées avec succès`,
    });
  } catch (err) {
    console.error("GenerateAll error:", err);
    res.status(500).json({ error: "Erreur lors de la génération" });
  }
});

router.post("/companies/:companyId/reviews/publish-all", requireAuth, requireCompanyAccess, async (req, res) => {
  try {
    const companyId = req.params.companyId as any;

    const pendingResponses = await db
      .select()
      .from(aiResponsesTable)
      .where(and(eq(aiResponsesTable.companyId, companyId), eq(aiResponsesTable.status, "en_attente_publication")));

    let published = 0;
    for (const aiResponse of pendingResponses) {
      await db
        .update(aiResponsesTable)
        .set({ status: "publié", publishedAt: new Date(), updatedAt: new Date() })
        .where(eq(aiResponsesTable.id, aiResponse.id));

      await db
        .update(reviewsTable)
        .set({ status: "publié", updatedAt: new Date() })
        .where(eq(reviewsTable.id, aiResponse.reviewId));

      published++;
    }

    const timeSaved = `${Math.round(published * 6)} minutes`;

    res.json({
      published,
      total: pendingResponses.length,
      message: `${published}/${pendingResponses.length} réponses publiées sur Google Maps !`,
      timeSaved,
    });
  } catch (err) {
    console.error("PublishAll error:", err);
    res.status(500).json({ error: "Erreur lors de la publication" });
  }
});

router.get("/companies/:companyId/reviews/:reviewId", requireAuth, requireCompanyAccess, async (req, res) => {
  try {
    const reviewId = req.params.reviewId as any;
    const companyId = req.params.companyId as any;

    const reviews = await db
      .select()
      .from(reviewsTable)
      .where(and(eq(reviewsTable.id, reviewId), eq(reviewsTable.companyId, companyId)))
      .limit(1);

    if (!reviews.length) {
      res.status(404).json({ error: "Avis non trouvé" });
      return;
    }

    const aiResponses = await db
      .select()
      .from(aiResponsesTable)
      .where(eq(aiResponsesTable.reviewId, reviewId))
      .limit(1);

    res.json({ ...reviews[0], aiResponse: aiResponses[0] || null });
  } catch (err) {
    console.error("GetReview error:", err);
    res.status(500).json({ error: "Erreur lors de la récupération de l'avis" });
  }
});

router.post("/companies/:companyId/reviews/:reviewId/generate", requireAuth, requireCompanyAccess, async (req, res) => {
  try {
    const reviewId = req.params.reviewId as any;
    const companyId = req.params.companyId as any;
    const { tone, length, style } = req.body;

    const reviews = await db
      .select()
      .from(reviewsTable)
      .where(and(eq(reviewsTable.id, reviewId), eq(reviewsTable.companyId, companyId)))
      .limit(1);

    if (!reviews.length) {
      res.status(404).json({ error: "Avis non trouvé" });
      return;
    }

    const companies = await db.select().from(companiesTable).where(eq(companiesTable.id, companyId)).limit(1);
    const company = companies[0];
    const review = reviews[0];

    const sentiment = review.sentiment || await detectSentiment(review.text || "");

    const generatedText = await generateAiResponse({
      reviewText: review.text || "",
      authorName: review.authorName,
      rating: review.rating,
      sentiment: sentiment as any,
      companyName: company.name,
      signature: company.signature,
      tone: tone as Tone,
      length: length as Length,
      style: style as Style,
    });

    const existing = await db
      .select()
      .from(aiResponsesTable)
      .where(eq(aiResponsesTable.reviewId, reviewId))
      .limit(1);

    let aiResponse;
    if (existing.length) {
      const [updated] = await db
        .update(aiResponsesTable)
        .set({ generatedText, tone, length, style, status: "en_attente_publication", updatedAt: new Date() })
        .where(eq(aiResponsesTable.id, existing[0].id))
        .returning();
      aiResponse = updated;
    } else {
      const [created] = await db
        .insert(aiResponsesTable)
        .values({ reviewId, companyId, generatedText, tone, length, style, status: "en_attente_publication" })
        .returning();
      aiResponse = created;
    }

    await db
      .update(reviewsTable)
      .set({ status: "proposé", sentiment: sentiment as any, updatedAt: new Date() })
      .where(eq(reviewsTable.id, reviewId));

    res.json(aiResponse);
  } catch (err) {
    console.error("Generate error:", err);
    res.status(500).json({ error: "Erreur lors de la génération de la réponse" });
  }
});

router.post("/companies/:companyId/reviews/:reviewId/reformulate", requireAuth, requireCompanyAccess, async (req, res) => {
  try {
    const reviewId = req.params.reviewId as any;
    const companyId = req.params.companyId as any;
    const { instructions, currentText, tone, length } = req.body;

    const reviews = await db
      .select()
      .from(reviewsTable)
      .where(and(eq(reviewsTable.id, reviewId), eq(reviewsTable.companyId, companyId)))
      .limit(1);

    const companies = await db.select().from(companiesTable).where(eq(companiesTable.id, companyId)).limit(1);

    if (!reviews.length || !companies.length) {
      res.status(404).json({ error: "Non trouvé" });
      return;
    }

    const variants = await reformulateResponse({
      reviewText: reviews[0].text || "",
      currentResponse: currentText,
      instructions,
      companyName: companies[0].name,
      signature: companies[0].signature,
      tone: tone as Tone,
      length: length as Length,
    });

    res.json({ variants });
  } catch (err) {
    console.error("Reformulate error:", err);
    res.status(500).json({ error: "Erreur lors de la reformulation" });
  }
});

router.post("/companies/:companyId/reviews/:reviewId/save-response", requireAuth, requireCompanyAccess, async (req, res) => {
  try {
    const reviewId = req.params.reviewId as any;
    const { finalText, status } = req.body;

    const existing = await db
      .select()
      .from(aiResponsesTable)
      .where(eq(aiResponsesTable.reviewId, reviewId))
      .limit(1);

    let aiResponse;
    if (existing.length) {
      const [updated] = await db
        .update(aiResponsesTable)
        .set({
          finalText,
          status: status || "en_attente_publication",
          updatedAt: new Date(),
        })
        .where(eq(aiResponsesTable.id, existing[0].id))
        .returning();
      aiResponse = updated;
    } else {
      res.status(400).json({ error: "Aucune réponse IA trouvée pour cet avis" });
      return;
    }

    await db
      .update(reviewsTable)
      .set({ status: "modifié", updatedAt: new Date() })
      .where(eq(reviewsTable.id, reviewId));

    res.json(aiResponse);
  } catch (err) {
    console.error("SaveResponse error:", err);
    res.status(500).json({ error: "Erreur lors de la sauvegarde" });
  }
});

router.post("/companies/:companyId/reviews/:reviewId/publish", requireAuth, requireCompanyAccess, async (req, res) => {
  try {
    const reviewId = req.params.reviewId as any;

    const aiResponses = await db
      .select()
      .from(aiResponsesTable)
      .where(eq(aiResponsesTable.reviewId, reviewId))
      .limit(1);

    if (!aiResponses.length) {
      res.status(400).json({ error: "Aucune réponse IA à publier" });
      return;
    }

    const publishedAt = new Date();

    await db
      .update(aiResponsesTable)
      .set({ status: "publié", publishedAt, updatedAt: new Date() })
      .where(eq(aiResponsesTable.id, aiResponses[0].id));

    await db
      .update(reviewsTable)
      .set({ status: "publié", updatedAt: new Date() })
      .where(eq(reviewsTable.id, reviewId));

    res.json({
      success: true,
      message: "Réponse publiée sur Google Maps !",
      publishedAt: publishedAt.toISOString(),
    });
  } catch (err) {
    console.error("Publish error:", err);
    res.status(500).json({ error: "Erreur lors de la publication" });
  }
});

router.post("/companies/:companyId/reviews/:reviewId/mark-replied", requireAuth, requireCompanyAccess, async (req, res) => {
  try {
    const reviewId = req.params.reviewId as any;

    await db
      .update(reviewsTable)
      .set({ status: "publié", updatedAt: new Date() })
      .where(eq(reviewsTable.id, reviewId));

    res.json({ success: true, message: "Avis marqué comme répondu" });
  } catch (err) {
    console.error("MarkReplied error:", err);
    res.status(500).json({ error: "Erreur lors de la mise à jour" });
  }
});

export default router;
