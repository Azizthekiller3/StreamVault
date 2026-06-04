import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const installedExtensionsTable = pgTable("installed_extensions", {
  id: serial("id").primaryKey(),
  sourceAuthor: text("source_author").notNull(),
  sourceUrl: text("source_url").notNull(),
  value: text("value").notNull(),
  displayName: text("display_name").notNull(),
  type: text("type").notNull().default("global"),
  icon: text("icon"),
  version: text("version").notNull().default("0.0.1"),
  enabled: boolean("enabled").default(true).notNull(),
  baseUrl: text("base_url"),
  catalogModule: text("catalog_module"),
  postsModule: text("posts_module"),
  metaModule: text("meta_module"),
  streamModule: text("stream_module"),
  episodesModule: text("episodes_module"),
  installedAt: timestamp("installed_at").defaultNow().notNull(),
});

export const insertExtensionSchema = createInsertSchema(installedExtensionsTable).omit({ id: true, installedAt: true });
export type InsertExtension = z.infer<typeof insertExtensionSchema>;
export type InstalledExtension = typeof installedExtensionsTable.$inferSelect;
