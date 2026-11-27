import { API, api, bearer, registerUser, resetDatabase, teardown } from '../helpers/app';

beforeAll(resetDatabase);
afterAll(teardown);

const readmeRequest = {
  occasionCode: 'date',
  budgetCop: 400000,
  preferredStyles: ['elegant', 'minimal'],
  excludedCategories: ['outerwear'],
  allowOverBudget: false,
};

describe('Look Match', () => {
  it('answers the README example for visitors', async () => {
    const res = await api().post(`${API}/recommendations/look-match`).send(readmeRequest).expect(200);
    expect(res.body).toMatchObject({ occasion: 'date', budgetCop: 400000, currency: 'COP', withinBudgetFound: true });

    const recs = res.body.recommendations as {
      label: string;
      score: number;
      totalCop: number;
      remainingCop: number;
      items: { id: string; category: string; store: { id: string } }[];
      garmentIds: string[];
      storeCount: number;
      explanation: string[];
    }[];
    expect(recs.length).toBeGreaterThanOrEqual(2);
    expect(recs.length).toBeLessThanOrEqual(3);
    expect(recs.map((r) => r.label)).toEqual(expect.arrayContaining(['balanced', 'budget']));

    for (const rec of recs) {
      expect(rec.totalCop).toBeLessThanOrEqual(400000);
      expect(rec.remainingCop).toBe(400000 - rec.totalCop);
      expect(rec.items.some((item) => item.category === 'outerwear')).toBe(false);
      expect(rec.garmentIds).toEqual(rec.items.map((item) => item.id));
      expect(rec.storeCount).toBe(new Set(rec.items.map((item) => item.store.id)).size);
      expect(rec.score).toBeGreaterThanOrEqual(0);
      expect(rec.score).toBeLessThanOrEqual(100);
      expect(rec.explanation[0]).toMatch(/look completo/);
    }
  });

  it('is reproducible', async () => {
    const first = await api().post(`${API}/recommendations/look-match`).send(readmeRequest);
    const second = await api().post(`${API}/recommendations/look-match`).send(readmeRequest);
    expect(second.body).toEqual(first.body);
  });

  it('returns 422 NO_MATCH_FOUND with the cheapest total when the budget is too low', async () => {
    const res = await api()
      .post(`${API}/recommendations/look-match`)
      .send({ occasionCode: 'office', budgetCop: 100000 })
      .expect(422);
    expect(res.body.error.code).toBe('NO_MATCH_FOUND');
    expect(res.body.error.details).toMatchObject({ reason: 'BUDGET_TOO_LOW', budgetCop: 100000 });
    expect(res.body.error.details.cheapestTotalCop).toBeGreaterThan(100000);
  });

  it('shows the closest look only when allowOverBudget=true', async () => {
    const res = await api()
      .post(`${API}/recommendations/look-match`)
      .send({ occasionCode: 'office', budgetCop: 100000, allowOverBudget: true })
      .expect(200);
    expect(res.body.withinBudgetFound).toBe(false);
    expect(res.body.notice).toMatch(/más cercana/);
    expect(res.body.recommendations).toHaveLength(1);
    expect(res.body.recommendations[0].budgetStatus).toBe('over_budget');
  });

  it('returns 422 when the exclusions make a complete look impossible', async () => {
    const res = await api()
      .post(`${API}/recommendations/look-match`)
      .send({ occasionCode: 'party', excludedCategories: ['shoes'] })
      .expect(422);
    expect(res.body.error.details).toEqual({ reason: 'MISSING_CATEGORIES', missingCategories: ['shoes'] });
  });

  it('rejects unknown occasions', async () => {
    await api().post(`${API}/recommendations/look-match`).send({ occasionCode: 'boda' }).expect(400);
  });

  it('uses the profile preferences of a signed-in user', async () => {
    const { token } = await registerUser();
    await api()
      .patch(`${API}/auth/me`)
      .set(bearer(token))
      .send({ preferredStyles: ['boho'], preferredSizes: ['37'] })
      .expect(200);
    const res = await api()
      .post(`${API}/recommendations/look-match`)
      .set(bearer(token))
      .send({ occasionCode: 'brunch', budgetCop: 350000 })
      .expect(200);
    expect(res.body.appliedPreferences).toEqual({ preferredStyles: ['boho'], sizes: ['37'], source: 'profile' });
    // Only shoes come in size 37; clothing is not filtered out by a shoe size.
    expect(res.body.recommendations.length).toBeGreaterThan(0);
  });

  it('filters by size and lets the request override the profile', async () => {
    const { token } = await registerUser();
    await api().patch(`${API}/auth/me`).set(bearer(token)).send({ preferredSizes: ['XS'] });
    const res = await api()
      .post(`${API}/recommendations/look-match`)
      .set(bearer(token))
      .send({ occasionCode: 'casual', sizes: ['M', '38'], preferredStyles: [] })
      .expect(200);
    expect(res.body.appliedPreferences).toMatchObject({ sizes: ['M', '38'], source: 'request' });
  });

  it('copies a proposal into an outfit with apply-recommendation', async () => {
    const { token } = await registerUser();
    const outfit = (
      await api()
        .post(`${API}/outfits`)
        .set(bearer(token))
        .send({ name: 'Cita del viernes', occasionCode: 'date', budgetCop: 400000 })
    ).body;
    const proposal = (await api().post(`${API}/recommendations/look-match`).send(readmeRequest)).body.recommendations[0];

    const applied = await api()
      .post(`${API}/outfits/${outfit.id}/apply-recommendation`)
      .set(bearer(token))
      .send({ garmentIds: proposal.garmentIds })
      .expect(200);
    expect(applied.body.items.map((item: { id: string }) => item.id).sort()).toEqual([...proposal.garmentIds].sort());
    expect(applied.body).toMatchObject({ totalCop: proposal.totalCop, isComplete: true, status: 'draft' });

    const saved = await api().post(`${API}/outfits/${outfit.id}/finalize`).set(bearer(token)).expect(200);
    expect(saved.body.status).toBe('saved');

    const duplicateIds = await api()
      .post(`${API}/outfits/${outfit.id}/apply-recommendation`)
      .set(bearer(token))
      .send({ garmentIds: [proposal.garmentIds[0], proposal.garmentIds[0]] })
      .expect(400);
    expect(duplicateIds.body.error.code).toBe('VALIDATION_ERROR');
  });
});
