import { API, api, teardown } from '../helpers/app';

afterAll(teardown);

describe('HTTP conventions', () => {
  it('serves a health check', async () => {
    await api().get('/health').expect(200, { status: 'ok' });
  });

  it('returns JSON errors for unknown routes', async () => {
    const res = await api().get(`${API}/nada`).expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns INVALID_JSON for a malformed body', async () => {
    const res = await api()
      .post(`${API}/auth/login`)
      .set('Content-Type', 'application/json')
      .send('{"email": ')
      .expect(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('publishes an OpenAPI 3.1 document covering every endpoint in the spec', async () => {
    const res = await api().get('/openapi.json').expect(200);
    expect(res.body.openapi).toBe('3.1.0');
    const paths = Object.keys(res.body.paths);
    expect(paths).toEqual(
      expect.arrayContaining([
        '/auth/register',
        '/auth/login',
        '/auth/me',
        '/stores',
        '/stores/{storeId}',
        '/occasions',
        '/garments',
        '/garments/{garmentId}',
        '/outfits',
        '/outfits/{outfitId}',
        '/outfits/{outfitId}/items',
        '/outfits/{outfitId}/items/{garmentId}',
        '/outfits/{outfitId}/finalize',
        '/outfits/{outfitId}/apply-recommendation',
        '/recommendations/look-match',
      ]),
    );
    expect(res.body.components.securitySchemes.bearerAuth).toMatchObject({ type: 'http', scheme: 'bearer' });
  });

  it('serves Swagger UI', async () => {
    const res = await api().get('/docs/').expect(200);
    expect(res.text).toContain('swagger-ui');
  });

  it('sets security headers and hides the framework', async () => {
    const res = await api().get(`${API}/occasions`);
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
