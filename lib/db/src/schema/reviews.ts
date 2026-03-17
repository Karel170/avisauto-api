import { pgTable, text, integer, uuid, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { companiesTable } from "./companies";

export const reviewsTable = pgTable("reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companiesTable.id),
  authorName: text("author_name").notNull(),
  rating: integer("rating").notNull(),
  text: text("text"),
  publishDate: text("publish_date"),
  ownerReply: text("owner_reply"),
  externalId: text("external_id"),
  status: text("status", {
    enum: ["nouveau", "proposé", "modifié", "publié"],
  })
    .notNull()
    .default("nouveau"),
  sentiment: text("sentiment", {
    enum: ["positif", "neutre", "négatif"],
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertReviewSchema = createInsertSchema(reviewsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Review = typeof reviewsTable.$inferSelect;
