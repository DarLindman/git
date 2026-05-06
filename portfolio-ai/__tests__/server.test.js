const request = require('supertest')

// Mock external-service modules before requiring server
jest.mock('web-push', () => ({ setVapidDetails: jest.fn(), sendNotification: jest.fn() }))
jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({ messages: { create: jest.fn() } }))
})

// Mock pg Pool before requiring server
jest.mock('pg', () => {
  const users = new Map()
  let idCounter = 1
  const query = jest.fn(async (sql, params) => {
    // initDB — ignore schema queries
    if (sql.includes('CREATE TABLE') || sql.includes('CREATE INDEX')) return { rows: [] }
    // register: INSERT INTO users
    if (sql.includes('INSERT INTO users')) {
      const [username, hash] = params
      if (users.has(username)) throw Object.assign(new Error('duplicate'), { code: '23505' })
      const id = idCounter++
      users.set(username, { id, username, password_hash: hash })
      return { rows: [{ id, username }] }
    }
    // register: INSERT INTO portfolios
    if (sql.includes('INSERT INTO portfolios')) return { rows: [] }
    // register: INSERT INTO user_profiles
    if (sql.includes('INSERT INTO user_profiles') && !sql.includes('ON CONFLICT')) return { rows: [] }
    // login: SELECT from users
    if (sql.includes('SELECT') && sql.includes('FROM users') && sql.includes('WHERE username')) {
      const username = params[0]
      const user = users.get(username)
      return { rows: user ? [user] : [] }
    }
    // change-password: SELECT password_hash
    if (sql.includes('SELECT password_hash FROM users')) {
      const userId = params[0]
      for (const u of users.values()) {
        if (u.id === userId) return { rows: [{ password_hash: u.password_hash }] }
      }
      return { rows: [] }
    }
    // change-password: UPDATE users
    if (sql.includes('UPDATE users SET password_hash')) return { rows: [] }
    return { rows: [], rowCount: 0 }
  })
  return { Pool: jest.fn(() => ({ query })) }
})

const app = require('../server')

describe('Auth', () => {
  const user = { username: `testuser_${Date.now()}`, password: 'TestPass123!' }

  test('POST /auth/register creates user and returns token', async () => {
    const res = await request(app).post('/auth/register').send(user)
    expect(res.status).toBe(201)
    expect(res.body.token).toBeDefined()
    expect(res.body.username).toBe(user.username)
  })

  test('POST /auth/register rejects duplicate username', async () => {
    await request(app).post('/auth/register').send(user)
    const res = await request(app).post('/auth/register').send(user)
    expect(res.status).toBe(409)
  })

  test('POST /auth/register rejects short password', async () => {
    const res = await request(app).post('/auth/register').send({ username: 'validuser', password: '123' })
    expect(res.status).toBe(400)
  })

  test('POST /auth/login returns token for valid credentials', async () => {
    const u = { username: `login_${Date.now()}`, password: 'TestPass123!' }
    await request(app).post('/auth/register').send(u)
    const res = await request(app).post('/auth/login').send(u)
    expect(res.status).toBe(200)
    expect(res.body.token).toBeDefined()
  })

  test('POST /auth/login rejects wrong password', async () => {
    const u = { username: `wrongpass_${Date.now()}`, password: 'TestPass123!' }
    await request(app).post('/auth/register').send(u)
    const res = await request(app).post('/auth/login').send({ ...u, password: 'wrongpassword' })
    expect(res.status).toBe(401)
  })

  test('Protected route rejects missing token', async () => {
    const res = await request(app).get('/api/portfolio')
    expect(res.status).toBe(401)
  })
})
