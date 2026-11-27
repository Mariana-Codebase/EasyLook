import request from 'supertest';
import { createApp } from '../../src/app';
import { closeDatabase, db } from '../../src/db/client';
import { seedDatabase } from '../../src/db/seed';
import { BLAZER_CREMA_ID } from '../../src/db/seed-data';

export const app = createApp();
export const api = () => request(app);
export const API = '/api/v1';

export const ADMIN = { email: 'admin@easylook.dev', password: 'Admin12345!' };
export const DEMO = { email: 'demo@easylook.dev', password: 'Demo12345!' };
export { BLAZER_CREMA_ID };

export async function resetDatabase(): Promise<void> {
  await db.transaction((tx) => seedDatabase(tx));
}

export async function login(credentials: { email: string; password: string }): Promise<string> {
  const res = await api().post(`${API}/auth/login`).send(credentials).expect(200);
  return res.body.token as string;
}

let userCounter = 0;

export async function registerUser(name = 'Persona de prueba'): Promise<{ token: string; id: string; email: string }> {
  userCounter += 1;
  const email = `user${Date.now()}${userCounter}@test.dev`;
  const res = await api()
    .post(`${API}/auth/register`)
    .send({ name, email, password: 'ClaveSegura123' })
    .expect(201);
  return { token: res.body.token, id: res.body.user.id, email };
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Finds a seeded garment by its exact name. */
export async function garmentId(name: string): Promise<string> {
  const res = await api().get(`${API}/garments`).query({ q: name, limit: 100 }).expect(200);
  const match = (res.body.data as { id: string; name: string }[]).find((g) => g.name === name);
  if (!match) throw new Error(`Seed garment not found: ${name}`);
  return match.id;
}

export async function teardown(): Promise<void> {
  await closeDatabase();
}
