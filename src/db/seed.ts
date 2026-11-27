import bcrypt from 'bcryptjs';
import { sql } from 'drizzle-orm';
import { env } from '../config/env';
import { uuidV5 } from '../lib/uuid';
import { closeDatabase, db, type Executor } from './client';
import { garmentOccasions, garments, occasions, stores, users } from './schema';
import { seedGarments, seedOccasions, seedStores, sizesFor } from './seed-data';

export const seedIds = {
  store: (name: string) => uuidV5(`store:${name}`),
  occasion: (code: string) => uuidV5(`occasion:${code}`),
  garment: (name: string) => uuidV5(`garment:${name}`),
  user: (email: string) => uuidV5(`user:${email}`),
};

/**
 * Resets every table and loads the fictional catalog. Identifiers are deterministic,
 * so links in Postman collections or docs keep working after a reset.
 */
export async function seedDatabase(executor: Executor = db): Promise<void> {
  await executor.execute(
    sql`truncate table outfit_items, outfits, garment_occasions, garments, occasions, stores, users restart identity cascade`,
  );

  const [adminHash, demoHash] = await Promise.all([
    bcrypt.hash(env.SEED_ADMIN_PASSWORD, env.BCRYPT_ROUNDS),
    bcrypt.hash(env.SEED_DEMO_PASSWORD, env.BCRYPT_ROUNDS),
  ]);
  await executor.insert(users).values([
    {
      id: seedIds.user(env.SEED_ADMIN_EMAIL),
      name: 'Administración EasyLook',
      email: env.SEED_ADMIN_EMAIL.toLowerCase(),
      passwordHash: adminHash,
      role: 'admin',
    },
    {
      id: seedIds.user(env.SEED_DEMO_EMAIL),
      name: 'Cuenta demo',
      email: env.SEED_DEMO_EMAIL.toLowerCase(),
      passwordHash: demoHash,
      role: 'user',
    },
  ]);

  await executor.insert(stores).values(seedStores.map((store) => ({ id: seedIds.store(store.name), ...store })));
  await executor
    .insert(occasions)
    .values(seedOccasions.map((occasion) => ({ id: seedIds.occasion(occasion.code), ...occasion })));

  await executor.insert(garments).values(
    seedGarments.map((garment) => ({
      id: garment.id ?? seedIds.garment(garment.name),
      storeId: seedIds.store(garment.store),
      name: garment.name,
      description: garment.description ?? '',
      category: garment.category,
      priceCop: garment.priceCop,
      style: garment.style,
      color: garment.color,
      sizes: sizesFor(garment.category),
      active: garment.active ?? true,
    })),
  );

  await executor.insert(garmentOccasions).values(
    seedGarments.flatMap((garment) =>
      garment.occasions.map((code) => ({
        garmentId: garment.id ?? seedIds.garment(garment.name),
        occasionId: seedIds.occasion(code),
      })),
    ),
  );
}

if (require.main === module) {
  if (env.NODE_ENV === 'production') {
    console.error('Refusing to reset data with NODE_ENV=production');
    process.exit(1);
  }
  db.transaction((tx) => seedDatabase(tx))
    .then(() =>
      console.log(
        `Seed loaded: ${seedStores.length} stores, ${seedOccasions.length} occasions, ${seedGarments.length} garments`,
      ),
    )
    .catch((error: unknown) => {
      console.error('Seed failed', error);
      process.exitCode = 1;
    })
    .finally(() => closeDatabase());
}
