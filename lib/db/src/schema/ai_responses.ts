import { pgTable, text, integer, uuid, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { reviewsTable } from "./reviews";
import { companiesTable } from "./companies";

export const aiResponsesTable = pgTable("ai_responses", {
  id: uuid("id").primaryKey().defaultRandom(),
  reviewId: uuid("review_id")
    .notNull()
    .references(() => reviewsTable.id),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companiesTable.id),
  generatedText: text("generated_text").notNull(),
  finalText: text("final_text"),
  tone: text("tone", {
    enum: ["chaleureux", "professionnel", "direct"],
  })
    .notNull()
    .default("professionnel"),
  length: text("length", {
    enum: ["court", "moyen", "long"],
  })
    .notNull()
    .default("moyen"),
  style: text("style", {
    enum: ["remerciement", "excuse", "résolution", "neutre"],
  })
    .notNull()
    .default("neutre"),
  status: text("status", {
    enum: ["proposé", "en_attente_publication", "publié"],
  })
    .notNull()
    .default("proposé"),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAiResponseSchema = createInsertSchema(aiResponsesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAiResponse = z.infer<typeof insertAiResponseSchema>;
export type AiResponse = typeof aiResponsesTable.$inferSelect;
