import path from "path";
import { fileURLToPath } from "url";
import { config as loadEnv } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, "../../..", ".env") });

import app from "./app.js";
import { db, companiesTable } from "@workspace/db";
import { fetchApifyReviews } from "./lib/apify.js";
import { detectSentiment } from "./lib/openai.js";
import { reviewsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const rawPort = process.env["PORT"] ?? "5000";
const port = Number(rawPort) || 5000;

// Sync automatique hebdomadaire
async function syncAllCompanies() {
  console.log("[CRON] Démarrage sync Apify hebdomadaire...");
  try {
    const companies = await db.select().from(companiesTable);
    for (const company of companies) {
      const datasetUrl = company.apifyDatasetUrl || process.env.APIFY_DATASET_URL;
      if (!datasetUrl) continue;
      const apifyReviews = await fetchApifyReviews(datasetUrl);
      const existingReviews = await db.select().from(reviewsTable).where(eq(reviewsTable.companyId, company.id));
      const existingIds = new Set(existingReviews.filter(r => r.externalId).map(r => r.externalId));
      let newCount = 0;
      for (const apifyReview of apifyReviews) {
        const externalId = apifyReview.reviewId || `${apifyReview.name}-${apifyReview.publishedAtDate}`;
        if (existingIds.has(externalId)) continue;
        const text = apifyReview.text || apifyReview.textTranslated || "";
        const sentiment = await detectSentiment(text);
        await db.insert(reviewsTable).values({
          companyId: company.id,
          authorName: apifyReview.name || "Anonyme",
          rating: apifyReview.stars || apifyReview.rating || 3,
          text: text || null,
          publishDate: apifyReview.publishedAtDate || apifyReview.publishAt || null,
          ownerReply: apifyReview.responseFromOwnerText || null,
          externalId,
          status: apifyReview.responseFromOwnerText ? "publié" : "nouveau",
          sentiment,
        });
        newCount++;
      }
      console.log(`[CRON] ${company.name}: ${newCount} nouveaux avis`);
    }
  } catch (err) {
    console.error("[CRON] Erreur sync:", err);
  }
}

// Lancer toutes les 7 jours (604800000 ms)
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
setInterval(syncAllCompanies, SEVEN_DAYS);

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});