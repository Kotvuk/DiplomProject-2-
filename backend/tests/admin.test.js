const { app, db, mockFetch, createTestUser } = require('./setup');
const request = require('supertest');

describe('Admin API', () => {
  let admin, normalUser;

  beforeAll(() => {
    admin = createTestUser({ email: `admin2_${Date.now()}@test.com`, is_admin: 1 });
    normalUser = createTestUser({ email: `normal_${Date.now()}@test.com` });
  });

  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({}), ok: true });
  });

  test('GET /api/admin/users - non-admin returns 403', async () => {
    const res = await request(app).get('/api/admin/users')
      .set('Authorization', `Bearer ${normalUser.token}`);
    expect(res.status).toBe(403);
  });

  test('GET /api/admin/users - admin succeeds', async () => {
    const res = await request(app).get('/api/admin/users')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('PATCH /api/admin/users/:id/plan - change to Pro', async () => {
    var res = await request(app).patch(`/api/admin/users/${normalUser.id}/plan`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ plan: 'Pro' });
    expect(res.status).toBe(200);
  });

  test('PATCH /api/admin/users/:id/plan - invalid plan', async () => {
    var res = await request(app).patch(`/api/admin/users/${normalUser.id}/plan`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ plan: 'SuperPlan' });
    expect(res.status).toBe(400);
  });

  test('PATCH /api/admin/users/:id/admin - grant admin', async () => {
    const u = createTestUser({ email: `grant_${Date.now()}@test.com` });
    const res = await request(app).patch(`/api/admin/users/${u.id}/admin`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ is_admin: 1 });
    expect(res.status).toBe(200);
  });

  test('PATCH /api/admin/users/:id/admin - invalid value', async () => {
    const res = await request(app).patch(`/api/admin/users/${normalUser.id}/admin`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ is_admin: 5 });
    expect(res.status).toBe(400);
  });

  test('PATCH /api/admin/users/:id/admin - cannot remove own admin', async () => {
    const res = await request(app).patch(`/api/admin/users/${admin.id}/admin`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ is_admin: 0 });
    expect(res.status).toBe(400);
  });

  test('DELETE /api/admin/users/:id - delete user', async () => {
    const u = createTestUser({ email: `delete_${Date.now()}@test.com` });
    const res = await request(app).delete(`/api/admin/users/${u.id}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
  });

  test('DELETE /api/admin/users/:id - cannot delete self', async () => {
    const res = await request(app).delete(`/api/admin/users/${admin.id}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(400);
  });

  test('GET /api/admin/stats', async () => {
    const res = await request(app).get('/api/admin/stats')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalUsers');
    expect(res.body).toHaveProperty('usersByPlan');
    expect(res.body).toHaveProperty('totalTrades');
    expect(res.body).toHaveProperty('totalSignals');
    expect(res.body).toHaveProperty('signalAccuracy');
  });

  test('GET /api/admin/signals', async () => {
    const res = await request(app).get('/api/admin/signals')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('signals');
    expect(res.body).toHaveProperty('pagination');
  });

  test('GET /api/admin/signals - pagination', async () => {
    const res = await request(app).get('/api/admin/signals?page=1&limit=5')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.limit).toBe(5);
  });

  test('PATCH /api/admin/plans/:plan', async () => {
    const res = await request(app).patch('/api/admin/plans/Pro')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: 'Pro', price: '$29/мес' });
    expect(res.status).toBe(200);
  });

  test('PATCH /api/admin/plans/:plan - invalid plan name', async () => {
    var res = await request(app).patch('/api/admin/plans/Invalid')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  test('POST /api/admin/setup - already has admin', async () => {
    const res = await request(app).post('/api/admin/setup').send({
      email: 'new@admin.com', password: 'pass123456'
    });
    expect(res.status).toBe(400);
  });
});
