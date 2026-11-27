import { ADMIN, API, BLAZER_CREMA_ID, api, bearer, login, registerUser, resetDatabase, teardown } from '../helpers/app';

let adminToken: string;
let userToken: string;

beforeAll(async () => {
  await resetDatabase();
  adminToken = await login(ADMIN);
  userToken = (await registerUser()).token;
});
afterAll(teardown);

describe('stores and occasions', () => {
  it('lists stores publicly with pagination metadata', async () => {
    const res = await api().get(`${API}/stores`).query({ limit: 3 }).expect(200);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.meta).toEqual({ page: 1, limit: 3, total: 7, totalPages: 3 });
    expect(res.body.data[0]).toHaveProperty('garmentCount');
  });

  it('counts the active garments of each store', async () => {
    const res = await api().get(`${API}/stores`).query({ q: 'Atelier Norte' }).expect(200);
    const atelier = res.body.data[0];
    const garments = await api().get(`${API}/garments`).query({ storeId: atelier.id, limit: 100 }).expect(200);
    expect(atelier.garmentCount).toBe(garments.body.meta.total);
    expect(atelier.garmentCount).toBeGreaterThan(0);
  });

  it('filters stores by style', async () => {
    const res = await api().get(`${API}/stores`).query({ style: 'boho' }).expect(200);
    expect(res.body.data.map((s: { name: string }) => s.name)).toEqual(['Lino & Sal']);
  });

  it('caps the page limit at 100', async () => {
    const res = await api().get(`${API}/stores`).query({ limit: 101 }).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('lists the five initial occasions', async () => {
    const res = await api().get(`${API}/occasions`).expect(200);
    expect(res.body.data.map((o: { code: string }) => o.code).sort()).toEqual([
      'brunch',
      'casual',
      'date',
      'office',
      'party',
    ]);
  });

  it('only lets admins create and edit stores', async () => {
    const body = { name: 'Tienda Nueva', style: 'minimal', description: 'De prueba' };
    await api().post(`${API}/stores`).send(body).expect(401);
    const forbidden = await api().post(`${API}/stores`).set(bearer(userToken)).send(body).expect(403);
    expect(forbidden.body.error.code).toBe('FORBIDDEN');

    const created = await api().post(`${API}/stores`).set(bearer(adminToken)).send(body).expect(201);
    expect(created.body).toMatchObject({ name: 'Tienda Nueva', active: true, garmentCount: 0 });

    await api().post(`${API}/stores`).set(bearer(adminToken)).send(body).expect(409);

    const updated = await api()
      .patch(`${API}/stores/${created.body.id}`)
      .set(bearer(adminToken))
      .send({ active: false })
      .expect(200);
    expect(updated.body.active).toBe(false);

    // Deactivated stores disappear for visitors but stay visible to admins.
    await api().get(`${API}/stores/${created.body.id}`).expect(404);
    await api().get(`${API}/stores/${created.body.id}`).set(bearer(adminToken)).expect(200);
  });

  it('lets admins add an occasion', async () => {
    const res = await api()
      .post(`${API}/occasions`)
      .set(bearer(adminToken))
      .send({ code: 'graduation', name: 'Grado', recommendedStyles: ['elegant', 'classic'] })
      .expect(201);
    expect(res.body).toMatchObject({ code: 'graduation', active: true });
    await api().post(`${API}/occasions`).set(bearer(adminToken)).send({ code: 'graduation', name: 'Otra' }).expect(409);
  });
});

describe('garments', () => {
  it('filters by category, occasion and price, sorted by price', async () => {
    const res = await api()
      .get(`${API}/garments`)
      .query({ category: 'shoes', occasion: 'date', maxPriceCop: 180000, sort: 'price_asc' })
      .expect(200);
    const prices = res.body.data.map((g: { priceCop: number }) => g.priceCop);
    expect(prices.length).toBeGreaterThan(1);
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
    for (const garment of res.body.data) {
      expect(garment.category).toBe('shoes');
      expect(garment.occasions).toContain('date');
      expect(garment.priceCop).toBeLessThanOrEqual(180000);
    }
  });

  it('filters by store, color, size and text search', async () => {
    const store = (await api().get(`${API}/stores`).query({ q: 'Atelier' })).body.data[0];
    const byStore = await api().get(`${API}/garments`).query({ storeId: store.id, limit: 100 }).expect(200);
    expect(byStore.body.data.every((g: { store: { id: string } }) => g.store.id === store.id)).toBe(true);

    const byColor = await api().get(`${API}/garments`).query({ color: 'crema' }).expect(200);
    expect(byColor.body.data.map((g: { id: string }) => g.id)).toEqual([BLAZER_CREMA_ID]);

    const bySize = await api().get(`${API}/garments`).query({ size: '38', limit: 100 }).expect(200);
    expect(bySize.body.data.every((g: { category: string }) => g.category === 'shoes')).toBe(true);

    const search = await api().get(`${API}/garments`).query({ q: 'blazer' }).expect(200);
    expect(search.body.data.map((g: { name: string }) => g.name)).toEqual(['Blazer crema', 'Blazer de terciopelo']);
  });

  it('rejects an inverted price range', async () => {
    await api().get(`${API}/garments`).query({ minPriceCop: 200000, maxPriceCop: 100000 }).expect(400);
  });

  it('returns the README example garment by id', async () => {
    const res = await api().get(`${API}/garments/${BLAZER_CREMA_ID}`).expect(200);
    expect(res.body).toMatchObject({
      name: 'Blazer crema',
      category: 'outerwear',
      priceCop: 149900,
      currency: 'COP',
      store: { name: 'Atelier Norte' },
    });
  });

  it('hides discontinued garments from visitors', async () => {
    const list = await api().get(`${API}/garments`).query({ q: 'Chaleco de punto' }).expect(200);
    expect(list.body.data).toHaveLength(0);
    const adminList = await api()
      .get(`${API}/garments`)
      .set(bearer(adminToken))
      .query({ q: 'Chaleco de punto', includeInactive: 'true' })
      .expect(200);
    expect(adminList.body.data[0].active).toBe(false);
  });

  it('lets admins create, edit and deactivate garments', async () => {
    const store = (await api().get(`${API}/stores`).query({ style: 'minimal' })).body.data[0];
    const created = await api()
      .post(`${API}/garments`)
      .set(bearer(adminToken))
      .send({
        storeId: store.id,
        name: 'Camisa oxford',
        category: 'top',
        priceCop: 99900,
        style: 'classic',
        color: 'Azul',
        sizes: ['s', 'm', 'm'],
        occasionCodes: ['office', 'casual'],
      })
      .expect(201);
    expect(created.body).toMatchObject({ color: 'azul', sizes: ['S', 'M'], occasions: ['casual', 'office'] });

    const decimal = await api()
      .post(`${API}/garments`)
      .set(bearer(adminToken))
      .send({ ...created.body, storeId: store.id, priceCop: 99900.5, occasionCodes: ['office'] });
    expect(decimal.status).toBe(400);

    const badOccasion = await api()
      .patch(`${API}/garments/${created.body.id}`)
      .set(bearer(adminToken))
      .send({ occasionCodes: ['no-existe'] })
      .expect(400);
    expect(badOccasion.body.error.details.missing).toEqual(['no-existe']);

    const updated = await api()
      .patch(`${API}/garments/${created.body.id}`)
      .set(bearer(adminToken))
      .send({ priceCop: 89900, occasionCodes: ['office'] })
      .expect(200);
    expect(updated.body).toMatchObject({ priceCop: 89900, occasions: ['office'] });

    await api().delete(`${API}/garments/${created.body.id}`).set(bearer(userToken)).expect(403);
    await api().delete(`${API}/garments/${created.body.id}`).set(bearer(adminToken)).expect(204);
    await api().get(`${API}/garments/${created.body.id}`).expect(404);
  });

  it('rejects garments for an inactive store', async () => {
    const store = (
      await api().post(`${API}/stores`).set(bearer(adminToken)).send({ name: 'Cerrada', style: 'casual', active: false })
    ).body;
    const res = await api()
      .post(`${API}/garments`)
      .set(bearer(adminToken))
      .send({
        storeId: store.id,
        name: 'Algo',
        category: 'top',
        priceCop: 10000,
        style: 'casual',
        color: 'rojo',
        occasionCodes: ['casual'],
      })
      .expect(400);
    expect(res.body.error.code).toBe('STORE_INACTIVE');
  });
});
