# Portfolio AI PWA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a PWA where users manage a stock portfolio, receive AI analysis per stock (valuation, moat, bear case, ecosystem mapping), and get Web Push notifications for material news events.

**Architecture:** Single Node.js/Express `server.js` + single-file SPA `public/index.html` + Service Worker `public/sw.js`, backed by PostgreSQL on Railway. Claude Haiku handles screenshot parsing, stock analysis, news filtering, and earnings summarization. Background `setInterval` polls NewsAPI every 15 minutes and sends Web Push via VAPID.

**Tech Stack:** Node.js, Express, PostgreSQL (`pg`), `@anthropic-ai/sdk`, `yahoo-finance2`, `web-push`, `axios`, `cheerio`, `multer`, `bcryptjs`, `jsonwebtoken`, `express-rate-limit`, Jest + Supertest (tests)

---

## File Map

| File | Responsibility |
|---|---|
| `portfolio-ai/server.js` | All routes, auth, DB, background polling, Claude calls |
| `portfolio-ai/package.json` | Dependencies + test script |
| `portfolio-ai/.env.example` | Required env vars template |
| `portfolio-ai/public/index.html` | Single-file SPA — all CSS + JS inline |
| `portfolio-ai/public/sw.js` | Service Worker — push notification handler |
| `portfolio-ai/public/manifest.json` | PWA manifest |
| `portfolio-ai/__tests__/server.test.js` | Jest + Supertest integration tests |

---

## Task 1: Project Scaffold

**Files:**
- Create: `portfolio-ai/package.json`
- Create: `portfolio-ai/.env.example`
- Create: `portfolio-ai/.gitignore`
- Create: `portfolio-ai/server.js` (skeleton only)

- [ ] **Step 1: Create project directory and package.json**

```bash
mkdir portfolio-ai && cd portfolio-ai
```

`portfolio-ai/package.json`:
```json
{
  "name": "portfolio-ai",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js",
    "test": "jest --runInBand --forceExit",
    "generate-vapid": "node -e \"const wp=require('web-push');const k=wp.generateVAPIDKeys();console.log(JSON.stringify(k,null,2))\""
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.37.0",
    "axios": "^1.7.0",
    "bcryptjs": "^2.4.3",
    "cheerio": "^1.0.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "express-rate-limit": "^7.5.1",
    "jsonwebtoken": "^9.0.2",
    "multer": "^1.4.5-lts.1",
    "pg": "^8.11.5",
    "web-push": "^3.6.7",
    "yahoo-finance2": "^2.11.0"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "supertest": "^7.0.0"
  }
}
```

- [ ] **Step 2: Create .env.example**

`portfolio-ai/.env.example`:
```
ANTHROPIC_API_KEY=
DATABASE_URL=postgresql://user:pass@host:5432/dbname
JWT_SECRET=change_me_to_a_long_random_string
NEWS_API_KEY=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_EMAIL=mailto:your@email.com
ORIGIN=http://localhost:3000
PORT=3000
```

- [ ] **Step 3: Create .gitignore**

`portfolio-ai/.gitignore`:
```
node_modules/
.env
```

- [ ] **Step 4: Create server.js skeleton**

`portfolio-ai/server.js`:
```js
require('dotenv').config()
const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { Pool } = require('pg')
const cors = require('cors')
const rateLimit = require('express-rate-limit')
const Anthropic = require('@anthropic-ai/sdk')
const yahooFinance = require('yahoo-finance2').default
const webpush = require('web-push')
const axios = require('axios')
const cheerio = require('cheerio')
const multer = require('multer')
const fs = require('fs')
const path = require('path')

const app = express()
const PORT = process.env.PORT || 3000

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
})

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

webpush.setVapidDetails(
  process.env.VAPID_EMAIL || 'mailto:admin@example.com',
  process.env.VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
)

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

app.use(cors({ origin: process.env.ORIGIN || 'http://localhost:3000', credentials: true }))
app.use(express.json({ limit: '15mb' }))
app.use(express.static(path.join(__dirname, 'public')))

// Routes will be added in subsequent tasks

if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
}

module.exports = app
```

- [ ] **Step 5: Install dependencies**

```bash
cd portfolio-ai && npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 6: Commit**

```bash
git add portfolio-ai/
git commit -m "feat: scaffold portfolio-ai project"
```

---

## Task 2: Database Schema

**Files:**
- Modify: `portfolio-ai/server.js` — add `initDB()`

- [ ] **Step 1: Add initDB() to server.js after the webpush setup block**

```js
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS portfolios (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL DEFAULT 'הפורטפוליו שלי',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS holdings (
      id SERIAL PRIMARY KEY,
      portfolio_id INTEGER REFERENCES portfolios(id) ON DELETE CASCADE,
      ticker TEXT NOT NULL,
      exchange TEXT NOT NULL DEFAULT 'US',
      quantity NUMERIC NOT NULL,
      avg_cost NUMERIC,
      analysis_json JSONB,
      analyzed_at TIMESTAMPTZ,
      UNIQUE(portfolio_id, ticker)
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      subscription_json JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS news_seen (
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      article_url TEXT NOT NULL,
      seen_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_id, article_url)
    );

    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      profile_json JSONB NOT NULL DEFAULT '{"language":"he","alert_level":2}'
    );

    CREATE INDEX IF NOT EXISTS idx_holdings_portfolio ON holdings(portfolio_id);
    CREATE INDEX IF NOT EXISTS idx_news_seen_user ON news_seen(user_id);
    CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);
  `)
  console.log('DB initialized')
}
```

- [ ] **Step 2: Call initDB() before app.listen**

Replace the `if (require.main === module)` block:
```js
if (require.main === module) {
  initDB().then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
  }).catch(err => { console.error('DB init failed', err); process.exit(1) })
}
```

- [ ] **Step 3: Verify schema creates cleanly**

```bash
cd portfolio-ai && DATABASE_URL="your_railway_url" node -e "require('./server')"
```

Expected: `DB initialized` then `Server running on port 3000`.

- [ ] **Step 4: Commit**

```bash
git add portfolio-ai/server.js
git commit -m "feat: add PostgreSQL schema with initDB()"
```

---

## Task 3: Auth — Register, Login, JWT Middleware

**Files:**
- Modify: `portfolio-ai/server.js` — add auth routes + middleware
- Create: `portfolio-ai/__tests__/server.test.js`

- [ ] **Step 1: Write failing auth tests**

`portfolio-ai/__tests__/server.test.js`:
```js
const request = require('supertest')
const app = require('../server')

describe('Auth', () => {
  const user = { username: `test_${Date.now()}`, password: 'TestPass123!' }

  test('POST /auth/register creates user and returns token', async () => {
    const res = await request(app).post('/auth/register').send(user)
    expect(res.status).toBe(201)
    expect(res.body.token).toBeDefined()
  })

  test('POST /auth/register rejects duplicate username', async () => {
    await request(app).post('/auth/register').send(user)
    const res = await request(app).post('/auth/register').send(user)
    expect(res.status).toBe(409)
  })

  test('POST /auth/login returns token for valid credentials', async () => {
    await request(app).post('/auth/register').send(user)
    const res = await request(app).post('/auth/login').send(user)
    expect(res.status).toBe(200)
    expect(res.body.token).toBeDefined()
  })

  test('POST /auth/login rejects wrong password', async () => {
    await request(app).post('/auth/register').send(user)
    const res = await request(app).post('/auth/login').send({ ...user, password: 'wrong' })
    expect(res.status).toBe(401)
  })

  test('Protected route rejects missing token', async () => {
    const res = await request(app).get('/api/portfolio')
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd portfolio-ai && npm test
```

Expected: all 5 tests FAIL with `404` or connection errors.

- [ ] **Step 3: Add rate limiters and auth middleware to server.js**

Add after the `multer` setup line:
```js
const authLimiter = rateLimit({ windowMs: 60 * 1000, max: 10 })
const analyzeLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 20 })
const screenshotLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10 })

function auth(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' })
  try {
    req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET || 'dev_secret')
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}

function extractJson(text) {
  const arr = text.match(/\[[\s\S]*\]/)
  const obj = text.match(/\{[\s\S]*\}/)
  try { if (arr) return JSON.parse(arr[0]) } catch {}
  try { if (obj) return JSON.parse(obj[0]) } catch {}
  return null
}
```

- [ ] **Step 4: Add auth routes to server.js**

Add after the `extractJson` function:
```js
app.post('/auth/register', authLimiter, async (req, res) => {
  const { username, password } = req.body
  if (!username || !password || username.length < 3 || password.length < 6)
    return res.status(400).json({ error: 'שם משתמש וסיסמה חובה (מינימום 3 ו-6 תווים)' })
  try {
    const hash = await bcrypt.hash(password, 12)
    const { rows } = await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username',
      [username.toLowerCase().trim(), hash]
    )
    const user = rows[0]
    await pool.query('INSERT INTO portfolios (user_id) VALUES ($1)', [user.id])
    await pool.query('INSERT INTO user_profiles (user_id) VALUES ($1)', [user.id])
    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '7d' })
    res.status(201).json({ token, username: user.username })
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'שם המשתמש כבר קיים' })
    console.error(err)
    res.status(500).json({ error: 'שגיאת שרת' })
  }
})

app.post('/auth/login', authLimiter, async (req, res) => {
  const { username, password } = req.body
  if (!username || !password) return res.status(400).json({ error: 'שם משתמש וסיסמה חובה' })
  const dummy = '$2a$12$dummy.hash.to.prevent.timing.attacks.xxxxxxxxxxxxxxxx'
  try {
    const { rows } = await pool.query('SELECT id, username, password_hash FROM users WHERE username = $1', [username.toLowerCase().trim()])
    const user = rows[0]
    const valid = await bcrypt.compare(password, user ? user.password_hash : dummy)
    if (!user || !valid) return res.status(401).json({ error: 'שם משתמש או סיסמה שגויים' })
    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '7d' })
    res.json({ token, username: user.username })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'שגיאת שרת' })
  }
})

app.post('/auth/change-password', auth, async (req, res) => {
  const { current_password, new_password } = req.body
  if (!current_password || !new_password || new_password.length < 6)
    return res.status(400).json({ error: 'הסיסמה החדשה חייבת להיות לפחות 6 תווים' })
  try {
    const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id])
    const valid = await bcrypt.compare(current_password, rows[0].password_hash)
    if (!valid) return res.status(401).json({ error: 'הסיסמה הנוכחית שגויה' })
    const hash = await bcrypt.hash(new_password, 12)
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id])
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'שגיאת שרת' })
  }
})
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
cd portfolio-ai && npm test
```

Expected: all 5 auth tests PASS.

- [ ] **Step 6: Commit**

```bash
git add portfolio-ai/
git commit -m "feat: auth register/login/change-password with JWT"
```

---

## Task 4: Portfolio API — Holdings CRUD

**Files:**
- Modify: `portfolio-ai/server.js` — add portfolio routes
- Modify: `portfolio-ai/__tests__/server.test.js` — add portfolio tests

- [ ] **Step 1: Write failing portfolio tests**

Append to `__tests__/server.test.js`:
```js
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
    expect(res.body.holdings).toHaveLength(1)
    expect(res.body.holdings[0].ticker).toBe('AAPL')
  })

  test('DELETE /api/portfolio/holdings/:id removes a holding', async () => {
    const add = await request(app)
      .post('/api/portfolio/holdings')
      .set('Authorization', `Bearer ${token}`)
      .send([{ ticker: 'MSFT', exchange: 'US', quantity: 5, avg_cost: 300 }])
    const id = add.body.holdings.find(h => h.ticker === 'MSFT').id
    const del = await request(app)
      .delete(`/api/portfolio/holdings/${id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(del.status).toBe(200)
  })
})
```

- [ ] **Step 2: Run — verify new tests fail**

```bash
cd portfolio-ai && npm test -- --testNamePattern="Portfolio"
```

Expected: 3 FAIL with 404.

- [ ] **Step 3: Add portfolio routes to server.js**

Add after the auth routes:
```js
async function getUserPortfolioId(userId) {
  const { rows } = await pool.query('SELECT id FROM portfolios WHERE user_id = $1', [userId])
  return rows[0]?.id
}

app.get('/api/portfolio', auth, async (req, res) => {
  try {
    const portfolioId = await getUserPortfolioId(req.user.id)
    if (!portfolioId) return res.json({ holdings: [], total_value: 0 })
    const { rows } = await pool.query(
      'SELECT id, ticker, exchange, quantity, avg_cost, analysis_json, analyzed_at FROM holdings WHERE portfolio_id = $1 ORDER BY ticker',
      [portfolioId]
    )
    res.json({ holdings: rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'שגיאת שרת' })
  }
})

app.post('/api/portfolio/holdings', auth, async (req, res) => {
  // req.body is array of { ticker, exchange, quantity, avg_cost }
  const items = Array.isArray(req.body) ? req.body : [req.body]
  if (!items.length) return res.status(400).json({ error: 'חסרים פרטי מניה' })
  try {
    const portfolioId = await getUserPortfolioId(req.user.id)
    if (!portfolioId) return res.status(400).json({ error: 'פורטפוליו לא נמצא' })
    for (const item of items) {
      const { ticker, exchange = 'US', quantity, avg_cost } = item
      if (!ticker || !quantity) continue
      await pool.query(
        `INSERT INTO holdings (portfolio_id, ticker, exchange, quantity, avg_cost)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (portfolio_id, ticker) DO UPDATE SET quantity = $4, avg_cost = $5`,
        [portfolioId, ticker.toUpperCase(), exchange, quantity, avg_cost || null]
      )
    }
    const { rows } = await pool.query(
      'SELECT id, ticker, exchange, quantity, avg_cost, analysis_json, analyzed_at FROM holdings WHERE portfolio_id = $1 ORDER BY ticker',
      [portfolioId]
    )
    res.status(201).json({ holdings: rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'שגיאת שרת' })
  }
})

app.delete('/api/portfolio/holdings/:id', auth, async (req, res) => {
  try {
    const portfolioId = await getUserPortfolioId(req.user.id)
    await pool.query('DELETE FROM holdings WHERE id = $1 AND portfolio_id = $2', [req.params.id, portfolioId])
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'שגיאת שרת' })
  }
})
```

- [ ] **Step 4: Run tests — verify pass**

```bash
cd portfolio-ai && npm test -- --testNamePattern="Portfolio"
```

Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add portfolio-ai/
git commit -m "feat: portfolio holdings CRUD API"
```

---

## Task 5: Stock Data — yahoo-finance2 Helper

**Files:**
- Modify: `portfolio-ai/server.js` — add `fetchStockData()`

- [ ] **Step 1: Write a failing test for fetchStockData**

Append to `__tests__/server.test.js`:
```js
const { fetchStockData } = require('../server')

describe('fetchStockData', () => {
  test('returns financial data for AAPL', async () => {
    const data = await fetchStockData('AAPL', 'US')
    expect(data.price).toBeDefined()
    expect(data.pe_ratio).toBeDefined()
    expect(data.sector).toBeDefined()
  }, 15000)

  test('returns data for TEVA.TA (TASE)', async () => {
    const data = await fetchStockData('TEVA', 'TASE')
    expect(data.price).toBeDefined()
  }, 15000)
})
```

- [ ] **Step 2: Run — verify FAIL (function not exported)**

```bash
cd portfolio-ai && npm test -- --testNamePattern="fetchStockData"
```

Expected: FAIL with `fetchStockData is not a function`.

- [ ] **Step 3: Add fetchStockData() to server.js**

Add after the `extractJson` function:
```js
async function fetchStockData(ticker, exchange) {
  const symbol = exchange === 'TASE' ? `${ticker}.TA` : ticker
  try {
    const [quote, summary] = await Promise.all([
      yahooFinance.quote(symbol),
      yahooFinance.quoteSummary(symbol, { modules: ['summaryDetail', 'defaultKeyStatistics', 'assetProfile'] }).catch(() => null)
    ])
    return {
      ticker,
      symbol,
      price: quote.regularMarketPrice,
      change_pct: quote.regularMarketChangePercent?.toFixed(2),
      market_cap: quote.marketCap,
      pe_ratio: quote.trailingPE || summary?.summaryDetail?.trailingPE,
      eps: quote.epsTrailingTwelveMonths,
      week52_high: quote.fiftyTwoWeekHigh,
      week52_low: quote.fiftyTwoWeekLow,
      sector: summary?.assetProfile?.sector || quote.sector || 'N/A',
      industry: summary?.assetProfile?.industry || 'N/A',
      short_name: quote.shortName || quote.longName || ticker,
      currency: quote.currency || (exchange === 'TASE' ? 'ILS' : 'USD')
    }
  } catch (err) {
    console.error(`fetchStockData error for ${symbol}:`, err.message)
    return { ticker, symbol, price: null, error: err.message }
  }
}
module.exports.fetchStockData = fetchStockData
```

- [ ] **Step 4: Run — verify PASS**

```bash
cd portfolio-ai && npm test -- --testNamePattern="fetchStockData"
```

Expected: 2 PASS (may take up to 15s per test due to network).

- [ ] **Step 5: Commit**

```bash
git add portfolio-ai/
git commit -m "feat: fetchStockData helper with yahoo-finance2"
```

---

## Task 6: Claude Stock Analysis + /api/analyze/:ticker

**Files:**
- Modify: `portfolio-ai/server.js` — add `analyzeStock()` + route

- [ ] **Step 1: Add analyzeStock() to server.js after fetchStockData**

```js
async function analyzeStock(stockData, allPortfolioTickers) {
  const prompt = `You are a skeptical financial analyst. Here is financial data for ${stockData.ticker}:

Price: ${stockData.price} ${stockData.currency}
P/E: ${stockData.pe_ratio || 'N/A'}
EPS: ${stockData.eps || 'N/A'}
52W High: ${stockData.week52_high} | 52W Low: ${stockData.week52_low}
Market Cap: ${stockData.market_cap ? (stockData.market_cap / 1e9).toFixed(1) + 'B' : 'N/A'}
Sector: ${stockData.sector} | Industry: ${stockData.industry}

Provide a JSON response with this exact structure:
{
  "valuation": "cheap|fair|expensive",
  "valuation_note": "one sentence explaining vs sector peers",
  "moat": "wide|narrow|none",
  "moat_note": "one sentence explaining moat source",
  "management": "one sentence on management quality",
  "outlook": "2-3 sentences on 12-24 month outlook",
  "bear_case": "2-3 sentences arguing why this analysis could be wrong — list real risks, red flags, threats",
  "tags": {
    "moat": "חפיר רחב|חפיר צר|ללא חפיר",
    "valuation": "יקר|הוגן|זול",
    "risk": "גבוה|בינוני|נמוך"
  },
  "ecosystem": []
}

For ecosystem: if ${stockData.ticker} has a real supply-chain, revenue, or competitive relationship with any of these tickers [${allPortfolioTickers.join(', ')}], include { "ticker": "X", "impact": "one sentence" } for each. If none, return [].

Be direct. No disclaimers. Respond ONLY with the JSON object.`

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    system: [{ type: 'text', text: 'You are a skeptical financial analyst. Always respond with valid JSON only.', cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: prompt }]
  })

  const result = extractJson(message.content[0].text)
  if (!result) throw new Error('Claude returned invalid JSON')
  return result
}
```

- [ ] **Step 2: Add /api/analyze/:ticker route to server.js**

Add after the portfolio routes:
```js
app.post('/api/analyze/:ticker', auth, analyzeLimiter, async (req, res) => {
  const { ticker } = req.params
  const { exchange = 'US' } = req.body
  try {
    const portfolioId = await getUserPortfolioId(req.user.id)
    const { rows: allHoldings } = await pool.query(
      'SELECT ticker FROM holdings WHERE portfolio_id = $1', [portfolioId]
    )
    const allTickers = allHoldings.map(h => h.ticker).filter(t => t !== ticker)

    const stockData = await fetchStockData(ticker, exchange)
    if (stockData.error) return res.status(502).json({ error: `לא ניתן לשלוף נתונים עבור ${ticker}` })

    const analysis = await analyzeStock(stockData, allTickers)

    await pool.query(
      'UPDATE holdings SET analysis_json = $1, analyzed_at = NOW() WHERE portfolio_id = $2 AND ticker = $3',
      [JSON.stringify({ ...analysis, stock_data: stockData }), portfolioId, ticker]
    )

    res.json({ ticker, stock_data: stockData, analysis })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'שגיאת ניתוח' })
  }
})
```

- [ ] **Step 3: Manual smoke test**

Start server, register a user, add AAPL, then:
```bash
curl -X POST http://localhost:3000/api/analyze/AAPL \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"exchange":"US"}'
```

Expected: JSON with `valuation`, `moat`, `bear_case`, `tags`, `ecosystem` fields.

- [ ] **Step 4: Commit**

```bash
git add portfolio-ai/server.js
git commit -m "feat: Claude stock analysis with bear case and ecosystem mapping"
```

---

## Task 7: Screenshot Parser — Claude Vision

**Files:**
- Modify: `portfolio-ai/server.js` — add `/api/portfolio/screenshot`

- [ ] **Step 1: Add screenshot route to server.js after the analyze route**

```js
app.post('/api/portfolio/screenshot', auth, screenshotLimiter, upload.single('screenshot'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'לא הועלה קובץ' })
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowedTypes.includes(req.file.mimetype)) return res.status(400).json({ error: 'סוג קובץ לא נתמך' })

  const base64 = req.file.buffer.toString('base64')
  const mediaType = req.file.mimetype

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 }
          },
          {
            type: 'text',
            text: `Extract all stock holdings from this brokerage screenshot.
Return a JSON array only: [{ "ticker": "AAPL", "exchange": "US", "quantity": 10, "avg_cost": 150.00 }]
For Israeli stocks traded on TASE, use exchange "TASE".
If avg_cost or quantity is unclear, omit the field (don't guess).
Respond ONLY with the JSON array.`
          }
        ]
      }]
    })

    const holdings = extractJson(message.content[0].text)
    if (!Array.isArray(holdings)) return res.status(422).json({ error: 'לא ניתן לזהות מניות בצילום המסך' })

    const valid = holdings.filter(h => h.ticker && (h.quantity || h.quantity === 0))
    if (!valid.length) return res.status(422).json({ error: 'לא נמצאו מניות בצילום המסך' })

    res.json({ holdings: valid, raw_count: holdings.length })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'שגיאה בעיבוד הצילום' })
  }
})
```

- [ ] **Step 2: Manual smoke test with a real screenshot**

```bash
curl -X POST http://localhost:3000/api/portfolio/screenshot \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "screenshot=@/path/to/ib_screenshot.png"
```

Expected: `{ "holdings": [{ "ticker": "AAPL", "exchange": "US", "quantity": 10 }] }`

- [ ] **Step 3: Commit**

```bash
git add portfolio-ai/server.js
git commit -m "feat: Claude Vision screenshot parser for portfolio import"
```

---

## Task 8: Profile API + Notifications Feed

**Files:**
- Modify: `portfolio-ai/server.js` — add profile + notifications routes

- [ ] **Step 1: Add profile routes to server.js**

```js
app.get('/api/profile', auth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT profile_json FROM user_profiles WHERE user_id = $1', [req.user.id])
    res.json(rows[0]?.profile_json || { language: 'he', alert_level: 2 })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'שגיאת שרת' })
  }
})

app.put('/api/profile', auth, async (req, res) => {
  const { language, alert_level } = req.body
  const allowed_languages = ['he', 'en']
  const allowed_levels = [1, 2, 3]
  if (language && !allowed_languages.includes(language)) return res.status(400).json({ error: 'שפה לא תקינה' })
  if (alert_level && !allowed_levels.includes(alert_level)) return res.status(400).json({ error: 'רמת התראה לא תקינה' })
  try {
    await pool.query(
      `INSERT INTO user_profiles (user_id, profile_json) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET profile_json = user_profiles.profile_json || $2::jsonb`,
      [req.user.id, JSON.stringify({ ...(language && { language }), ...(alert_level && { alert_level }) })]
    )
    const { rows } = await pool.query('SELECT profile_json FROM user_profiles WHERE user_id = $1', [req.user.id])
    res.json(rows[0].profile_json)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'שגיאת שרת' })
  }
})
```

- [ ] **Step 2: Add notifications feed route**

```js
app.get('/api/notifications', auth, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 100)
  const offset = parseInt(req.query.offset) || 0
  try {
    // news_seen stores seen articles; we repurpose it to store notification records
    // by storing a JSON-serialized notification in a separate table
    // For MVP: return from news_notifications view built from news_seen + metadata
    // We'll add a news_notifications table in the background polling task
    const { rows } = await pool.query(
      `SELECT * FROM news_notifications WHERE user_id = $1 ORDER BY sent_at DESC LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    )
    res.json({ notifications: rows })
  } catch {
    res.json({ notifications: [] })
  }
})
```

- [ ] **Step 3: Add news_notifications table to initDB()**

Add to the `CREATE TABLE` block in `initDB()`:
```sql
CREATE TABLE IF NOT EXISTS news_notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  headline TEXT NOT NULL,
  summary TEXT,
  category TEXT,
  article_url TEXT,
  earnings_bullets JSONB,
  evasion_warning TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON news_notifications(user_id, sent_at DESC);
```

- [ ] **Step 4: Commit**

```bash
git add portfolio-ai/server.js
git commit -m "feat: profile API and notifications feed route"
```

---

## Task 9: Web Push — VAPID Setup + Subscribe API

**Files:**
- Modify: `portfolio-ai/server.js` — add push subscription routes
- Create: `portfolio-ai/public/sw.js`

- [ ] **Step 1: Generate VAPID keys**

```bash
cd portfolio-ai && npm run generate-vapid
```

Copy the output `publicKey` and `privateKey` to your `.env`:
```
VAPID_PUBLIC_KEY=<publicKey>
VAPID_PRIVATE_KEY=<privateKey>
VAPID_EMAIL=mailto:your@email.com
```

- [ ] **Step 2: Add push subscription routes to server.js**

```js
app.get('/api/push/vapid-key', (req, res) => {
  res.json({ public_key: process.env.VAPID_PUBLIC_KEY || '' })
})

app.post('/api/push/subscribe', auth, async (req, res) => {
  const { subscription } = req.body
  if (!subscription?.endpoint) return res.status(400).json({ error: 'subscription לא תקין' })
  try {
    await pool.query(
      `INSERT INTO push_subscriptions (user_id, subscription_json) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [req.user.id, JSON.stringify(subscription)]
    )
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'שגיאת שרת' })
  }
})

app.delete('/api/push/subscribe', auth, async (req, res) => {
  const { endpoint } = req.body
  try {
    await pool.query(
      `DELETE FROM push_subscriptions WHERE user_id = $1 AND subscription_json->>'endpoint' = $2`,
      [req.user.id, endpoint]
    )
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'שגיאת שרת' })
  }
})

async function sendPushToUser(userId, payload) {
  const { rows } = await pool.query('SELECT subscription_json FROM push_subscriptions WHERE user_id = $1', [userId])
  for (const row of rows) {
    try {
      await webpush.sendNotification(row.subscription_json, JSON.stringify(payload))
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await pool.query(`DELETE FROM push_subscriptions WHERE subscription_json->>'endpoint' = $1`, [row.subscription_json.endpoint])
      }
    }
  }
}
```

- [ ] **Step 3: Create public/sw.js**

`portfolio-ai/public/sw.js`:
```js
self.addEventListener('push', event => {
  if (!event.data) return
  const data = event.data.json()
  event.waitUntil(
    self.registration.showNotification(data.title || 'Portfolio AI', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url || '/' },
      tag: data.tag || 'portfolio-news'
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(clients.openWindow(event.notification.data.url || '/'))
})
```

- [ ] **Step 4: Commit**

```bash
git add portfolio-ai/
git commit -m "feat: Web Push VAPID setup, subscribe API, and service worker"
```

---

## Task 10: Background Polling — News + Claude Filter

**Files:**
- Modify: `portfolio-ai/server.js` — add `pollNews()` + `startPolling()`

- [ ] **Step 1: Add newsFilter() Claude call to server.js**

Add after `sendPushToUser`:
```js
async function filterNewsWithClaude(ticker, articleTitle, articleContent, alertLevel) {
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system: [{ type: 'text', text: 'You are a financial news classifier. Respond with valid JSON only.', cache_control: { type: 'ephemeral' } }],
    messages: [{
      role: 'user',
      content: `Ticker: ${ticker}
Alert level: ${alertLevel}
Level 1 = only: earnings reports, M&A, CEO/CFO departure
Level 2 = also: analyst rating changes, lawsuits, guidance revision
Level 3 = all mentions

Article title: ${articleTitle}
Article snippet: ${articleContent.slice(0, 500)}

Should this trigger a notification? Return JSON:
{ "notify": true|false, "category": "רווחים|הנהלה|תביעה|שינוי המלצה|שרשרת אספקה|כללי", "summary": "two Hebrew sentences", "is_earnings": true|false }`
    }]
  })
  return extractJson(message.content[0].text)
}

async function summarizeEarningsCall(articleText) {
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    system: [{ type: 'text', text: 'You are a skeptical financial analyst. Respond with valid JSON only.', cache_control: { type: 'ephemeral' } }],
    messages: [{
      role: 'user',
      content: `Summarize this earnings call article in exactly 5 Hebrew bullet points for a skeptical investor.
Flag if management seemed evasive on: growth, margins, competition, or guidance.

Article: ${articleText.slice(0, 3000)}

Return JSON: { "bullets": ["bullet1", "bullet2", "bullet3", "bullet4", "bullet5"], "evasion_warning": "string or null" }`
    }]
  })
  return extractJson(message.content[0].text)
}
```

- [ ] **Step 2: Add pollNews() to server.js**

Add after the Claude helper functions:
```js
async function pollNews() {
  if (!process.env.NEWS_API_KEY) return
  try {
    const { rows: usersWithSubs } = await pool.query(
      `SELECT DISTINCT ps.user_id, up.profile_json->>'alert_level' as alert_level
       FROM push_subscriptions ps
       JOIN user_profiles up ON up.user_id = ps.user_id`
    )

    for (const userRow of usersWithSubs) {
      const alertLevel = parseInt(userRow.alert_level) || 2
      const portfolioId = await getUserPortfolioId(userRow.user_id)
      if (!portfolioId) continue

      const { rows: holdings } = await pool.query(
        'SELECT ticker, exchange FROM holdings WHERE portfolio_id = $1', [portfolioId]
      )
      if (!holdings.length) continue

      const allTickers = holdings.map(h => h.ticker)

      for (const holding of holdings) {
        try {
          const newsRes = await axios.get('https://newsapi.org/v2/everything', {
            params: {
              q: holding.ticker,
              sortBy: 'publishedAt',
              pageSize: 5,
              language: 'en',
              apiKey: process.env.NEWS_API_KEY
            },
            timeout: 10000
          })

          const articles = newsRes.data.articles || []
          for (const article of articles) {
            if (!article.url) continue

            const { rowCount } = await pool.query(
              'SELECT 1 FROM news_seen WHERE user_id = $1 AND article_url = $2',
              [userRow.user_id, article.url]
            )
            if (rowCount > 0) continue

            await pool.query(
              'INSERT INTO news_seen (user_id, article_url) VALUES ($1, $2) ON CONFLICT DO NOTHING',
              [userRow.user_id, article.url]
            )

            const filter = await filterNewsWithClaude(
              holding.ticker,
              article.title || '',
              article.description || article.content || '',
              alertLevel
            )
            if (!filter?.notify) continue

            let earningsBullets = null
            let evasionWarning = null
            if (filter.is_earnings && article.content) {
              const summary = await summarizeEarningsCall(article.content)
              earningsBullets = summary?.bullets || null
              evasionWarning = summary?.evasion_warning || null
            }

            await pool.query(
              `INSERT INTO news_notifications (user_id, ticker, headline, summary, category, article_url, earnings_bullets, evasion_warning)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [userRow.user_id, holding.ticker, article.title, filter.summary, filter.category, article.url, earningsBullets ? JSON.stringify(earningsBullets) : null, evasionWarning]
            )

            await sendPushToUser(userRow.user_id, {
              title: `${holding.ticker} — ${filter.category}`,
              body: filter.summary,
              tag: `${holding.ticker}-${Date.now()}`,
              url: '/'
            })
          }
        } catch (err) {
          console.error(`pollNews error for ${holding.ticker}:`, err.message)
        }
      }
    }
  } catch (err) {
    console.error('pollNews top-level error:', err.message)
  }
}

function startPolling() {
  console.log('Background news polling started (every 15 min)')
  setInterval(pollNews, 15 * 60 * 1000)
}
```

- [ ] **Step 3: Wire startPolling() into server startup**

Update the `if (require.main === module)` block:
```js
if (require.main === module) {
  initDB().then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`)
      startPolling()
    })
  }).catch(err => { console.error('DB init failed', err); process.exit(1) })
}
```

- [ ] **Step 4: Commit**

```bash
git add portfolio-ai/server.js
git commit -m "feat: background news polling with Claude filter, earnings summarizer, push notifications"
```

---

## Task 11: Frontend — HTML Shell + CSS + Tab Bar

**Files:**
- Create: `portfolio-ai/public/index.html` (skeleton with CSS + tab bar)

- [ ] **Step 1: Create index.html with theme and tab bar**

`portfolio-ai/public/index.html` (paste this full file):
```html
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#0f2027">
<title>Portfolio AI</title>
<link rel="manifest" href="/manifest.json">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: linear-gradient(160deg, #0f2027, #203a43, #2c5364);
    --surface: rgba(255,255,255,.07);
    --surface-hover: rgba(255,255,255,.11);
    --border: rgba(255,255,255,.1);
    --accent: #64ffda;
    --up: #4ade80;
    --down: #f87171;
    --warn: #fbbf24;
    --text: #ffffff;
    --text-muted: rgba(255,255,255,.45);
    --tab-bg: rgba(7,7,20,.82);
    --tab-border: rgba(255,255,255,.08);
    --font: -apple-system, 'Segoe UI', sans-serif;
    --radius: 14px;
  }

  html, body { height: 100%; background: var(--bg); color: var(--text); font-family: var(--font); font-size: 16px; overflow: hidden; }

  #app { height: 100dvh; display: flex; flex-direction: column; }

  /* Screens */
  .screen { display: none; flex: 1; overflow-y: auto; padding: 20px 16px 0; padding-bottom: 80px; }
  .screen.active { display: block; }

  /* Auth wrapper */
  #auth-wrapper { height: 100dvh; display: none; flex-direction: column; justify-content: center; align-items: center; padding: 24px; }
  #auth-wrapper.active { display: flex; }

  /* Cards */
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 14px;
    margin-bottom: 10px;
    backdrop-filter: blur(8px);
    cursor: pointer;
    transition: background .15s;
  }
  .card:hover { background: var(--surface-hover); }

  .card-row { display: flex; justify-content: space-between; align-items: center; }
  .ticker { font-weight: 700; font-size: 16px; }
  .exchange-badge { font-size: 10px; color: var(--text-muted); background: rgba(255,255,255,.07); padding: 2px 7px; border-radius: 8px; margin-right: 6px; }
  .change-up { color: var(--up); font-size: 14px; font-weight: 600; }
  .change-down { color: var(--down); font-size: 14px; font-weight: 600; }
  .change-neutral { color: var(--text-muted); font-size: 14px; }
  .card-sub { font-size: 11px; color: var(--text-muted); margin-top: 5px; }

  .tags { display: flex; gap: 5px; margin-top: 7px; flex-wrap: wrap; }
  .tag { font-size: 10px; padding: 2px 8px; border-radius: 8px; font-weight: 500; }
  .tag-teal { background: rgba(100,255,218,.12); color: var(--accent); }
  .tag-green { background: rgba(74,222,128,.12); color: var(--up); }
  .tag-yellow { background: rgba(251,191,36,.12); color: var(--warn); }
  .tag-red { background: rgba(248,113,113,.12); color: var(--down); }
  .tag-orange { background: rgba(251,146,60,.12); color: #fb923c; }
  .tag-purple { background: rgba(167,139,250,.12); color: #a78bfa; }

  /* Buttons */
  .btn { border: none; border-radius: 12px; padding: 12px 20px; font-size: 15px; font-weight: 600; cursor: pointer; transition: opacity .15s; font-family: var(--font); }
  .btn:hover { opacity: .85; }
  .btn-primary { background: var(--accent); color: #0a0a1a; }
  .btn-secondary { background: var(--surface); color: var(--text); border: 1px solid var(--border); }
  .btn-danger { background: rgba(248,113,113,.15); color: var(--down); border: 1px solid rgba(248,113,113,.2); }
  .btn-full { width: 100%; }

  /* Inputs */
  .input { width: 100%; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; font-size: 15px; color: var(--text); font-family: var(--font); outline: none; transition: border-color .15s; }
  .input:focus { border-color: var(--accent); }
  .input::placeholder { color: var(--text-muted); }
  .input-group { margin-bottom: 14px; }
  .input-label { font-size: 12px; color: var(--text-muted); margin-bottom: 6px; display: block; }

  /* Screen headers */
  .screen-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
  .screen-title { font-size: 20px; font-weight: 700; }
  .total-badge { background: rgba(100,255,218,.12); border: 1px solid rgba(100,255,218,.25); color: var(--accent); padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }

  /* Bottom sheet */
  .sheet-overlay { display: none; position: fixed; inset: 0; background: rgba(7,7,20,.6); backdrop-filter: blur(4px); z-index: 100; align-items: flex-end; }
  .sheet-overlay.open { display: flex; }
  .sheet { width: 100%; max-height: 90dvh; overflow-y: auto; background: linear-gradient(180deg, #152533 0%, #0f1f2e 100%); border-top: 1px solid var(--border); border-radius: 20px 20px 0 0; padding: 0 16px 32px; }
  .sheet-handle { width: 36px; height: 4px; background: rgba(255,255,255,.2); border-radius: 2px; margin: 12px auto 16px; }
  .sheet-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
  .sheet-ticker { font-size: 22px; font-weight: 700; }
  .sheet-exchange { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
  .sheet-price { text-align: left; }
  .sheet-price-val { font-size: 20px; font-weight: 700; }
  .sheet-section { margin-bottom: 16px; }
  .sheet-section-title { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: .8px; margin-bottom: 8px; }
  .metrics-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .metric-box { background: var(--surface); border-radius: 10px; padding: 8px; text-align: center; }
  .metric-val { font-size: 13px; font-weight: 700; }
  .metric-key { font-size: 9px; color: var(--text-muted); margin-top: 2px; }
  .analysis-box { background: rgba(100,255,218,.04); border: 1px solid rgba(100,255,218,.12); border-radius: 12px; padding: 12px; font-size: 12px; color: rgba(255,255,255,.75); line-height: 1.7; margin-bottom: 8px; }
  .bear-box { background: rgba(248,113,113,.04); border: 1px solid rgba(248,113,113,.12); border-radius: 12px; padding: 12px; font-size: 12px; color: rgba(255,255,255,.75); line-height: 1.7; }
  .eco-item { font-size: 11px; color: var(--text-muted); padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,.05); }
  .eco-item:last-child { border-bottom: none; }
  .eco-ticker { color: var(--accent); font-weight: 600; }
  .sheet-close { background: var(--surface); border: none; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text-muted); flex-shrink: 0; }

  /* Modal */
  .modal-overlay { display: none; position: fixed; inset: 0; background: rgba(7,7,20,.7); backdrop-filter: blur(4px); z-index: 200; align-items: center; justify-content: center; padding: 20px; }
  .modal-overlay.open { display: flex; }
  .modal { background: #152533; border: 1px solid var(--border); border-radius: 20px; padding: 24px; width: 100%; max-width: 400px; }
  .modal-title { font-size: 18px; font-weight: 700; margin-bottom: 18px; }
  .modal-actions { display: flex; gap: 10px; margin-top: 18px; }

  /* Tab bar */
  .tab-bar { position: fixed; bottom: 0; left: 0; right: 0; background: var(--tab-bg); backdrop-filter: blur(20px); border-top: 1px solid var(--tab-border); display: flex; justify-content: space-around; padding: 10px 0 max(14px, env(safe-area-inset-bottom)); z-index: 50; }
  .tab { display: flex; flex-direction: column; align-items: center; gap: 3px; min-width: 64px; cursor: pointer; position: relative; padding: 2px 8px; }
  .tab svg { transition: stroke .2s; }
  .tab-label { font-size: 10px; font-weight: 500; color: var(--text-muted); letter-spacing: .2px; transition: color .2s; }
  .tab.active .tab-label { color: var(--accent); font-weight: 600; }
  .tab.active svg { stroke: var(--accent) !important; }
  .tab-dot { width: 4px; height: 4px; background: var(--accent); border-radius: 50%; position: absolute; bottom: -2px; left: 50%; transform: translateX(-50%); opacity: 0; transition: opacity .2s; }
  .tab.active .tab-dot { opacity: 1; }
  .tab-badge { position: absolute; top: 0; right: 8px; background: var(--down); color: white; font-size: 9px; font-weight: 700; min-width: 16px; height: 16px; border-radius: 8px; display: flex; align-items: center; justify-content: center; padding: 0 4px; }

  /* Notification items */
  .notif-item { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 12px 14px; margin-bottom: 10px; }
  .notif-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
  .notif-ticker { font-weight: 700; font-size: 13px; }
  .notif-time { font-size: 10px; color: var(--text-muted); }
  .notif-headline { font-size: 13px; color: rgba(255,255,255,.85); margin-bottom: 6px; line-height: 1.4; }
  .notif-summary { font-size: 12px; color: var(--text-muted); line-height: 1.5; margin-bottom: 8px; }
  .earnings-bullets { margin: 8px 0; padding-right: 16px; }
  .earnings-bullets li { font-size: 12px; color: rgba(255,255,255,.75); margin-bottom: 4px; line-height: 1.4; }
  .evasion-warning { background: rgba(251,191,36,.08); border: 1px solid rgba(251,191,36,.2); border-radius: 8px; padding: 8px 10px; font-size: 11px; color: var(--warn); margin-top: 6px; }

  /* Settings */
  .settings-section { margin-bottom: 24px; }
  .settings-label { font-size: 12px; color: var(--text-muted); text-transform: uppercase; letter-spacing: .8px; margin-bottom: 10px; }
  .settings-row { display: flex; justify-content: space-between; align-items: center; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px; margin-bottom: 8px; }
  .settings-row-label { font-size: 14px; }
  .toggle { position: relative; width: 48px; height: 26px; }
  .toggle input { opacity: 0; width: 0; height: 0; }
  .toggle-slider { position: absolute; inset: 0; background: rgba(255,255,255,.15); border-radius: 13px; cursor: pointer; transition: .2s; }
  .toggle-slider::before { content: ''; position: absolute; width: 20px; height: 20px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: .2s; }
  .toggle input:checked + .toggle-slider { background: var(--accent); }
  .toggle input:checked + .toggle-slider::before { transform: translateX(22px); background: #0a0a1a; }
  .level-btns { display: flex; gap: 6px; }
  .level-btn { flex: 1; padding: 8px 4px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface); color: var(--text-muted); font-size: 12px; cursor: pointer; text-align: center; transition: .15s; font-family: var(--font); }
  .level-btn.active { background: rgba(100,255,218,.15); border-color: var(--accent); color: var(--accent); font-weight: 600; }

  /* Auth screens */
  .auth-logo { font-size: 28px; font-weight: 800; color: var(--accent); margin-bottom: 8px; letter-spacing: -1px; }
  .auth-sub { font-size: 13px; color: var(--text-muted); margin-bottom: 32px; }
  .auth-box { width: 100%; max-width: 360px; }
  .auth-tabs { display: flex; gap: 0; margin-bottom: 24px; background: var(--surface); border-radius: 10px; padding: 3px; }
  .auth-tab { flex: 1; text-align: center; padding: 8px; border-radius: 8px; font-size: 14px; cursor: pointer; color: var(--text-muted); transition: .15s; }
  .auth-tab.active { background: var(--accent); color: #0a0a1a; font-weight: 600; }
  .error-msg { color: var(--down); font-size: 13px; margin-top: 8px; min-height: 20px; }

  /* Empty state */
  .empty-state { text-align: center; padding: 48px 20px; color: var(--text-muted); }
  .empty-icon { font-size: 48px; margin-bottom: 12px; }
  .empty-title { font-size: 16px; font-weight: 600; color: var(--text); margin-bottom: 6px; }
  .empty-sub { font-size: 13px; line-height: 1.5; }

  /* Loading spinner */
  .spinner { display: inline-block; width: 18px; height: 18px; border: 2px solid rgba(255,255,255,.2); border-top-color: var(--accent); border-radius: 50%; animation: spin .6s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .segment-options { display: flex; gap: 6px; }
  .seg-btn { flex: 1; padding: 10px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); color: var(--text-muted); font-size: 13px; cursor: pointer; text-align: center; font-family: var(--font); transition: .15s; }
  .seg-btn.active { background: rgba(100,255,218,.12); border-color: var(--accent); color: var(--accent); font-weight: 600; }

  .divider { height: 1px; background: var(--border); margin: 16px 0; }
  .text-center { text-align: center; }
  .mt-12 { margin-top: 12px; }
  .mt-20 { margin-top: 20px; }
  .gap-10 { gap: 10px; }
</style>
</head>
<body>

<!-- AUTH -->
<div id="auth-wrapper">
  <div class="auth-logo">Portfolio AI</div>
  <div class="auth-sub">ניתוח מניות חכם · התראות בזמן אמת</div>
  <div class="auth-box">
    <div class="auth-tabs">
      <div class="auth-tab active" onclick="switchAuthTab('login')">התחברות</div>
      <div class="auth-tab" onclick="switchAuthTab('register')">הרשמה</div>
    </div>
    <div class="input-group"><label class="input-label">שם משתמש</label><input class="input" id="auth-username" type="text" placeholder="הזן שם משתמש" autocomplete="username"></div>
    <div class="input-group"><label class="input-label">סיסמה</label><input class="input" id="auth-password" type="password" placeholder="הזן סיסמה" autocomplete="current-password"></div>
    <div class="error-msg" id="auth-error"></div>
    <div class="mt-12"><button class="btn btn-primary btn-full" id="auth-btn" onclick="handleAuth()">התחבר</button></div>
  </div>
</div>

<!-- APP -->
<div id="app" style="display:none">
  <!-- Portfolio Tab -->
  <div id="screen-portfolio" class="screen active">
    <div class="screen-header">
      <div class="screen-title" id="portfolio-title">הפורטפוליו שלי</div>
      <div class="total-badge" id="portfolio-total">טוען...</div>
    </div>
    <div id="holdings-list"></div>
    <div class="mt-12"><button class="btn btn-secondary btn-full" onclick="openAddModal()">+ הוסף מניות</button></div>
  </div>

  <!-- Notifications Tab -->
  <div id="screen-notifications" class="screen">
    <div class="screen-header">
      <div class="screen-title">התראות</div>
    </div>
    <div id="notifications-list"></div>
  </div>

  <!-- Settings Tab -->
  <div id="screen-settings" class="screen">
    <div class="screen-header"><div class="screen-title">הגדרות</div></div>
    <div id="settings-content"></div>
  </div>

  <!-- Tab Bar -->
  <nav class="tab-bar">
    <div class="tab active" id="tab-portfolio" onclick="switchTab('portfolio')">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>
      <span class="tab-label" data-i18n="tab_portfolio">תיק</span>
      <div class="tab-dot"></div>
    </div>
    <div class="tab" id="tab-notifications" onclick="switchTab('notifications')">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
      <span class="tab-label" data-i18n="tab_notifications">התראות</span>
      <div class="tab-dot"></div>
    </div>
    <div class="tab" id="tab-settings" onclick="switchTab('settings')">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      <span class="tab-label" data-i18n="tab_settings">הגדרות</span>
      <div class="tab-dot"></div>
    </div>
  </nav>
</div>

<!-- Analysis Bottom Sheet -->
<div class="sheet-overlay" id="analysis-sheet">
  <div class="sheet" id="analysis-sheet-content"></div>
</div>

<!-- Add Holdings Modal -->
<div class="modal-overlay" id="add-modal">
  <div class="modal">
    <div class="modal-title" data-i18n="add_stocks">הוסף מניות</div>
    <div class="segment-options" style="margin-bottom:18px">
      <div class="seg-btn active" id="seg-screenshot" onclick="switchAddMode('screenshot')" data-i18n="upload_screenshot">העלאת צילום מסך</div>
      <div class="seg-btn" id="seg-manual" onclick="switchAddMode('manual')" data-i18n="manual_entry">הזנה ידנית</div>
    </div>
    <div id="add-screenshot-mode">
      <input type="file" id="screenshot-file" accept="image/*" style="display:none" onchange="handleScreenshotUpload(this)">
      <button class="btn btn-secondary btn-full" onclick="document.getElementById('screenshot-file').click()">בחר תמונה</button>
      <div id="screenshot-preview" style="margin-top:12px"></div>
    </div>
    <div id="add-manual-mode" style="display:none">
      <div class="input-group"><label class="input-label">טיקר (למשל AAPL, TEVA)</label><input class="input" id="manual-ticker" type="text" placeholder="AAPL" style="text-transform:uppercase"></div>
      <div class="input-group"><label class="input-label">בורסה</label>
        <div class="segment-options"><div class="seg-btn active" id="ex-us" onclick="selectExchange('US')">US</div><div class="seg-btn" id="ex-tase" onclick="selectExchange('TASE')">TASE</div></div>
      </div>
      <div class="input-group"><label class="input-label">כמות מניות</label><input class="input" id="manual-quantity" type="number" placeholder="10"></div>
      <div class="input-group"><label class="input-label">מחיר כניסה ממוצע (אופציונלי)</label><input class="input" id="manual-cost" type="number" step="0.01" placeholder="150.00"></div>
    </div>
    <div class="error-msg" id="add-error"></div>
    <div class="modal-actions">
      <button class="btn btn-secondary" style="flex:1" onclick="closeModal('add-modal')">ביטול</button>
      <button class="btn btn-primary" style="flex:1" id="add-confirm-btn" onclick="confirmAddHolding()">הוסף</button>
    </div>
  </div>
</div>

<script>
// ─── i18n ───────────────────────────────────────────────────────────────────
const T = {
  he: {
    tab_portfolio: 'תיק', tab_notifications: 'התראות', tab_settings: 'הגדרות',
    add_stocks: 'הוסף מניות', upload_screenshot: 'העלאת צילום מסך', manual_entry: 'הזנה ידנית',
    settings_language: 'שפה', settings_alert_level: 'רמת התראות', settings_push: 'התראות Push',
    settings_password: 'שינוי סיסמה', settings_logout: 'התנתקות',
    level_low: 'נמוך', level_mid: 'בינוני', level_high: 'גבוה',
    no_holdings: 'אין מניות בתיק', no_holdings_sub: 'לחץ על "הוסף מניות" כדי להתחיל',
    no_notifications: 'אין חדשות מעניינות כרגע', refresh_analysis: 'רענן ניתוח',
    financial_metrics: 'מדדים פיננסיים', ai_analysis: 'ניתוח AI',
    bear_case: 'למה אני טועה?', ecosystem: 'Ecosystem Mapping',
    earnings_call: 'שיחת רווחים', management_evasion: 'הנהלה נמנעה'
  },
  en: {
    tab_portfolio: 'Portfolio', tab_notifications: 'Alerts', tab_settings: 'Settings',
    add_stocks: 'Add Stocks', upload_screenshot: 'Upload Screenshot', manual_entry: 'Manual Entry',
    settings_language: 'Language', settings_alert_level: 'Alert Level', settings_push: 'Push Notifications',
    settings_password: 'Change Password', settings_logout: 'Log Out',
    level_low: 'Low', level_mid: 'Medium', level_high: 'High',
    no_holdings: 'No holdings yet', no_holdings_sub: 'Tap "Add Stocks" to get started',
    no_notifications: 'No relevant news right now', refresh_analysis: 'Refresh Analysis',
    financial_metrics: 'Financial Metrics', ai_analysis: 'AI Analysis',
    bear_case: 'Why Am I Wrong?', ecosystem: 'Ecosystem Mapping',
    earnings_call: 'Earnings Call', management_evasion: 'Management was evasive'
  }
}
let lang = 'he'
function t(key) { return T[lang][key] || T.he[key] || key }
function applyLang(l) {
  lang = l
  document.documentElement.lang = l
  document.documentElement.dir = l === 'he' ? 'rtl' : 'ltr'
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n) })
}

// ─── State ───────────────────────────────────────────────────────────────────
let token = localStorage.getItem('token')
let currentTab = 'portfolio'
let addMode = 'screenshot'
let addExchange = 'US'
let pendingHoldings = [] // from screenshot parse, awaiting confirm
let profile = { language: 'he', alert_level: 2 }

// ─── API ─────────────────────────────────────────────────────────────────────
async function api(method, path, body, isForm = false) {
  const opts = { method, headers: { 'Authorization': `Bearer ${token}` } }
  if (body && !isForm) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body) }
  if (isForm) opts.body = body
  const res = await fetch(path, opts)
  const data = await res.json()
  if (res.status === 401) { logout(); return null }
  return data
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
let authMode = 'login'
function switchAuthTab(mode) {
  authMode = mode
  document.querySelectorAll('.auth-tab').forEach((t,i) => t.classList.toggle('active', (i===0&&mode==='login')||(i===1&&mode==='register')))
  document.getElementById('auth-btn').textContent = mode === 'login' ? 'התחבר' : 'הרשמה'
  document.getElementById('auth-error').textContent = ''
}
async function handleAuth() {
  const username = document.getElementById('auth-username').value.trim()
  const password = document.getElementById('auth-password').value
  if (!username || !password) { document.getElementById('auth-error').textContent = 'יש למלא את כל השדות'; return }
  const btn = document.getElementById('auth-btn')
  btn.innerHTML = '<span class="spinner"></span>'
  const data = await fetch(`/auth/${authMode}`, {
    method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ username, password })
  }).then(r=>r.json())
  btn.textContent = authMode === 'login' ? 'התחבר' : 'הרשמה'
  if (data.token) { token = data.token; localStorage.setItem('token', token); initApp() }
  else document.getElementById('auth-error').textContent = data.error || 'שגיאה'
}
function logout() {
  token = null; localStorage.removeItem('token')
  document.getElementById('app').style.display = 'none'
  document.getElementById('auth-wrapper').classList.add('active')
}

// ─── Init ─────────────────────────────────────────────────────────────────────
async function initApp() {
  document.getElementById('auth-wrapper').classList.remove('active')
  document.getElementById('app').style.display = 'flex'
  profile = await api('GET', '/api/profile') || profile
  applyLang(profile.language || 'he')
  registerServiceWorker()
  loadPortfolio()
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
  try {
    const reg = await navigator.serviceWorker.register('/sw.js')
    window._swReg = reg
  } catch (e) { console.error('SW register failed', e) }
}

window.addEventListener('DOMContentLoaded', () => {
  if (token) initApp()
  else { document.getElementById('auth-wrapper').classList.add('active') }
})

// ─── Tab Navigation ───────────────────────────────────────────────────────────
function switchTab(tab) {
  currentTab = tab
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'))
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
  document.getElementById(`screen-${tab}`).classList.add('active')
  document.getElementById(`tab-${tab}`).classList.add('active')
  if (tab === 'notifications') loadNotifications()
  if (tab === 'settings') renderSettings()
}

// ─── Portfolio ────────────────────────────────────────────────────────────────
async function loadPortfolio() {
  const data = await api('GET', '/api/portfolio')
  if (!data) return
  renderHoldings(data.holdings)
}

function renderHoldings(holdings) {
  const list = document.getElementById('holdings-list')
  if (!holdings.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-title">${t('no_holdings')}</div><div class="empty-sub">${t('no_holdings_sub')}</div></div>`
    document.getElementById('portfolio-total').textContent = '₪ 0'
    return
  }
  list.innerHTML = holdings.map(h => {
    const a = h.analysis_json || {}
    const sd = a.stock_data || {}
    const tags = a.tags || {}
    const pct = sd.change_pct ? parseFloat(sd.change_pct) : null
    const changeClass = pct > 0 ? 'change-up' : pct < 0 ? 'change-down' : 'change-neutral'
    const changeStr = pct !== null ? `${pct > 0 ? '+' : ''}${pct}%` : (h.analyzed_at ? '—' : 'ללא ניתוח')
    const currency = sd.currency === 'ILS' ? '₪' : '$'
    const price = sd.price ? `${currency}${parseFloat(sd.price).toLocaleString()}` : '—'
    const moatTag = tags.moat ? `<span class="tag ${tags.moat.includes('רחב') ? 'tag-teal' : tags.moat.includes('צר') ? 'tag-yellow' : 'tag-red'}">${tags.moat}</span>` : ''
    const valTag = tags.valuation ? `<span class="tag ${tags.valuation === 'זול' ? 'tag-green' : tags.valuation === 'יקר' ? 'tag-red' : 'tag-yellow'}">${tags.valuation}</span>` : ''
    const riskTag = tags.risk ? `<span class="tag ${tags.risk === 'נמוך' ? 'tag-teal' : tags.risk === 'גבוה' ? 'tag-red' : 'tag-yellow'}">${tags.risk} סיכון</span>` : ''
    const notAnalyzed = !h.analyzed_at ? '<span class="tag tag-yellow">ללא ניתוח — לחץ לניתוח</span>' : ''
    return `<div class="card" onclick="openAnalysis('${h.ticker}', '${h.exchange}')">
      <div class="card-row">
        <div><span class="ticker">${h.ticker}</span><span class="exchange-badge">${h.exchange === 'TASE' ? 'TASE' : 'NASDAQ/NYSE'}</span></div>
        <span class="${changeClass}">${changeStr}</span>
      </div>
      <div class="card-sub">${price} · ${h.quantity} מניות${h.avg_cost ? ` · עלות ממוצעת: ${currency}${h.avg_cost}` : ''}</div>
      <div class="tags">${moatTag}${valTag}${riskTag}${notAnalyzed}</div>
    </div>`
  }).join('')
}

// ─── Analysis Sheet ───────────────────────────────────────────────────────────
async function openAnalysis(ticker, exchange) {
  const sheet = document.getElementById('analysis-sheet')
  const content = document.getElementById('analysis-sheet-content')
  sheet.classList.add('open')

  const data = await api('GET', '/api/portfolio')
  const holding = data?.holdings?.find(h => h.ticker === ticker)
  if (!holding) return

  const a = holding.analysis_json
  if (!a) {
    content.innerHTML = `<div class="sheet-handle"></div>
      <div style="text-align:center;padding:24px">
        <div style="margin-bottom:12px;font-size:14px;color:var(--text-muted)">אין ניתוח עדיין</div>
        <button class="btn btn-primary" onclick="runAnalysis('${ticker}','${exchange}')">${t('refresh_analysis')}</button>
      </div>
      <button class="sheet-close" style="position:absolute;top:12px;left:12px" onclick="closeSheet()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>`
    return
  }

  const sd = a.stock_data || {}
  const currency = sd.currency === 'ILS' ? '₪' : '$'
  const pct = sd.change_pct ? parseFloat(sd.change_pct) : 0
  const ecoItems = (a.ecosystem || []).map(e => `<div class="eco-item"><span class="eco-ticker">${e.ticker}</span> — ${e.impact}</div>`).join('') || '<div class="eco-item" style="color:var(--text-muted)">לא נמצאו קשרים רלוונטיים</div>'

  content.innerHTML = `<div class="sheet-handle"></div>
    <div style="position:relative">
      <button class="sheet-close" style="position:absolute;top:0;left:0" onclick="closeSheet()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      <div class="sheet-header">
        <div><div class="sheet-ticker">${ticker}</div><div class="sheet-exchange">${sd.short_name || ''} · ${exchange}</div></div>
        <div class="sheet-price">
          <div class="sheet-price-val">${sd.price ? `${currency}${parseFloat(sd.price).toLocaleString()}` : '—'}</div>
          <div class="${pct>=0?'change-up':'change-down'}">${pct>=0?'▲':'▼'} ${Math.abs(pct)}% היום</div>
        </div>
      </div>
    </div>
    <div class="sheet-section">
      <div class="sheet-section-title">${t('financial_metrics')}</div>
      <div class="metrics-grid">
        <div class="metric-box"><div class="metric-val">${sd.pe_ratio ? parseFloat(sd.pe_ratio).toFixed(1) : '—'}</div><div class="metric-key">P/E</div></div>
        <div class="metric-box"><div class="metric-val">${sd.eps ? `${currency}${parseFloat(sd.eps).toFixed(2)}` : '—'}</div><div class="metric-key">EPS</div></div>
        <div class="metric-box"><div class="metric-val">${sd.week52_low ? `${currency}${parseFloat(sd.week52_low).toFixed(0)}` : '—'}</div><div class="metric-key">52W Low</div></div>
        <div class="metric-box"><div class="metric-val">${sd.week52_high ? `${currency}${parseFloat(sd.week52_high).toFixed(0)}` : '—'}</div><div class="metric-key">52W High</div></div>
        <div class="metric-box"><div class="metric-val">${sd.market_cap ? (sd.market_cap/1e9).toFixed(0)+'B' : '—'}</div><div class="metric-key">Market Cap</div></div>
        <div class="metric-box"><div class="metric-val" style="font-size:10px">${sd.sector || '—'}</div><div class="metric-key">Sector</div></div>
      </div>
    </div>
    <div class="sheet-section">
      <div class="sheet-section-title">${t('ai_analysis')}</div>
      <div class="analysis-box">${a.valuation_note || ''}<br><br>${a.moat_note || ''}<br><br>${a.management || ''}<br><br>${a.outlook || ''}</div>
    </div>
    <div class="sheet-section">
      <div class="sheet-section-title">${t('bear_case')}</div>
      <div class="bear-box">${a.bear_case || '—'}</div>
    </div>
    <div class="sheet-section">
      <div class="sheet-section-title">${t('ecosystem')}</div>
      ${ecoItems}
    </div>
    <button class="btn btn-secondary btn-full mt-12" onclick="runAnalysis('${ticker}','${exchange}')">
      <span id="refresh-label">${t('refresh_analysis')}</span>
    </button>`
}

async function runAnalysis(ticker, exchange) {
  const btn = document.getElementById('refresh-label')
  if (btn) btn.innerHTML = '<span class="spinner"></span>'
  await api('POST', `/api/analyze/${ticker}`, { exchange })
  closeSheet()
  loadPortfolio()
}

function closeSheet() { document.getElementById('analysis-sheet').classList.remove('open') }
document.getElementById('analysis-sheet').addEventListener('click', e => { if (e.target === document.getElementById('analysis-sheet')) closeSheet() })

// ─── Add Modal ────────────────────────────────────────────────────────────────
function openAddModal() { document.getElementById('add-modal').classList.add('open') }
function closeModal(id) { document.getElementById(id).classList.remove('open'); pendingHoldings = []; document.getElementById('screenshot-preview').innerHTML = '' }
document.getElementById('add-modal').addEventListener('click', e => { if (e.target === document.getElementById('add-modal')) closeModal('add-modal') })

function switchAddMode(mode) {
  addMode = mode
  document.getElementById('seg-screenshot').classList.toggle('active', mode === 'screenshot')
  document.getElementById('seg-manual').classList.toggle('active', mode === 'manual')
  document.getElementById('add-screenshot-mode').style.display = mode === 'screenshot' ? '' : 'none'
  document.getElementById('add-manual-mode').style.display = mode === 'manual' ? '' : 'none'
}

function selectExchange(ex) {
  addExchange = ex
  document.getElementById('ex-us').classList.toggle('active', ex === 'US')
  document.getElementById('ex-tase').classList.toggle('active', ex === 'TASE')
}

async function handleScreenshotUpload(input) {
  if (!input.files[0]) return
  const preview = document.getElementById('screenshot-preview')
  preview.innerHTML = '<span class="spinner"></span> מנתח צילום מסך...'
  const form = new FormData()
  form.append('screenshot', input.files[0])
  const data = await api('POST', '/api/portfolio/screenshot', form, true)
  if (!data || !data.holdings) { preview.innerHTML = `<div class="error-msg">${data?.error || 'שגיאה בניתוח'}</div>`; return }
  pendingHoldings = data.holdings
  preview.innerHTML = `<div style="margin-top:8px;font-size:13px;color:var(--accent)">זוהו ${data.holdings.length} מניות:</div>` +
    data.holdings.map(h => `<div style="font-size:12px;color:var(--text-muted);margin-top:4px">${h.ticker} (${h.exchange}) × ${h.quantity || '?'}</div>`).join('')
}

async function confirmAddHolding() {
  document.getElementById('add-error').textContent = ''
  let holdings = []
  if (addMode === 'screenshot') {
    if (!pendingHoldings.length) { document.getElementById('add-error').textContent = 'יש להעלות צילום מסך תחילה'; return }
    holdings = pendingHoldings
  } else {
    const ticker = document.getElementById('manual-ticker').value.trim().toUpperCase()
    const quantity = parseFloat(document.getElementById('manual-quantity').value)
    const avg_cost = parseFloat(document.getElementById('manual-cost').value) || null
    if (!ticker || !quantity) { document.getElementById('add-error').textContent = 'יש למלא טיקר וכמות'; return }
    holdings = [{ ticker, exchange: addExchange, quantity, avg_cost }]
  }
  const btn = document.getElementById('add-confirm-btn')
  btn.innerHTML = '<span class="spinner"></span>'
  await api('POST', '/api/portfolio/holdings', holdings)
  btn.textContent = 'הוסף'
  closeModal('add-modal')
  loadPortfolio()
}

// ─── Notifications ────────────────────────────────────────────────────────────
async function loadNotifications() {
  const data = await api('GET', '/api/notifications')
  const list = document.getElementById('notifications-list')
  const notifs = data?.notifications || []
  if (!notifs.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-title">${t('no_notifications')}</div></div>`
    return
  }
  const categoryColors = { 'רווחים': 'tag-teal', 'הנהלה': 'tag-yellow', 'תביעה': 'tag-red', 'שינוי המלצה': 'tag-orange', 'שרשרת אספקה': 'tag-purple', 'כללי': 'tag-yellow' }
  list.innerHTML = notifs.map(n => {
    const bullets = n.earnings_bullets ? `<ul class="earnings-bullets">${JSON.parse(n.earnings_bullets).map(b=>`<li>${b}</li>`).join('')}</ul>` : ''
    const evasion = n.evasion_warning ? `<div class="evasion-warning">⚠ ${n.evasion_warning}</div>` : ''
    const catClass = categoryColors[n.category] || 'tag-yellow'
    const time = new Date(n.sent_at).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    return `<div class="notif-item">
      <div class="notif-header"><div class="notif-ticker">${n.ticker}</div><div class="notif-time">${time}</div></div>
      <div class="notif-headline">${n.headline}</div>
      ${n.summary ? `<div class="notif-summary">${n.summary}</div>` : ''}
      ${bullets}${evasion}
      <div class="tags"><span class="tag ${catClass}">${n.category || 'כללי'}</span></div>
    </div>`
  }).join('')
}

// ─── Settings ─────────────────────────────────────────────────────────────────
function renderSettings() {
  const c = document.getElementById('settings-content')
  c.innerHTML = `
    <div class="settings-section">
      <div class="settings-label">${t('settings_language')}</div>
      <div class="segment-options">
        <div class="seg-btn ${lang==='he'?'active':''}" onclick="setLanguage('he')">עברית</div>
        <div class="seg-btn ${lang==='en'?'active':''}" onclick="setLanguage('en')">English</div>
      </div>
    </div>
    <div class="settings-section">
      <div class="settings-label">${t('settings_alert_level')}</div>
      <div class="level-btns">
        <div class="level-btn ${profile.alert_level===1?'active':''}" onclick="setAlertLevel(1)">${t('level_low')}</div>
        <div class="level-btn ${profile.alert_level===2?'active':''}" onclick="setAlertLevel(2)">${t('level_mid')}</div>
        <div class="level-btn ${profile.alert_level===3?'active':''}" onclick="setAlertLevel(3)">${t('level_high')}</div>
      </div>
    </div>
    <div class="settings-section">
      <div class="settings-label">${t('settings_push')}</div>
      <div class="settings-row">
        <span class="settings-row-label">${t('settings_push')}</span>
        <label class="toggle"><input type="checkbox" id="push-toggle" ${window._pushEnabled?'checked':''} onchange="togglePush(this.checked)"><span class="toggle-slider"></span></label>
      </div>
    </div>
    <div class="settings-section">
      <div class="settings-label">${t('settings_password')}</div>
      <div class="input-group"><input class="input" id="cur-pass" type="password" placeholder="סיסמה נוכחית"></div>
      <div class="input-group"><input class="input" id="new-pass" type="password" placeholder="סיסמה חדשה"></div>
      <button class="btn btn-secondary btn-full mt-12" onclick="changePassword()">${t('settings_password')}</button>
    </div>
    <div class="divider"></div>
    <button class="btn btn-danger btn-full" onclick="logout()">${t('settings_logout')}</button>
  `
}

async function setLanguage(l) {
  applyLang(l)
  profile.language = l
  await api('PUT', '/api/profile', { language: l })
  renderSettings()
}

async function setAlertLevel(level) {
  profile.alert_level = level
  await api('PUT', '/api/profile', { alert_level: level })
  renderSettings()
}

async function togglePush(enabled) {
  if (!window._swReg) { alert('Service Worker לא נתמך בדפדפן זה'); return }
  if (enabled) {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') { document.getElementById('push-toggle').checked = false; return }
    const vapidRes = await api('GET', '/api/push/vapid-key')
    const sub = await window._swReg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidRes.public_key)
    })
    await api('POST', '/api/push/subscribe', { subscription: sub.toJSON() })
    window._pushEnabled = true
  } else {
    const sub = await window._swReg.pushManager.getSubscription()
    if (sub) { await sub.unsubscribe(); await api('DELETE', '/api/push/subscribe', { endpoint: sub.endpoint }) }
    window._pushEnabled = false
  }
}

async function changePassword() {
  const cur = document.getElementById('cur-pass').value
  const newp = document.getElementById('new-pass').value
  if (!cur || !newp) return
  const res = await api('POST', '/auth/change-password', { current_password: cur, new_password: newp })
  alert(res?.ok ? 'הסיסמה שונתה בהצלחה' : (res?.error || 'שגיאה'))
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}
</script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add portfolio-ai/public/index.html
git commit -m "feat: complete single-file SPA with all screens, tabs, analysis sheet, i18n"
```

---

## Task 12: PWA Manifest + Icons

**Files:**
- Create: `portfolio-ai/public/manifest.json`
- Modify: `portfolio-ai/server.js` — generate icons on startup

- [ ] **Step 1: Create manifest.json**

`portfolio-ai/public/manifest.json`:
```json
{
  "name": "Portfolio AI",
  "short_name": "Portfolio AI",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f2027",
  "theme_color": "#0f2027",
  "lang": "he",
  "dir": "rtl",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 2: Add icon generation to server.js**

Add this function after `initDB`:
```js
async function generateIcons() {
  try {
    const { createCanvas } = require('@napi-rs/canvas')
    for (const size of [192, 512]) {
      const p = path.join(__dirname, 'public', `icon-${size}.png`)
      if (fs.existsSync(p)) continue
      const canvas = createCanvas(size, size)
      const ctx = canvas.getContext('2d')
      const grad = ctx.createLinearGradient(0, 0, size, size)
      grad.addColorStop(0, '#0f2027')
      grad.addColorStop(1, '#2c5364')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.roundRect(0, 0, size, size, size * 0.22)
      ctx.fill()
      ctx.fillStyle = '#64ffda'
      ctx.font = `bold ${size * 0.45}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('₪', size / 2, size / 2)
      fs.writeFileSync(p, canvas.toBuffer('image/png'))
    }
    console.log('Icons generated')
  } catch (e) {
    console.warn('Icon generation skipped (install @napi-rs/canvas for icons):', e.message)
  }
}
```

Update the startup block to call `generateIcons()`:
```js
if (require.main === module) {
  initDB().then(() => generateIcons()).then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`)
      startPolling()
    })
  }).catch(err => { console.error('Startup failed', err); process.exit(1) })
}
```

Optionally add `@napi-rs/canvas` to package.json dependencies (same version as food-logger: `"@napi-rs/canvas": "0.1.68"`), then:
```bash
cd portfolio-ai && npm install @napi-rs/canvas@0.1.68
```

- [ ] **Step 3: Commit**

```bash
git add portfolio-ai/
git commit -m "feat: PWA manifest and icon generation"
```

---

## Task 13: Self-Review + End-to-End Verification

- [ ] **Step 1: Run full test suite**

```bash
cd portfolio-ai && npm test
```

Expected: all tests PASS.

- [ ] **Step 2: Start dev server and run through verification checklist**

```bash
cd portfolio-ai && npm run dev
```

Open `http://localhost:3000` and verify:

- [ ] Register new user → auto-login → portfolio screen shows
- [ ] Add AAPL manually (US, 10 shares) → card appears in list
- [ ] Tap AAPL card → "no analysis yet" sheet with Refresh button
- [ ] Click Refresh → wait ~5s → sheet shows full analysis with bear case
- [ ] Tags appear on card (חפיר, תמחור, סיכון)
- [ ] Upload a brokerage screenshot → holdings preview shown → confirm → cards appear
- [ ] Switch to Settings → change language to English → UI switches to LTR
- [ ] Switch alert level to Low → saved to profile
- [ ] Enable push → browser permission prompt appears
- [ ] Switch to Notifications tab → empty state shown
- [ ] Change password → success message

- [ ] **Step 3: Deploy to Railway**

```bash
# In Railway dashboard: create new project, add PostgreSQL, copy DATABASE_URL
# Set all env vars: ANTHROPIC_API_KEY, JWT_SECRET, NEWS_API_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL, ORIGIN
# Then:
railway login && railway up
```

Expected: app live at Railway URL, all features work with HTTPS (required for push notifications and Service Worker).

- [ ] **Step 4: Test push notifications end-to-end**

- Enable push on deployed site
- Add a ticker that has active news (e.g. AAPL, NVDA)
- Modify poll interval temporarily to 1 minute for testing: `setInterval(pollNews, 60 * 1000)`
- Wait 60 seconds → verify push notification arrives on device
- Check Notifications tab → article should appear

- [ ] **Step 5: Final commit**

```bash
git add portfolio-ai/
git commit -m "feat: Portfolio AI PWA complete — auth, portfolio, AI analysis, push notifications"
```

---

## Environment Setup Reference

```bash
# Generate VAPID keys (run once):
cd portfolio-ai && npm run generate-vapid
# Paste output into .env as VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY

# Get a free NewsAPI key:
# https://newsapi.org/register — free tier: 100 requests/day

# Railway setup:
# 1. railway.app → New Project → Deploy from GitHub
# 2. Add PostgreSQL plugin → DATABASE_URL auto-set
# 3. Set env vars in Railway dashboard
# 4. ORIGIN = https://your-app.railway.app
```
