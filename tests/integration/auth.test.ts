import { API, DEMO, api, bearer, login, registerUser, resetDatabase, teardown } from '../helpers/app';

beforeAll(resetDatabase);
afterAll(teardown);

describe('auth', () => {
  it('registers a user and never returns the password hash', async () => {
    const res = await api()
      .post(`${API}/auth/register`)
      .send({ name: 'Laura Gómez', email: 'Laura@Correo.com ', password: 'MiClave2026!' })
      .expect(201);

    expect(res.body).toMatchObject({
      tokenType: 'Bearer',
      expiresIn: '1h',
      user: { name: 'Laura Gómez', email: 'laura@correo.com', role: 'user' },
    });
    expect(typeof res.body.token).toBe('string');
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  it('rejects a duplicate email with 409', async () => {
    const res = await api()
      .post(`${API}/auth/register`)
      .send({ name: 'Otra Laura', email: 'laura@correo.com', password: 'OtraClave2026!' })
      .expect(409);
    expect(res.body.error.code).toBe('EMAIL_ALREADY_REGISTERED');
  });

  it('cannot self-register as admin', async () => {
    const res = await api()
      .post(`${API}/auth/register`)
      .send({ name: 'Intento', email: 'intento@test.dev', password: 'ClaveSegura123', role: 'admin' })
      .expect(201);
    expect(res.body.user.role).toBe('user');
  });

  it('validates input with a uniform error body', async () => {
    const res = await api().post(`${API}/auth/register`).send({ name: 'A', email: 'no-es-correo', password: '123' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const paths = res.body.error.details.issues.map((issue: { path: string }) => issue.path);
    expect(paths).toEqual(expect.arrayContaining(['name', 'email', 'password']));
  });

  it('logs in and returns the current user', async () => {
    const token = await login(DEMO);
    const res = await api().get(`${API}/auth/me`).set(bearer(token)).expect(200);
    expect(res.body).toMatchObject({ email: DEMO.email, role: 'user' });
  });

  it('rejects wrong credentials without saying which part failed', async () => {
    const wrongPassword = await api().post(`${API}/auth/login`).send({ ...DEMO, password: 'incorrecta' });
    const unknownUser = await api().post(`${API}/auth/login`).send({ email: 'nadie@test.dev', password: 'x' });
    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownUser.body);
    expect(wrongPassword.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('requires a valid token for /auth/me', async () => {
    await api().get(`${API}/auth/me`).expect(401);
    const res = await api().get(`${API}/auth/me`).set(bearer('not-a-jwt')).expect(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    await api().get(`${API}/auth/me`).set({ Authorization: 'Basic abc' }).expect(401);
  });

  it('updates style and size preferences', async () => {
    const { token } = await registerUser();
    const res = await api()
      .patch(`${API}/auth/me`)
      .set(bearer(token))
      .send({ preferredStyles: ['Elegant', 'minimal', 'minimal'], preferredSizes: ['m'] })
      .expect(200);
    expect(res.body.preferredStyles).toEqual(['elegant', 'minimal']);
    expect(res.body.preferredSizes).toEqual(['M']);
  });
});
