import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  credits: integer("credits").notNull().default(0),
  referralCode: text("referral_code").unique(),
  totalReferrals: integer("total_referrals").notNull().default(0),
  convertedReferrals: integer("converted_referrals").notNull().default(0),
});

export const referrals = sqliteTable("referrals", {
  id: text("id").primaryKey(),
  referrerId: text("referrer_id").notNull(),
  refereeId: text("referee_id"),
  email: text("email"),
  code: text("code").notNull().unique(),
  status: text("status").notNull().default("pending"),
  channel: text("channel"),
  createdAt: integer("created_at").notNull().default(0),
  registeredAt: integer("registered_at"),
  convertedAt: integer("converted_at"),
}, (table) => ({
  referrerIdx: index("idx_referrals_referrer_id").on(table.referrerId),
}));

export const referralRewards = sqliteTable("referral_rewards", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  referralId: text("referral_id").notNull(),
  type: text("type").notNull(),
  amount: integer("amount"),
  status: text("status").notNull().default("pending"),
  createdAt: integer("created_at").notNull().default(0),
  claimedAt: integer("claimed_at"),
}, (table) => ({
  userIdx: index("idx_referral_rewards_user_id").on(table.userId),
}));

export const badges = sqliteTable("badges", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  type: text("type").notNull(),
  name: text("name").notNull(),
  icon: text("icon").notNull(),
  earnedAt: integer("earned_at").notNull().default(0),
}, (table) => ({
  userIdx: index("idx_badges_user_id").on(table.userId),
}));

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

export const voiceProfiles = sqliteTable("voice_profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull().default("Mi perfil de voz"),
  profile: text("profile", { mode: "json" }).notNull(),
  isActive: integer("is_active").notNull().default(0),
  createdAt: integer("created_at").notNull().default(0),
}, (table) => ({
  userIdIdx: index("idx_voice_profiles_user_id").on(table.userId),
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