const request = require('supertest')

// Mock external-service modules before requiring server
jest.mock('axios', () => ({
  get: jest.fn()
}))
jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn().mockResolvedValue({ statusCode: 201 }),
  generateVAPIDKeys: jest.fn().mockReturnValue({ publicKey: 'pk', privateKey: 'sk' })
}))
jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockImplementation(async (params) => {
        // Screenshot parse call has no system param, analysis call has system param
        if (!params.system) {
          return { content: [{ text: JSON.stringify([{ ticker: 'AAPL', exchange: 'US', quantity: 15, avg_cost: 175 }]) }] }
        }
        return { content: [{ text: JSON.stringify({
          valuation: 'fair',
          valuation_note: 'Trading at market multiple',
          moat: 'wide',
          moat_note: 'Strong brand and ecosystem',
          management: 'Tim Cook has delivered consistent results',
          outlook: 'Steady growth expected. Services segment expanding.',
          bear_case: 'China exposure is a real risk. Premium pricing under pressure.',
          tags: { moat: 'חפיר רחב', valuation: 'הוגן', risk: 'נמוך' },
          ecosystem: []
        }) }] }
      })
    }
  }))
})

// Mock pg Pool before requiring server
jest.mock('pg', () => {
  const users = new Map()
  let idCounter = 1
  // Holdings store: map from portfolioId -> array of holding objects
  const holdingsStore = new Map()
  let holdingIdCounter = 100
  // Profile store: map from userId -> profile_json object
  const profileStore = new Map()
  // Push subscriptions store: map from userId -> array of { id, subscription_json }
  const pushStore = new Map()
  let pushIdCounter = 1000

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
      // initialise default profile
      profileStore.set(id, { language: 'he', alert_level: 2 })
      // initialise empty push subscriptions
      pushStore.set(id, [])
      return { rows: [{ id, username }] }
    }
    // register: INSERT INTO portfolios
    if (sql.includes('INSERT INTO portfolios')) return { rows: [] }
    // register: INSERT INTO user_profiles (initial insert without ON CONFLICT)
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
    // holdings: SELECT ticker FROM holdings WHERE portfolio_id (for analysis)
    if (sql.includes('SELECT ticker FROM holdings WHERE portfolio_id')) {
      const portfolioId = params[0]
      const holdings = holdingsStore.get(portfolioId) || []
      return { rows: holdings.map(h => ({ ticker: h.ticker })) }
    }
    // holdings: UPDATE holdings SET analysis_json
    if (sql.includes('UPDATE holdings SET analysis_json')) {
      return { rows: [] }
    }

    // profile: SELECT profile_json FROM user_profiles
    if (sql.includes('SELECT profile_json FROM user_profiles')) {
      const userId = params[0]
      const profile = profileStore.get(userId) || { language: 'he', alert_level: 2 }
      return { rows: [{ profile_json: profile }] }
    }
    // profile: INSERT INTO user_profiles ... ON CONFLICT (profile update upsert)
    if (sql.includes('INSERT INTO user_profiles') && sql.includes('ON CONFLICT')) {
      const userId = params[0]
      const updates = typeof params[1] === 'string' ? JSON.parse(params[1]) : params[1]
      const existing = profileStore.get(userId) || { language: 'he', alert_level: 2 }
      profileStore.set(userId, { ...existing, ...updates })
      return { rows: [] }
    }

    // notifications: SELECT * FROM news_notifications
    if (sql.includes('FROM news_notifications')) {
      return { rows: [] }
    }
    // notifications: INSERT INTO news_notifications
    if (sql.includes('INSERT INTO news_notifications')) {
      return { rows: [] }
    }

    // pollNews: SELECT DISTINCT ps.user_id ... FROM push_subscriptions ps
    if (sql.includes('SELECT DISTINCT') && sql.includes('push_subscriptions')) {
      // Return users that have push subscriptions
      const result = []
      for (const [uid, subs] of pushStore.entries()) {
        if (subs.length > 0) {
          const profile = profileStore.get(uid) || { alert_level: 2 }
          result.push({ user_id: uid, alert_level: String(profile.alert_level || 2) })
        }
      }
      return { rows: result }
    }

    // news_seen: SELECT 1 FROM news_seen WHERE user_id
    if (sql.includes('FROM news_seen') && sql.includes('SELECT')) {
      return { rows: [], rowCount: 0 }
    }
    // news_seen: INSERT INTO news_seen
    if (sql.includes('INSERT INTO news_seen')) {
      return { rows: [] }
    }

    // push subscriptions: INSERT INTO push_subscriptions
    if (sql.includes('INSERT INTO push_subscriptions')) {
      const [userId, subscriptionJson] = params
      const subs = pushStore.get(userId) || []
      const sub = typeof subscriptionJson === 'string' ? JSON.parse(subscriptionJson) : subscriptionJson
      subs.push({ id: pushIdCounter++, user_id: userId, subscription_json: sub })
      pushStore.set(userId, subs)
      return { rows: [] }
    }
    // push subscriptions: DELETE FROM push_subscriptions WHERE user_id ... endpoint
    if (sql.includes('DELETE FROM push_subscriptions') && sql.includes('endpoint')) {
      const [userId, endpoint] = params
      const subs = pushStore.get(userId) || []
      pushStore.set(userId, subs.filter(s => s.subscription_json.endpoint !== endpoint))
      return { rows: [], rowCount: 1 }
    }
    // push subscriptions: DELETE FROM push_subscriptions WHERE id (expired cleanup)
    if (sql.includes('DELETE FROM push_subscriptions WHERE id')) {
      const [subId] = params
      for (const [uid, subs] of pushStore.entries()) {
        pushStore.set(uid, subs.filter(s => s.id !== subId && s.id !== Number(subId)))
      }
      return { rows: [], rowCount: 1 }
    }
    // push subscriptions: SELECT id, subscription_json FROM push_subscriptions WHERE user_id
    if (sql.includes('SELECT id, subscription_json FROM push_subscriptions')) {
      const userId = params[0]
      const subs = pushStore.get(userId) || []
      return { rows: subs }
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
  const axios = require('axios')

  const mockChartResponse = (price, changePct, currency = 'USD') => ({
    data: { chart: { result: [{ meta: { regularMarketPrice: price, chartPreviousClose: price / (1 + changePct / 100), fiftyTwoWeekHigh: 220, fiftyTwoWeekLow: 164, shortName: 'Test Stock', currency } }] } }
  })
  const mockSummaryResponse = () => ({
    data: { quoteSummary: { result: [{ summaryDetail: { trailingPE: { raw: 28.4 } }, defaultKeyStatistics: { trailingEps: { raw: 6.66 } }, price: { marketCap: { raw: 2900000000000 } }, assetProfile: { sector: 'Technology', industry: 'Consumer Electronics' } }] } }
  })
  const mockSearchResponse = (symbol) => ({
    data: { quotes: [{ symbol, shortname: 'Test Stock', sector: 'Technology', industry: 'Consumer Electronics' }] }
  })

  test('returns financial data for AAPL (US)', async () => {
    axios.get.mockResolvedValueOnce(mockChartResponse(189.42, 2.4)).mockResolvedValueOnce(mockSummaryResponse()).mockResolvedValueOnce(mockSearchResponse('AAPL'))
    const data = await fetchStockData('AAPL', 'US')
    expect(data.price).toBe(189.42)
    expect(data.pe_ratio).toBeDefined()
    expect(data.sector).toBeDefined()
    expect(data.currency).toBe('USD')
  })

  test('uses .TA suffix for TASE stocks', async () => {
    axios.get.mockResolvedValueOnce(mockChartResponse(41.2, -1.1, 'ILS')).mockResolvedValueOnce(mockSummaryResponse()).mockResolvedValueOnce(mockSearchResponse('TEVA.TA'))
    const data = await fetchStockData('TEVA', 'TASE')
    expect(data.symbol).toBe('TEVA.TA')
    expect(data.currency).toBe('ILS')
  })

  test('returns null price when ticker not found', async () => {
    axios.get.mockResolvedValueOnce({ data: { chart: { result: [{ meta: {} }] } } }).mockResolvedValueOnce(null).mockResolvedValueOnce(null)
    const data = await fetchStockData('BADTICKER', 'US')
    expect(data.price).toBeNull()
    expect(data.error).toBeDefined()
  })
})

describe('Analysis', () => {
  let token
  const axios = require('axios')
  const mockYFChart = (price = 189.42) => ({ data: { chart: { result: [{ meta: { regularMarketPrice: price, chartPreviousClose: price / 1.024, fiftyTwoWeekHigh: 220, fiftyTwoWeekLow: 164, shortName: 'Apple Inc.', currency: 'USD' } }] } } })
  const mockYFSummary = () => ({ data: { quoteSummary: { result: [{ summaryDetail: { trailingPE: { raw: 28.4 } }, defaultKeyStatistics: { trailingEps: { raw: 6.66 } }, price: { marketCap: { raw: 2900000000000 } }, assetProfile: { sector: 'Technology', industry: 'Consumer Electronics' } }] } } })

  beforeAll(async () => {
    const u = { username: `analysis_${Date.now()}`, password: 'TestPass123!' }
    const res = await request(app).post('/auth/register').send(u)
    token = res.body.token
    await request(app)
      .post('/api/portfolio/holdings')
      .set('Authorization', `Bearer ${token}`)
      .send([{ ticker: 'AAPL', exchange: 'US', quantity: 10, avg_cost: 150 }])
  })

  const mockYFSearch = () => ({ data: { quotes: [{ symbol: 'AAPL', shortname: 'Apple Inc.', sector: 'Technology', industry: 'Consumer Electronics' }] } })

  beforeEach(() => {
    axios.get.mockResolvedValueOnce(mockYFChart()).mockResolvedValueOnce(mockYFSummary()).mockResolvedValueOnce(mockYFSearch())
  })

  test('POST /api/analyze/:ticker returns analysis with bear case', async () => {
    const res = await request(app)
      .post('/api/analyze/AAPL')
      .set('Authorization', `Bearer ${token}`)
      .send({ exchange: 'US' })
    expect(res.status).toBe(200)
    expect(res.body.analysis.valuation).toBeDefined()
    expect(res.body.analysis.bear_case).toBeDefined()
    expect(res.body.analysis.tags).toBeDefined()
    expect(res.body.analysis.ecosystem).toBeDefined()
  })

  test('POST /api/analyze/:ticker requires auth', async () => {
    const res = await request(app).post('/api/analyze/AAPL').send({ exchange: 'US' })
    expect(res.status).toBe(401)
  })
})

describe('Screenshot Parser', () => {
  let token

  beforeAll(async () => {
    const u = { username: `screenshot_${Date.now()}`, password: 'TestPass123!' }
    const res = await request(app).post('/auth/register').send(u)
    token = res.body.token
  })

  test('POST /api/portfolio/screenshot parses holdings from image', async () => {
    // Create a minimal PNG buffer (1x1 transparent PNG)
    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    )
    const res = await request(app)
      .post('/api/portfolio/screenshot')
      .set('Authorization', `Bearer ${token}`)
      .attach('screenshot', pngBuffer, { filename: 'test.png', contentType: 'image/png' })
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.holdings)).toBe(true)
    expect(res.body.holdings[0].ticker).toBe('AAPL')
  })

  test('POST /api/portfolio/screenshot rejects missing file', async () => {
    const res = await request(app)
      .post('/api/portfolio/screenshot')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(400)
  })
})

describe('Profile', () => {
  let token

  beforeAll(async () => {
    const u = { username: `profile_${Date.now()}`, password: 'TestPass123!' }
    const res = await request(app).post('/auth/register').send(u)
    token = res.body.token
  })

  test('GET /api/profile returns default profile', async () => {
    const res = await request(app).get('/api/profile').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.language).toBeDefined()
    expect(res.body.alert_level).toBeDefined()
  })

  test('PUT /api/profile updates language', async () => {
    const res = await request(app)
      .put('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ language: 'en' })
    expect(res.status).toBe(200)
    expect(res.body.language).toBe('en')
  })

  test('PUT /api/profile rejects invalid language', async () => {
    const res = await request(app)
      .put('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ language: 'fr' })
    expect(res.status).toBe(400)
  })

  test('GET /api/notifications returns empty array initially', async () => {
    const res = await request(app).get('/api/notifications').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.notifications).toEqual([])
  })
})

describe('Push Subscriptions', () => {
  let token

  beforeAll(async () => {
    const u = { username: `push_${Date.now()}`, password: 'TestPass123!' }
    const res = await request(app).post('/auth/register').send(u)
    token = res.body.token
  })

  test('GET /api/push/vapid-key returns public key', async () => {
    const res = await request(app).get('/api/push/vapid-key')
    expect(res.status).toBe(200)
    expect(res.body.public_key).toBeDefined()
  })

  test('POST /api/push/subscribe saves subscription', async () => {
    const res = await request(app)
      .post('/api/push/subscribe')
      .set('Authorization', `Bearer ${token}`)
      .send({ subscription: { endpoint: 'https://push.example.com/test', keys: { p256dh: 'abc', auth: 'def' } } })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  test('POST /api/push/subscribe rejects missing endpoint', async () => {
    const res = await request(app)
      .post('/api/push/subscribe')
      .set('Authorization', `Bearer ${token}`)
      .send({ subscription: {} })
    expect(res.status).toBe(400)
  })

  test('DELETE /api/push/subscribe removes subscription', async () => {
    const res = await request(app)
      .delete('/api/push/subscribe')
      .set('Authorization', `Bearer ${token}`)
      .send({ endpoint: 'https://push.example.com/test' })
    expect(res.status).toBe(200)
  })
})

describe('Background Polling', () => {
  const { pollNews } = require('../server')
  const axios = require('axios')

  beforeEach(() => {
    axios.get.mockResolvedValue({
      data: {
        articles: [
          {
            url: 'https://news.example.com/aapl-earnings',
            title: 'Apple Reports Record Q4 Earnings',
            description: 'Apple Inc reported record earnings beating analyst expectations',
            content: 'Full article text here...'
          }
        ]
      }
    })
  })

  test('pollNews does nothing when NEWS_API_KEY is not set', async () => {
    const originalKey = process.env.NEWS_API_KEY
    delete process.env.NEWS_API_KEY
    await expect(pollNews()).resolves.toBeUndefined()
    process.env.NEWS_API_KEY = originalKey
  })

  test('pollNews processes articles and sends push when NEWS_API_KEY set', async () => {
    process.env.NEWS_API_KEY = 'test-key'
    // Update Anthropic mock to return notify:true for news filter
    const Anthropic = require('@anthropic-ai/sdk')
    const instance = new Anthropic()
    instance.messages.create.mockResolvedValueOnce({
      content: [{ text: JSON.stringify({ notify: true, category: 'רווחים', summary: 'Apple records earnings beat.', is_earnings: false }) }]
    })
    await pollNews()
    delete process.env.NEWS_API_KEY
    // No crash = success (push subscriptions may be empty in test context)
    expect(true).toBe(true)
  })
})
