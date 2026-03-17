import { pgTable, text, integer, uuid, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const companiesTable = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").notNull().references(() => usersTable.id),
  name: text("name").notNull(),
  sector: text("sector"),
  address: text("address"),
  googleLocationId: text("google_location_id"),
  apifyDatasetUrl: text("apify_dataset_url"),
  defaultTone: text("default_tone", {
    enum: ["chaleureux", "professionnel", "direct"],
  })
    .notNull()
    .default("professionnel"),
  signature: text("signature").notNull().default("L'équipe"),
  primaryColor: text("primary_color").notNull().default("#1E40AF"),
  secondaryColor: text("secondary_color").notNull().default("#059669"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCompanySchema = createInsertSchema(companiesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companiesTable.$inferSelect;
