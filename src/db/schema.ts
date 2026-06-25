import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  credits: integer("credits").notNull().default(0),
  referralCode: text("referral_code").unique(),
  totalReferrals: integer("total_referrals").notNull().default(0),
  convertedReferrals: integer("converted_referrals").notNull().default(0),
  agentCredits: integer("agent_credits").default(10),
  agentPlan: text("agent_plan").default("free"),
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
  selectedVariant: text("selected_variant"),
  slug: text("slug").unique(),
  shareCount: integer("share_count").default(0),
  status: text("status").notNull().default("PENDING"),
  errorMessage: text("error_message"),
  createdAt: integer("created_at").notNull().default(0),
}, (table) => ({
  userIdIdx: index("idx_listings_user_id").on(table.userId),
}));

export const pageViews = sqliteTable("page_views", {
  id: text("id").primaryKey(),
  listingId: text("listing_id").notNull(),
  userId: text("user_id").notNull(),
  visitorIp: text("visitor_ip"),
  visitorUserAgent: text("visitor_user_agent"),
  referrer: text("referrer"),
  device: text("device"),
  createdAt: integer("created_at").notNull().default(0),
}, (table) => ({
  listingIdx: index("idx_page_views_listing_id").on(table.listingId),
  userIdx: index("idx_page_views_user_id").on(table.userId),
}));

export const variantSelections = sqliteTable("variant_selections", {
  id: text("id").primaryKey(),
  listingId: text("listing_id").notNull(),
  userId: text("user_id").notNull(),
  variantIndex: integer("variant_index").notNull(),
  style: text("style").notNull(),
  selectedAt: integer("selected_at").notNull().default(0),
}, (table) => ({
  listingIdx: index("idx_variant_selections_listing_id").on(table.listingId),
  userIdx: index("idx_variant_selections_user_id").on(table.userId),
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

export const agentCredits = sqliteTable("agent_credits", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  credits: integer("credits").default(0),
  plan: text("plan").default("free"),
  createdAt: integer("created_at").default(0),
  expiresAt: integer("expires_at"),
}, (table) => ({
  userIdx: index("idx_agent_credits_user_id").on(table.userId),
}));

export const agentConversations = sqliteTable("agent_conversations", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  listingId: text("listing_id").notNull(),
  messages: text("messages", { mode: "json" }).notNull(),
  createdAt: integer("created_at").default(0),
  updatedAt: integer("updated_at").default(0),
}, (table) => ({
  userIdx: index("idx_agent_conversations_user_id").on(table.userId),
}));

export const agentAnalytics = sqliteTable("agent_analytics", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  listingId: text("listing_id"),
  command: text("command"),
  prompt: text("prompt"),
  response: text("response"),
  accepted: integer("accepted").default(0),
  latency: integer("latency"),
  createdAt: integer("created_at").default(0),
}, (table) => ({
  userIdx: index("idx_agent_analytics_user_id").on(table.userId),
  createdAtIdx: index("idx_agent_analytics_created_at").on(table.createdAt),
}));

export const gamification = sqliteTable("gamification", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  points: integer("points").default(0),
  level: integer("level").default(1),
  badges: text("badges").default("[]"),
  streak: integer("streak").default(0),
  lastActivity: integer("last_activity"),
  updatedAt: integer("updated_at").default(0),
}, (table) => ({
  userIdx: index("idx_gamification_user_id").on(table.userId),
  pointsIdx: index("idx_gamification_points").on(table.points),
}));

export const gamificationHistory = sqliteTable("gamification_history", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  action: text("action").notNull(),
  points: integer("points").notNull(),
  createdAt: integer("created_at").default(0),
}, (table) => ({
  userIdx: index("idx_gamification_history_user_id").on(table.userId),
  createdAtIdx: index("idx_gamification_history_created_at").on(table.createdAt),
}));

export const gamificationDiscounts = sqliteTable("gamification_discounts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  type: text("type").notNull(),
  code: text("code").notNull(),
  used: integer("used").default(0),
  expiresAt: integer("expires_at"),
  createdAt: integer("created_at").default(0),
}, (table) => ({
  userIdx: index("idx_gamification_discounts_user_id").on(table.userId),
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