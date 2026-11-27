import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['user', 'admin']);
export const garmentCategoryEnum = pgEnum('garment_category', [
  'top',
  'bottom',
  'dress',
  'shoes',
  'outerwear',
  'accessory',
]);
export const outfitStatusEnum = pgEnum('outfit_status', ['draft', 'saved']);

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

const emptyTextArray = sql`'{}'::text[]`;

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull().default('user'),
  preferredStyles: text('preferred_styles').array().notNull().default(emptyTextArray),
  preferredSizes: text('preferred_sizes').array().notNull().default(emptyTextArray),
  ...timestamps,
});

export const stores = pgTable(
  'stores',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull().unique(),
    description: text('description').notNull().default(''),
    style: text('style').notNull(),
    active: boolean('active').notNull().default(true),
    ...timestamps,
  },
  (table) => [index('stores_style_idx').on(table.style)],
);

export const occasions = pgTable('occasions', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  recommendedStyles: text('recommended_styles').array().notNull().default(emptyTextArray),
  active: boolean('active').notNull().default(true),
  ...timestamps,
});

export const garments = pgTable(
  'garments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    category: garmentCategoryEnum('category').notNull(),
    priceCop: integer('price_cop').notNull(),
    style: text('style').notNull(),
    color: text('color').notNull(),
    sizes: text('sizes').array().notNull().default(emptyTextArray),
    active: boolean('active').notNull().default(true),
    ...timestamps,
  },
  (table) => [
    check('garments_price_cop_positive', sql`${table.priceCop} > 0`),
    index('garments_store_idx').on(table.storeId),
    index('garments_category_idx').on(table.category),
    index('garments_price_idx').on(table.priceCop),
    index('garments_style_idx').on(table.style),
  ],
);

export const garmentOccasions = pgTable(
  'garment_occasions',
  {
    garmentId: uuid('garment_id')
      .notNull()
      .references(() => garments.id, { onDelete: 'cascade' }),
    occasionId: uuid('occasion_id')
      .notNull()
      .references(() => occasions.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.garmentId, table.occasionId] }),
    index('garment_occasions_occasion_idx').on(table.occasionId),
  ],
);

export const outfits = pgTable(
  'outfits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    occasionId: uuid('occasion_id')
      .notNull()
      .references(() => occasions.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    budgetCop: integer('budget_cop'),
    status: outfitStatusEnum('status').notNull().default('draft'),
    savedAt: timestamp('saved_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    check('outfits_budget_cop_non_negative', sql`${table.budgetCop} IS NULL OR ${table.budgetCop} >= 0`),
    index('outfits_user_idx').on(table.userId),
  ],
);

export const outfitItems = pgTable(
  'outfit_items',
  {
    outfitId: uuid('outfit_id')
      .notNull()
      .references(() => outfits.id, { onDelete: 'cascade' }),
    garmentId: uuid('garment_id')
      .notNull()
      .references(() => garments.id, { onDelete: 'restrict' }),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.outfitId, table.garmentId] })],
);

export const storesRelations = relations(stores, ({ many }) => ({ garments: many(garments) }));

export const garmentsRelations = relations(garments, ({ one, many }) => ({
  store: one(stores, { fields: [garments.storeId], references: [stores.id] }),
  occasions: many(garmentOccasions),
}));

export const garmentOccasionsRelations = relations(garmentOccasions, ({ one }) => ({
  garment: one(garments, { fields: [garmentOccasions.garmentId], references: [garments.id] }),
  occasion: one(occasions, { fields: [garmentOccasions.occasionId], references: [occasions.id] }),
}));

export const outfitsRelations = relations(outfits, ({ one, many }) => ({
  user: one(users, { fields: [outfits.userId], references: [users.id] }),
  occasion: one(occasions, { fields: [outfits.occasionId], references: [occasions.id] }),
  items: many(outfitItems),
}));

export const outfitItemsRelations = relations(outfitItems, ({ one }) => ({
  outfit: one(outfits, { fields: [outfitItems.outfitId], references: [outfits.id] }),
  garment: one(garments, { fields: [outfitItems.garmentId], references: [garments.id] }),
}));

export type UserRow = typeof users.$inferSelect;
export type StoreRow = typeof stores.$inferSelect;
export type OccasionRow = typeof occasions.$inferSelect;
export type GarmentRow = typeof garments.$inferSelect;
export type OutfitRow = typeof outfits.$inferSelect;
export type GarmentCategory = (typeof garmentCategoryEnum.enumValues)[number];
export type UserRole = (typeof userRoleEnum.enumValues)[number];
export const GARMENT_CATEGORIES = garmentCategoryEnum.enumValues;
