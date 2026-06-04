import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const providersTable = pgTable("providers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  type: text("type").notNull(),
  icon: text("icon"),
  enabled: boolean("enabled").default(true).notNull(),
  installedAt: timestamp("installed_at").defaultNow().notNull(),
});

export const insertProviderSchema = createInsertSchema(providersTable).omit({ id: true, installedAt: true });
export type InsertProvider = z.infer<typeof insertProviderSchema>;
export type Provider = typeof providersTable.$inferSelect;
