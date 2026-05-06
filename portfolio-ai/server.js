require('dotenv').config()
const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { Pool } = require('pg')
const cors = require('cors')
const rateLimit = require('express-rate-limit')
const Anthropic = require('@anthropic-ai/sdk')
let _yf = null
async function getYF() {
  if (!_yf) {
    try {
      // eslint-disable-next-line
      _yf = require('yahoo-finance2').default || require('yahoo-finance2')
    } catch {
      const m = await import('yahoo-finance2')
      _yf = m.default || m
    }
  }
  return _yf
}
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

const isTest = process.env.NODE_ENV === 'test'
const noopLimiter = (req, res, next) => next()
const authLimiter = isTest ? noopLimiter : rateLimit({ windowMs: 60 * 1000, max: 10 })
const analyzeLimiter = isTest ? noopLimiter : rateLimit({ windowMs: 60 * 60 * 1000, max: 20 })
const screenshotLimiter = isTest ? noopLimiter : rateLimit({ windowMs: 60 * 60 * 1000, max: 10 })

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
  // Try parsing whole text first (Claude often returns clean JSON)
  try { return JSON.parse(text.trim()) } catch {}
  // Find largest object or array match; prefer whichever starts earlier
  const arr = text.match(/\[[\s\S]*\]/)
  const obj = text.match(/\{[\s\S]*\}/)
  const arrIdx = arr ? text.indexOf(arr[0]) : Infinity
  const objIdx = obj ? text.indexOf(obj[0]) : Infinity
  if (objIdx <= arrIdx) {
    try { if (obj) return JSON.parse(obj[0]) } catch {}
    try { if (arr) return JSON.parse(arr[0]) } catch {}
  } else {
    try { if (arr) return JSON.parse(arr[0]) } catch {}
    try { if (obj) return JSON.parse(obj[0]) } catch {}
  }
  return null
}

app.use(cors({ origin: process.env.ORIGIN || 'http://localhost:3000', credentials: true }))
app.use(express.json({ limit: '15mb' }))
app.use(express.static(path.join(__dirname, 'public')))

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
  const dummy = '$2a$12$LCzBTPkFrFx3HUmW/aNh2.ZqNb2e8nCOSBNrOmzZMN2JZvVoSPy8y'
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

async function getUserPortfolioId(userId) {
  const { rows } = await pool.query('SELECT id FROM portfolios WHERE user_id = $1', [userId])
  return rows[0]?.id
}

app.get('/api/portfolio', auth, async (req, res) => {
  try {
    const portfolioId = await getUserPortfolioId(req.user.id)
    if (!portfolioId) return res.json({ holdings: [] })
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

async function fetchStockData(ticker, exchange) {
  const symbol = exchange === 'TASE' ? `${ticker}.TA` : ticker
  try {
    const yf = await getYF()
    const [quote, summary] = await Promise.all([
      yf.quote(symbol),
      yf.quoteSummary(symbol, { modules: ['summaryDetail', 'defaultKeyStatistics', 'assetProfile'] }).catch(() => null)
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
  "bear_case": "2-3 sentences arguing why this analysis could be wrong",
  "tags": {
    "moat": "חפיר רחב|חפיר צר|ללא חפיר",
    "valuation": "יקר|הוגן|זול",
    "risk": "גבוה|בינוני|נמוך"
  },
  "ecosystem": []
}

For ecosystem: if ${stockData.ticker} has a real supply-chain, revenue, or competitive relationship with any of [${allPortfolioTickers.join(', ')}], include { "ticker": "X", "impact": "one sentence" } for each. If none, return [].

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
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: `Extract all stock holdings from this brokerage screenshot.
Return a JSON array only: [{ "ticker": "AAPL", "exchange": "US", "quantity": 10, "avg_cost": 150.00 }]
For Israeli stocks traded on TASE, use exchange "TASE".
If avg_cost or quantity is unclear, omit the field (don't guess).
Respond ONLY with the JSON array.` }
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

app.get('/api/notifications', auth, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 100)
  const offset = parseInt(req.query.offset) || 0
  try {
    const { rows } = await pool.query(
      `SELECT * FROM news_notifications WHERE user_id = $1 ORDER BY sent_at DESC LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    )
    res.json({ notifications: rows })
  } catch {
    res.json({ notifications: [] })
  }
})

app.get('/api/push/vapid-key', (req, res) => {
  res.json({ public_key: process.env.VAPID_PUBLIC_KEY || '' })
})

app.post('/api/push/subscribe', auth, async (req, res) => {
  const { subscription } = req.body
  if (!subscription?.endpoint) return res.status(400).json({ error: 'subscription לא תקין' })
  try {
    await pool.query(
      `INSERT INTO push_subscriptions (user_id, subscription_json) VALUES ($1, $2)`,
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
  const { rows } = await pool.query('SELECT id, subscription_json FROM push_subscriptions WHERE user_id = $1', [userId])
  for (const row of rows) {
    try {
      await webpush.sendNotification(row.subscription_json, JSON.stringify(payload))
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await pool.query(`DELETE FROM push_subscriptions WHERE id = $1`, [row.id])
      }
    }
  }
}

async function filterNewsWithClaude(ticker, articleTitle, articleContent, alertLevel) {
  try {
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
{ "notify": true, "category": "רווחים|הנהלה|תביעה|שינוי המלצה|שרשרת אספקה|כללי", "summary": "two Hebrew sentences", "is_earnings": false }`
      }]
    })
    return extractJson(message.content[0].text)
  } catch (err) {
    console.error('filterNewsWithClaude error:', err.message)
    return null
  }
}

async function summarizeEarningsCall(articleText) {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: [{ type: 'text', text: 'You are a skeptical financial analyst. Respond with valid JSON only.', cache_control: { type: 'ephemeral' } }],
      messages: [{
        role: 'user',
        content: `Summarize this earnings call article in exactly 5 Hebrew bullet points for a skeptical investor.
Flag if management seemed evasive on: growth, margins, competition, or guidance.

Article: ${articleText.slice(0, 3000)}

Return JSON: { "bullets": ["bullet1", "bullet2", "bullet3", "bullet4", "bullet5"], "evasion_warning": null }`
      }]
    })
    return extractJson(message.content[0].text)
  } catch (err) {
    console.error('summarizeEarningsCall error:', err.message)
    return null
  }
}

async function pollNews() {
  if (!process.env.NEWS_API_KEY) return
  try {
    const { rows: usersWithSubs } = await pool.query(
      `SELECT DISTINCT ps.user_id, COALESCE(up.profile_json->>'alert_level', '2') as alert_level
       FROM push_subscriptions ps
       LEFT JOIN user_profiles up ON up.user_id = ps.user_id`
    )

    for (const userRow of usersWithSubs) {
      const alertLevel = parseInt(userRow.alert_level) || 2
      const portfolioId = await getUserPortfolioId(userRow.user_id)
      if (!portfolioId) continue

      const { rows: holdings } = await pool.query(
        'SELECT ticker, exchange FROM holdings WHERE portfolio_id = $1', [portfolioId]
      )
      if (!holdings.length) continue

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
              [userRow.user_id, holding.ticker, article.title, filter.summary, filter.category, article.url,
               earningsBullets ? JSON.stringify(earningsBullets) : null, evasionWarning]
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
      if (ctx.roundRect) {
        ctx.roundRect(0, 0, size, size, size * 0.22)
      } else {
        ctx.rect(0, 0, size, size)
      }
      ctx.fill()
      ctx.fillStyle = '#64ffda'
      ctx.font = `bold ${Math.floor(size * 0.45)}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('₪', size / 2, size / 2)
      fs.writeFileSync(p, canvas.toBuffer('image/png'))
    }
    console.log('Icons generated')
  } catch (e) {
    console.warn('Icon generation skipped:', e.message)
  }
}

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

    CREATE INDEX IF NOT EXISTS idx_holdings_portfolio ON holdings(portfolio_id);
    CREATE INDEX IF NOT EXISTS idx_news_seen_user ON news_seen(user_id);
    CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);
    CREATE INDEX IF NOT EXISTS idx_notif_user ON news_notifications(user_id, sent_at DESC);
  `)
  console.log('DB initialized')
}

module.exports = app
module.exports.fetchStockData = fetchStockData
module.exports.pollNews = pollNews

if (require.main === module) {
  initDB().then(() => generateIcons()).then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`)
      startPolling()
    })
  }).catch(err => { console.error('Startup failed', err); process.exit(1) })
}
