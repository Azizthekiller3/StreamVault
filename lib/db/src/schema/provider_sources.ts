import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const providerSourcesTable = pgTable("provider_sources", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  addedAt: timestamp("added_at").defaultNow().notNull(),
});

export const insertProviderSourceSchema = createInsertSchema(providerSourcesTable).omit({ id: true, addedAt: true });
export type InsertProviderSource = z.infer<typeof insertProviderSourceSchema>;
export type ProviderSource = typeof providerSourcesTable.$inferSelect;
