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
  // Holdings store: map from portfolioId -> array of holding objects
  const holdingsStore = new Map()
  let holdingIdCounter = 100

  const query = jest.fn(async (sql, params) => {
    // initDB — ignore schema queries
    if (sql.includes('CREATE TABLE') || sql.includes('CREATE INDEX')) return { rows: [] }
    // register: INSERT INTO users
    if (sql.includes('INSERT INTO users')) {
      const [username, hash] = params
      if (users.has(username)) throw Object.assign(new Error('duplicate'), { code: '23505' })
      const id = idCounter++
      users.set(username, { id, username, password_hash: hash })
      // initialise an empty holdings list for portfolioId = id (same as user id for simplicity)
      holdingsStore.set(id, [])
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

    // portfolio: SELECT id FROM portfolios WHERE user_id
    if (sql.includes('SELECT id FROM portfolios WHERE user_id')) {
      const userId = params[0]
      // portfolioId == userId for test simplicity
      return { rows: [{ id: userId }] }
    }
    // holdings: SELECT from holdings WHERE portfolio_id
    if (sql.includes('FROM holdings WHERE portfolio_id') && sql.includes('SELECT')) {
      const portfolioId = params[0]
      const holdings = holdingsStore.get(portfolioId) || []
      return { rows: [...holdings].sort((a, b) => a.ticker.localeCompare(b.ticker)) }
    }
    // holdings: INSERT INTO holdings
    if (sql.includes('INSERT INTO holdings')) {
      const [portfolioId, ticker, exchange, quantity, avg_cost] = params
      const holdings = holdingsStore.get(portfolioId) || []
      const existing = holdings.findIndex(h => h.ticker === ticker)
      if (existing >= 0) {
        holdings[existing] = { ...holdings[existing], quantity, avg_cost }
      } else {
        holdings.push({ id: holdingIdCounter++, portfolio_id: portfolioId, ticker, exchange, quantity, avg_cost, analysis_json: null, analyzed_at: null })
      }
      holdingsStore.set(portfolioId, holdings)
      return { rows: [] }
    }
    // holdings: DELETE FROM holdings WHERE id
    if (sql.includes('DELETE FROM holdings WHERE id')) {
      const [holdingId, portfolioId] = params
      const holdings = holdingsStore.get(portfolioId) || []
      holdingsStore.set(portfolioId, holdings.filter(h => h.id !== holdingId && h.id !== Number(holdingId)))
      return { rows: [], rowCount: 1 }
    }

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

describe('Portfolio', () => {
  let token

  beforeAll(async () => {
    const u = { username: `port_${Date.now()}`, password: 'TestPass123!' }
    const res = await request(app).post('/auth/register').send(u)
    token = res.body.token
  })

  test('GET /api/portfolio returns empty holdings initially', async () => {
    const res = await request(app).get('/api/portfolio').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.holdings).toEqual([])
  })

  test('POST /api/portfolio/holdings adds a holding', async () => {
    const res = await request(app)
      .post('/api/portfolio/holdings')
      .set('Authorization', `Bearer ${token}`)
      .send([{ ticker: 'AAPL', exchange: 'US', quantity: 10, avg_cost: 150 }])
    expect(res.status).toBe(201)
    expect(res.body.holdings.length).toBeGreaterThan(0)
    expect(res.body.holdings[0].ticker).toBe('AAPL')
  })

  test('DELETE /api/portfolio/holdings/:id removes a holding', async () => {
    // First add
    const add = await request(app)
      .post('/api/portfolio/holdings')
      .set('Authorization', `Bearer ${token}`)
      .send([{ ticker: 'MSFT', exchange: 'US', quantity: 5, avg_cost: 300 }])
    const id = add.body.holdings.find(h => h.ticker === 'MSFT')?.id
    expect(id).toBeDefined()
    // Then delete
    const del = await request(app)
      .delete(`/api/portfolio/holdings/${id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(del.status).toBe(200)
  })
})

describe('fetchStockData', () => {
  const { fetchStockData } = require('../server')

  test('returns financial data for AAPL (US)', async () => {
    const data = await fetchStockData('AAPL', 'US')
    expect(data.price).toBe(189.42)
    expect(data.pe_ratio).toBeDefined()
    expect(data.sector).toBeDefined()
    expect(data.currency).toBe('USD')
  })

  test('uses .TA suffix for TASE stocks', async () => {
    const data = await fetchStockData('TEVA', 'TASE')
    expect(data.symbol).toBe('TEVA.TA')
    expect(data.currency).toBe('ILS')
  })

  test('handles yahoo-finance2 errors gracefully', async () => {
    const { quote } = require('yahoo-finance2')
    quote.mockRejectedValueOnce(new Error('Network error'))
    const data = await fetchStockData('BADTICKER', 'US')
    expect(data.price).toBeNull()
    expect(data.error).toBeDefined()
  })
})
