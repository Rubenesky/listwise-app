import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

// Tabla de listados (productos)
export const listings = sqliteTable("listings", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  productName: text("product_name").notNull(),
  category: text("category"),
  attributes: text("attributes", { mode: "json" }),
  styleProfileId: text("style_profile_id"),
  generatedTitle: text("generated_title"),
  generatedBullets: text("generated_bullets", { mode: "json" }),
  generatedDescription: text("generated_description"),
  status: text("status").notNull().default("PENDING"),
  errorMessage: text("error_message"),
  createdAt: integer("created_at").notNull().default(0),
}, (table) => ({
  userIdIdx: index("idx_listings_user_id").on(table.userId),
}));

// Tabla de suscripciones (NUEVA)
export const subscriptions = sqliteTable("subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  plan: text("plan").notNull(),
  status: text("status").notNull(),
  currentPeriodStart: integer("current_period_start"),
  currentPeriodEnd: integer("current_period_end"),
  createdAt: integer("created_at").default(0),
}, (table) => ({
  userIdIdx: index("idx_subscriptions_user_id").on(table.userId),
}));