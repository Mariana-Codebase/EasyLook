import { ADMIN, API, BLAZER_CREMA_ID, api, bearer, garmentId, login, registerUser, resetDatabase, teardown } from '../helpers/app';

let token: string;
let otherToken: string;
const ids: Record<string, string> = {};

beforeAll(async () => {
  await resetDatabase();
  token = (await registerUser('Dueña')).token;
  otherToken = (await registerUser('Otra persona')).token;
  for (const name of ['Blusa clásica', 'Falda midi', 'Baletas', 'Vestido floral', 'Sandalias de tiras', 'Gabardina']) {
    ids[name] = await garmentId(name);
  }
});
afterAll(teardown);

async function createOutfit(body: Record<string, unknown> = {}) {
  const res = await api()
    .post(`${API}/outfits`)
    .set(bearer(token))
    .send({ name: 'Brunch de domingo', occasionCode: 'brunch', budgetCop: 350000, currency: 'COP', ...body })
    .expect(201);
  return res.body;
}

describe('outfits', () => {
  it('creates an empty outfit with the README shape', async () => {
    const outfit = await createOutfit();
    expect(outfit).toMatchObject({
      name: 'Brunch de domingo',
      occasion: { code: 'brunch', name: 'Brunch' },
      budgetCop: 350000,
      currency: 'COP',
      totalCop: 0,
      remainingCop: 350000,
      budgetStatus: 'within_budget',
      status: 'draft',
      items: [],
    });
  });

  it('requires authentication', async () => {
    await api().post(`${API}/outfits`).send({ name: 'x', occasionCode: 'brunch' }).expect(401);
    await api().get(`${API}/outfits`).expect(401);
  });

  it('rejects unknown occasions and decimal budgets', async () => {
    await api().post(`${API}/outfits`).set(bearer(token)).send({ name: 'x x', occasionCode: 'boda' }).expect(400);
    await api()
      .post(`${API}/outfits`)
      .set(bearer(token))
      .send({ name: 'x x', occasionCode: 'brunch', budgetCop: 1000.5 })
      .expect(400);
  });

  it('adds a garment and recalculates total and remaining budget', async () => {
    const outfit = await createOutfit();
    const res = await api()
      .post(`${API}/outfits/${outfit.id}/items`)
      .set(bearer(token))
      .send({ garmentId: BLAZER_CREMA_ID })
      .expect(200);
    expect(res.body).toMatchObject({
      outfitId: outfit.id,
      totalCop: 149900,
      remainingCop: 200100,
      budgetStatus: 'within_budget',
      items: [{ id: BLAZER_CREMA_ID, name: 'Blazer crema', category: 'outerwear', priceCop: 149900, store: { name: 'Atelier Norte' } }],
    });
  });

  it('rejects the same garment twice with 409 GARMENT_ALREADY_ADDED', async () => {
    const outfit = await createOutfit();
    const add = () => api().post(`${API}/outfits/${outfit.id}/items`).set(bearer(token)).send({ garmentId: BLAZER_CREMA_ID });
    await add().expect(200);
    const res = await add().expect(409);
    expect(res.body.error.code).toBe('GARMENT_ALREADY_ADDED');
  });

  it('keeps duplicates out even under concurrent requests', async () => {
    const outfit = await createOutfit();
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        api().post(`${API}/outfits/${outfit.id}/items`).set(bearer(token)).send({ garmentId: ids['Baletas'] }),
      ),
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(4);
  });

  it('mixes stores and flags over budget', async () => {
    const outfit = await createOutfit({ budgetCop: 300000 });
    for (const name of ['Blusa clásica', 'Falda midi', 'Baletas']) {
      await api().post(`${API}/outfits/${outfit.id}/items`).set(bearer(token)).send({ garmentId: ids[name] }).expect(200);
    }
    const res = await api().get(`${API}/outfits/${outfit.id}`).set(bearer(token)).expect(200);
    expect(res.body).toMatchObject({
      totalCop: 89900 + 109900 + 99900,
      remainingCop: 300000 - 299700,
      budgetStatus: 'within_budget',
      isComplete: true,
      storeCount: 2,
      itemCount: 3,
    });

    const over = await api()
      .post(`${API}/outfits/${outfit.id}/items`)
      .set(bearer(token))
      .send({ garmentId: ids['Gabardina'] })
      .expect(200);
    expect(over.body.budgetStatus).toBe('over_budget');
    expect(over.body.remainingCop).toBeLessThan(0);
  });

  it('enforces ownership with 403 FORBIDDEN_RESOURCE', async () => {
    const outfit = await createOutfit();
    const attempts = [
      api().get(`${API}/outfits/${outfit.id}`),
      api().patch(`${API}/outfits/${outfit.id}`).send({ name: 'Mío ahora' }),
      api().delete(`${API}/outfits/${outfit.id}`),
      api().post(`${API}/outfits/${outfit.id}/items`).send({ garmentId: BLAZER_CREMA_ID }),
      api().post(`${API}/outfits/${outfit.id}/finalize`),
    ];
    for (const attempt of attempts) {
      const res = await attempt.set(bearer(otherToken));
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_RESOURCE');
    }
    const otherList = await api().get(`${API}/outfits`).set(bearer(otherToken)).expect(200);
    expect(otherList.body.data).toHaveLength(0);
  });

  it('blocks admins from other people outfits too', async () => {
    const outfit = await createOutfit();
    await api().get(`${API}/outfits/${outfit.id}`).set(bearer(await login(ADMIN))).expect(403);
  });

  it('refuses to finalize an incomplete outfit', async () => {
    const outfit = await createOutfit();
    await api().post(`${API}/outfits/${outfit.id}/items`).set(bearer(token)).send({ garmentId: ids['Vestido floral'] });
    const res = await api().post(`${API}/outfits/${outfit.id}/finalize`).set(bearer(token)).expect(400);
    expect(res.body.error).toMatchObject({ code: 'OUTFIT_INCOMPLETE', details: { missingCategories: ['shoes'] } });
  });

  it('refuses to finalize over budget unless allowed', async () => {
    const outfit = await createOutfit({ budgetCop: 200000 });
    for (const name of ['Vestido floral', 'Sandalias de tiras']) {
      await api().post(`${API}/outfits/${outfit.id}/items`).set(bearer(token)).send({ garmentId: ids[name] });
    }
    const res = await api().post(`${API}/outfits/${outfit.id}/finalize`).set(bearer(token)).expect(400);
    expect(res.body.error).toEqual({
      code: 'BUDGET_EXCEEDED',
      message: 'El outfit supera el presupuesto definido.',
      details: { budgetCop: 200000, totalCop: 249800 },
    });

    const saved = await api()
      .post(`${API}/outfits/${outfit.id}/finalize`)
      .set(bearer(token))
      .send({ allowOverBudget: true })
      .expect(200);
    expect(saved.body.status).toBe('saved');
    expect(saved.body.savedAt).not.toBeNull();
  });

  it('saves into the look book and returns to draft when edited', async () => {
    const outfit = await createOutfit({ name: 'Look de brunch' });
    for (const name of ['Vestido floral', 'Sandalias de tiras']) {
      await api().post(`${API}/outfits/${outfit.id}/items`).set(bearer(token)).send({ garmentId: ids[name] });
    }
    await api().post(`${API}/outfits/${outfit.id}/finalize`).set(bearer(token)).expect(200);

    const lookBook = await api().get(`${API}/outfits`).set(bearer(token)).query({ status: 'saved' }).expect(200);
    const entry = lookBook.body.data.find((o: { id: string }) => o.id === outfit.id);
    expect(entry).toMatchObject({ status: 'saved', totalCop: 249800, itemCount: 2, remainingCop: 100200 });

    const renamed = await api().patch(`${API}/outfits/${outfit.id}`).set(bearer(token)).send({ name: 'Brunch con amigas' });
    expect(renamed.body.status).toBe('saved');

    const removed = await api()
      .delete(`${API}/outfits/${outfit.id}/items/${ids['Sandalias de tiras']}`)
      .set(bearer(token))
      .expect(200);
    expect(removed.body).toMatchObject({ totalCop: 159900, isComplete: false, missingCategories: ['shoes'] });
    const detail = await api().get(`${API}/outfits/${outfit.id}`).set(bearer(token));
    expect(detail.body.status).toBe('draft');

    const notThere = await api()
      .delete(`${API}/outfits/${outfit.id}/items/${ids['Sandalias de tiras']}`)
      .set(bearer(token))
      .expect(404);
    expect(notThere.body.error.code).toBe('GARMENT_NOT_IN_OUTFIT');
  });

  it('removes the budget with null and reports not_set', async () => {
    const outfit = await createOutfit();
    const res = await api().patch(`${API}/outfits/${outfit.id}`).set(bearer(token)).send({ budgetCop: null }).expect(200);
    expect(res.body).toMatchObject({ budgetCop: null, remainingCop: null, budgetStatus: 'not_set' });
  });

  it('deletes an outfit', async () => {
    const outfit = await createOutfit();
    await api().delete(`${API}/outfits/${outfit.id}`).set(bearer(token)).expect(204);
    await api().get(`${API}/outfits/${outfit.id}`).set(bearer(token)).expect(404);
  });

  it('rejects discontinued garments', async () => {
    const outfit = await createOutfit();
    const admin = await login(ADMIN);
    const discontinued = (
      await api().get(`${API}/garments`).set(bearer(admin)).query({ q: 'Chaleco de punto', includeInactive: 'true' })
    ).body.data[0];
    const res = await api()
      .post(`${API}/outfits/${outfit.id}/items`)
      .set(bearer(token))
      .send({ garmentId: discontinued.id })
      .expect(400);
    expect(res.body.error.code).toBe('GARMENT_INACTIVE');
  });

  it('validates ids in the path', async () => {
    const res = await api().get(`${API}/outfits/not-a-uuid`).set(bearer(token)).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
