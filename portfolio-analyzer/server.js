require('dotenv').config()
const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { Pool } = require('pg')
const cors = require('cors')
const rateLimit = require('express-rate-limit')
const Anthropic = require('@anthropic-ai/sdk')
const YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9'
}
let _yfCookie = ''
let _yfCrumb = ''

async function refreshYFAuth() {
  if (process.env.NODE_ENV === 'test') return
  const ua = YF_HEADERS['User-Agent']

  const tryGetCrumb = async (cookie) => {
    for (const base of ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com']) {
      try {
        const r = await axios.get(`${base}/v1/test/getcrumb`, {
          headers: { 'User-Agent': ua, 'Accept': 'text/plain, */*', ...(cookie ? { Cookie: cookie } : {}) },
          timeout: 5000
        })
        const val = typeof r.data === 'string' ? r.data.trim() : ''
        if (val && val.length < 50 && !val.startsWith('<')) return val
      } catch {}
    }
    return null
  }

  // Strategy 1: try with existing cookie (or no cookie on first run)
  const c0 = await tryGetCrumb(_yfCookie)
  if (c0) { _yfCrumb = c0; console.log('YF crumb ok'); return }

  // Strategy 2: bootstrap cookie from fc.yahoo.com (lightweight consent endpoint, no HTML overflow)
  try {
    const r = await axios.get('https://fc.yahoo.com', {
      headers: { 'User-Agent': ua, 'Accept': '*/*', 'Accept-Language': 'en-US,en;q=0.9' },
      timeout: 5000, maxRedirects: 3
    })
    const c = (r.headers['set-cookie'] || []).map(s => s.split(';')[0]).join('; ')
    if (c) _yfCookie = c
  } catch {}
  const c1 = await tryGetCrumb(_yfCookie)
  if (c1) { _yfCrumb = c1; console.log('YF crumb via fc.yahoo.com'); return }

  // Strategy 3: bootstrap cookie from v8/chart (confirmed working from Railway)
  try {
    const r = await axios.get('https://query1.finance.yahoo.com/v8/finance/chart/AAPL', {
      params: { interval: '1d', range: '1d' }, headers: YF_HEADERS, timeout: 8000
    })
    const c = (r.headers['set-cookie'] || []).map(s => s.split(';')[0]).join('; ')
    if (c) _yfCookie = c
  } catch {}
  const c2 = await tryGetCrumb(_yfCookie)
  if (c2) { _yfCrumb = c2; console.log('YF crumb via chart bootstrap'); return }

  console.warn('YF crumb unavailable — PE/EPS/market cap will show as N/A')
}
const webpush = require('web-push')
const axios = require('axios')
const cheerio = require('cheerio')
const multer = require('multer')
const fs = require('fs')
const path = require('path')

const app = express()
app.set('trust proxy', 1) // Railway runs behind a reverse proxy
const PORT = process.env.PORT || 3000

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
})

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const vapidEmail = process.env.VAPID_EMAIL || 'mailto:admin@example.com'
webpush.setVapidDetails(
  vapidEmail.startsWith('mailto:') || vapidEmail.startsWith('https://') ? vapidEmail : `mailto:${vapidEmail}`,
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
  const validate = req.query.validate === 'true'
  if (!items.length) return res.status(400).json({ error: 'חסרים פרטי מניה' })
  try {
    const portfolioId = await getUserPortfolioId(req.user.id)
    if (!portfolioId) return res.status(400).json({ error: 'פורטפוליו לא נמצא' })
    for (const item of items) {
      const { ticker, exchange = 'US', quantity, avg_cost } = item
      if (!ticker || !quantity) continue
      if (validate) {
        const sd = await fetchStockData(ticker.toUpperCase(), exchange)
        if (sd.error || !sd.price) {
          return res.status(400).json({ error: `הטיקר "${ticker}" לא נמצא. בדוק שהסימול נכון (לדוגמה: AAPL, TEVA, ICL).` })
        }
      }
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

app.patch('/api/portfolio/holdings/:id', auth, async (req, res) => {
  try {
    const portfolioId = await getUserPortfolioId(req.user.id)
    const quantity = parseFloat(req.body.quantity)
    if (!quantity || quantity <= 0) return res.status(400).json({ error: 'כמות לא תקינה' })
    const result = await pool.query(
      'UPDATE holdings SET quantity = $1 WHERE id = $2 AND portfolio_id = $3',
      [quantity, req.params.id, portfolioId]
    )
    if (result.rowCount === 0) return res.status(404).json({ error: 'לא נמצא' })
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'שגיאת שרת' })
  }
})

async function fetchStockDataFinnhub(ticker) {
  const apiKey = process.env.FINNHUB_API_KEY
  try {
    const [quoteRes, profileRes, metricRes] = await Promise.all([
      axios.get('https://finnhub.io/api/v1/quote', { params: { symbol: ticker, token: apiKey }, timeout: 8000 }),
      axios.get('https://finnhub.io/api/v1/stock/profile2', { params: { symbol: ticker, token: apiKey }, timeout: 8000 }),
      axios.get('https://finnhub.io/api/v1/stock/metric', { params: { symbol: ticker, metric: 'all', token: apiKey }, timeout: 8000 })
    ])
    const q = quoteRes.data
    const p = profileRes.data
    const m = metricRes.data?.metric || {}
    if (!q?.c) return null
    return {
      ticker, symbol: ticker,
      price: q.c,
      change_pct: parseFloat((q.dp ?? 0).toFixed(2)),
      market_cap: p.marketCapitalization ? Math.round(p.marketCapitalization * 1e6) : null,
      pe_ratio: m.peBasicExclExtraTTM || null,
      eps: m.epsBasicExclExtraTTM || m.epsNormalizedAnnual || null,
      week52_high: m['52WeekHigh'] || null,
      week52_low: m['52WeekLow'] || null,
      sector: p.finnhubIndustry || 'N/A',
      industry: p.finnhubIndustry || 'N/A',
      short_name: p.name || ticker,
      currency: p.currency || 'USD',
      revenue_growth: m.revenueGrowthQuarterlyYoy != null ? parseFloat((m.revenueGrowthQuarterlyYoy * 100).toFixed(1)) : null,
      net_margin: m.netMarginTTM != null ? parseFloat((m.netMarginTTM * 100).toFixed(1)) : null
    }
  } catch (e) {
    console.warn(`Finnhub failed for ${ticker}:`, e.message)
    return null
  }
}

async function fetchStockData(ticker, exchange) {
  // Use Finnhub for non-TASE stocks when FINNHUB_API_KEY is set (bypasses Yahoo auth restrictions)
  if (process.env.FINNHUB_API_KEY && exchange !== 'TASE') {
    const data = await fetchStockDataFinnhub(ticker)
    if (data) return data
    console.warn(`Finnhub returned no data for ${ticker}, falling back to Yahoo`)
  }
  const symbol = exchange === 'TASE' ? `${ticker}.TA` : ticker
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const headers = { ...YF_HEADERS, ...(_yfCookie ? { Cookie: _yfCookie } : {}) }
      const crumbParam = _yfCrumb ? { crumb: _yfCrumb } : {}
      // v8/chart is more permissive on auth than v7/quote
      // search API requires no auth and returns sector/industry reliably
      const [chartRes, summaryRes, searchRes] = await Promise.all([
        axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`, {
          params: { interval: '1d', range: '1d', ...crumbParam }, headers, timeout: 12000
        }),
        axios.get(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}`, {
          params: { modules: 'summaryDetail,defaultKeyStatistics,price,assetProfile', ...crumbParam },
          headers, timeout: 8000
        }).catch(() => null),
        axios.get('https://query1.finance.yahoo.com/v1/finance/search', {
          params: { q: symbol, quotesCount: 1, newsCount: 0, enableFuzzyQuery: false },
          headers: YF_HEADERS, timeout: 5000
        }).catch(() => null)
      ])
      const meta = chartRes.data?.chart?.result?.[0]?.meta
      if (!meta?.regularMarketPrice) {
        return { ticker, symbol, price: null, error: `Ticker "${symbol}" not found on Yahoo Finance` }
      }
      const s = summaryRes?.data?.quoteSummary?.result?.[0] || {}
      const sq = searchRes?.data?.quotes?.find(q => q.symbol?.toUpperCase() === symbol.toUpperCase()) || {}
      const rawPrice = meta.regularMarketPrice
      const rawPrevClose = meta.chartPreviousClose || meta.previousClose || rawPrice
      // TASE (Yahoo Finance) returns prices in agorot (1 ILS = 100 agorot)
      const div = exchange === 'TASE' ? 100 : 1
      const raw52h = meta.fiftyTwoWeekHigh ?? s.summaryDetail?.fiftyTwoWeekHigh?.raw ?? null
      const raw52l = meta.fiftyTwoWeekLow ?? s.summaryDetail?.fiftyTwoWeekLow?.raw ?? null
      return {
        ticker, symbol,
        price: rawPrice / div,
        change_pct: parseFloat(((rawPrice - rawPrevClose) / rawPrevClose * 100).toFixed(2)),
        market_cap: s.price?.marketCap?.raw ?? null,
        pe_ratio: s.summaryDetail?.trailingPE?.raw ?? null,
        eps: s.defaultKeyStatistics?.trailingEps?.raw ?? null,
        week52_high: raw52h != null ? raw52h / div : null,
        week52_low: raw52l != null ? raw52l / div : null,
        sector: s.assetProfile?.sector || sq.sector || 'N/A',
        industry: s.assetProfile?.industry || sq.industry || 'N/A',
        short_name: meta.shortName || meta.longName || sq.shortname || ticker,
        currency: meta.currency || (exchange === 'TASE' ? 'ILS' : 'USD')
      }
    } catch (err) {
      if (err.response?.status === 401 && attempt === 0) {
        console.warn(`YF 401 for ${symbol}, refreshing crumb...`)
        await refreshYFAuth()
        continue
      }
      console.error(`fetchStockData error for ${symbol}:`, err.message)
      return { ticker, symbol, price: null, error: err.message }
    }
  }
}
async function analyzeStock(stockData, allPortfolioTickers, language = 'he') {
  const isEn = language === 'en'
  const pctOfRange = stockData.week52_high && stockData.week52_low && stockData.week52_high !== stockData.week52_low
    ? Math.round((stockData.price - stockData.week52_low) / (stockData.week52_high - stockData.week52_low) * 100)
    : null
  const mktCapFmt = stockData.market_cap ? (stockData.market_cap / 1e9).toFixed(1) + 'B' : 'N/A'
  const verdictTag = isEn ? 'buy|watch|hold|avoid' : 'קנה|עקוב|החזק|הימנע'
  const riskTag = isEn ? 'high|medium|low' : 'גבוה|בינוני|נמוך'
  const ecosystemInstruction = allPortfolioTickers.length
    ? `For "ecosystem": if ${stockData.ticker} has a real supply-chain, revenue, or competitive relationship with any of [${allPortfolioTickers.join(', ')}], include {"ticker":"X","impact":"one sentence"} for each. Otherwise keep [].`
    : 'Keep "ecosystem" as [].'

  const prompt = `You are a seasoned portfolio manager writing a candid investment note for a friend.

${stockData.ticker} | ${stockData.short_name || stockData.ticker}
Price: ${stockData.price} ${stockData.currency} | Today: ${stockData.change_pct > 0 ? '+' : ''}${stockData.change_pct}%
P/E: ${stockData.pe_ratio || 'N/A'} | EPS: ${stockData.eps || 'N/A'}
52W: ${stockData.week52_low} – ${stockData.week52_high}${pctOfRange != null ? ` | At ${pctOfRange}% of 52W range` : ''}
Market cap: ${mktCapFmt} | Sector: ${stockData.sector}${stockData.industry && stockData.industry !== stockData.sector ? ` / ${stockData.industry}` : ''}${stockData.revenue_growth != null ? `\nRevenue growth (YoY): ${stockData.revenue_growth}%` : ''}${stockData.net_margin != null ? `\nNet margin: ${stockData.net_margin}%` : ''}

Write in ${isEn ? 'English' : 'Hebrew'}. Be specific — use the numbers above. Have a real view and defend it.
Don't write "strong moat" or "experienced management". Write what actually makes this defensible or vulnerable, and whether the current price reflects it.

Return ONLY this JSON:
{
  "verdict": "buy|watch|hold|avoid",
  "summary": "2-3 sentences. Lead with the bottom line. Use actual numbers. Sound like a person, not a report.",
  "thesis": "What specifically must go right for this investment to work. Be concrete.",
  "risks": "The real bear case. Specific scenarios and stakes — not generic competition or regulation.",
  "catalyst": "1-2 concrete upcoming events or data points that will prove or disprove the thesis.",
  "tags": { "verdict": "${verdictTag}", "risk": "${riskTag}" },
  "ecosystem": []
}
${ecosystemInstruction}`

  for (let attempt = 0; attempt < 2; attempt++) {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1800,
      system: [{ type: 'text', text: 'You are a candid portfolio manager. Always respond with valid JSON only. Never include text outside the JSON object.', cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: prompt }]
    })
    const raw = message.content[0]?.text || ''
    const result = extractJson(raw)
    if (result) return result
    console.error(`analyzeStock attempt ${attempt + 1} failed. stop_reason=${message.stop_reason} raw=${raw.slice(0, 300)}`)
  }
  throw new Error('Claude returned invalid JSON after 2 attempts')
}

async function analyzePortfolioBatch(stockDataList, language = 'he') {
  const isEn = language === 'en'
  const allTickers = stockDataList.map(s => s.ticker)
  const verdictTag = isEn ? 'buy|watch|hold|avoid' : 'קנה|עקוב|החזק|הימנע'
  const riskTag = isEn ? 'high|medium|low' : 'גבוה|בינוני|נמוך'
  const stocksText = stockDataList.map(sd => {
    const pct = sd.week52_high && sd.week52_low && sd.week52_high !== sd.week52_low
      ? Math.round((sd.price - sd.week52_low) / (sd.week52_high - sd.week52_low) * 100) + '% of 52W'
      : ''
    const extras = [
      sd.revenue_growth != null ? `RevGrowth:${sd.revenue_growth}%` : '',
      sd.net_margin != null ? `NetMargin:${sd.net_margin}%` : ''
    ].filter(Boolean).join(' | ')
    return `## ${sd.ticker} (${sd.short_name || sd.ticker})
Price: ${sd.price} ${sd.currency} | P/E: ${sd.pe_ratio || 'N/A'} | EPS: ${sd.eps || 'N/A'} | 52W: ${sd.week52_low}–${sd.week52_high} ${pct} | Cap: ${sd.market_cap ? (sd.market_cap/1e9).toFixed(1)+'B' : 'N/A'} | ${sd.sector}${extras ? '\n' + extras : ''}`
  }).join('\n\n')

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: Math.min(900 * stockDataList.length + 400, 8000),
    system: [{ type: 'text', text: 'You are a candid portfolio manager. Always respond with valid JSON only. Never include text outside the JSON object.', cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: `Write a candid investment note for each stock. Respond in ${isEn ? 'English' : 'Hebrew'} for all text fields. Use actual numbers. Have real opinions.

${stocksText}

Portfolio tickers for ecosystem mapping: [${allTickers.join(', ')}]

Return a JSON object keyed by ticker:
{
  "TICKER": {
    "verdict": "buy|watch|hold|avoid",
    "summary": "2-3 sentences, bottom line first, use actual numbers",
    "thesis": "What must go right for this to work",
    "risks": "Specific bear case with real stakes",
    "catalyst": "1-2 concrete upcoming events to watch",
    "tags": { "verdict": "${verdictTag}", "risk": "${riskTag}" },
    "ecosystem": [{"ticker":"X","impact":"one sentence describing the relationship"}]
  }
}
Use {"ticker":"X","impact":"..."} format for ecosystem. If no real relationship exists, keep [].
Respond ONLY with the JSON object.` }]
  })
  const result = extractJson(message.content[0].text)
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    console.error('analyzePortfolioBatch: invalid response:', message.content[0].text.slice(0, 200))
    throw new Error('Claude returned invalid JSON for batch analysis')
  }
  return result
}

app.post('/api/analyze/batch', auth, analyzeLimiter, async (req, res) => {
  const { language = 'he' } = req.body
  try {
    const portfolioId = await getUserPortfolioId(req.user.id)
    if (!portfolioId) return res.status(400).json({ error: 'Portfolio not found' })
    const { rows: holdings } = await pool.query(
      'SELECT id, ticker, exchange FROM holdings WHERE portfolio_id = $1 ORDER BY ticker', [portfolioId]
    )
    if (!holdings.length) return res.json({ ok: true, analyzed: 0 })

    const stockDataList = await Promise.all(holdings.map(h => fetchStockData(h.ticker, h.exchange)))
    const failed = stockDataList.filter(sd => sd.error || !sd.price).map(sd => sd.ticker)
    const valid = stockDataList.filter(sd => !sd.error && sd.price)
    if (!valid.length) return res.status(502).json({ error: 'Could not fetch stock data for any holding', failed })

    const analyses = await analyzePortfolioBatch(valid, language)

    for (const sd of valid) {
      const analysis = analyses[sd.ticker]
      if (!analysis) continue
      await pool.query(
        'UPDATE holdings SET analysis_json = $1, analyzed_at = NOW() WHERE portfolio_id = $2 AND ticker = $3',
        [JSON.stringify({ ...analysis, stock_data: sd }), portfolioId, sd.ticker]
      )
    }
    res.json({ ok: true, analyzed: valid.length, failed })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Batch analysis failed' })
  }
})

app.post('/api/analyze/:ticker', auth, analyzeLimiter, async (req, res) => {
  const { ticker } = req.params
  const { exchange = 'US', language = 'he' } = req.body
  try {
    const portfolioId = await getUserPortfolioId(req.user.id)
    const { rows: allHoldings } = await pool.query(
      'SELECT ticker FROM holdings WHERE portfolio_id = $1', [portfolioId]
    )
    const allTickers = allHoldings.map(h => h.ticker).filter(t => t !== ticker)

    const stockData = await fetchStockData(ticker, exchange)
    if (stockData.error) return res.status(502).json({ error: `Cannot fetch data for ${ticker}: ${stockData.error}` })

    const analysis = await analyzeStock(stockData, allTickers, language)

    await pool.query(
      'UPDATE holdings SET analysis_json = $1, analyzed_at = NOW() WHERE portfolio_id = $2 AND ticker = $3',
      [JSON.stringify({ ...analysis, stock_data: stockData }), portfolioId, ticker]
    )

    res.json({ ticker, stock_data: stockData, analysis })
  } catch (err) {
    console.error('analyzeStock error:', err.message)
    res.status(500).json({ error: 'שגיאת ניתוח: ' + err.message })
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

For Israeli stocks (TASE), use exchange "TASE" and the English ticker symbol:
- טבע / Teva → TEVA
- כיל / ICL → ICL
- בזן → BZAN
- בנק הפועלים → POLI
- בנק לאומי → LUMI
- בנק מזרחי / מזרחי טפחות → MZTF
- בנק דיסקונט → DSCT
- הבינלאומי → FIBI
- מגדל ביטוח → MGDL
- הראל → HARL
- מנורה → MNRA
- אזרגס → AZRG
- שפיר הנדסה → SPEN
- אלביט → ESLT
- רדקום → RDCM
- נייס → NICE
- אמדוקס → DOX
- צ'ק פוינט → CHKP
- אינפיניאן / Infinieon → find the English ticker
- For any other Israeli company, use the English TASE ticker symbol if known, otherwise use the Hebrew name as the ticker.

For US/international stocks, use the standard ticker (AAPL, MSFT, NVDA, etc.) and exchange "US".
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

app.get('/api/status', (req, res) => {
  res.json({ finnhub: !!process.env.FINNHUB_API_KEY, news: !!process.env.NEWS_API_KEY })
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
      `SELECT * FROM news_notifications WHERE user_id = $1 AND notified = true ORDER BY sent_at DESC LIMIT $2 OFFSET $3`,
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

async function batchFilterNewsAllTickers(tickers, articles, alertLevel, language = 'he') {
  if (!articles.length) return []
  const isEn = language === 'en'
  const articleList = articles.map((a, i) =>
    `[${i}] ${a.title || ''}: ${(a.description || '').slice(0, 150)}`
  ).join('\n')
  const categories = isEn
    ? 'earnings|management|lawsuit|analyst|supply_chain|general'
    : 'רווחים|הנהלה|תביעה|שינוי המלצה|שרשרת אספקה|כללי'
  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      system: [{ type: 'text', text: 'You are a financial news classifier. Respond with valid JSON only.', cache_control: { type: 'ephemeral' } }],
      messages: [{
        role: 'user',
        content: `Portfolio tickers: ${tickers.join(', ')}
Alert level: ${alertLevel} (1=earnings/M&A/CEO only, 2=+analyst/lawsuits/guidance, 3=all mentions)
Write summaries in: ${isEn ? 'English' : 'Hebrew'}

Articles:
${articleList}

For each article relevant to any portfolio ticker return an entry. Ignore unrelated articles.
Return JSON array: [{"index":0,"ticker":"AAPL","notify":true,"category":"${categories}","importance":2,"summary":"${isEn ? 'Two concise sentences.' : 'שני משפטים תמציתיים.'}","is_earnings":false}]
importance: 1=critical (CEO resign/arrest, acquisition, fraud, SEC), 2=high (earnings, analyst change, major lawsuit, guidance), 3=medium (general mention)
If none qualify, return [].`
      }]
    })
    const result = extractJson(message.content[0].text)
    return Array.isArray(result) ? result : []
  } catch (err) {
    console.error('batchFilterNewsAllTickers error:', err.message)
    return []
  }
}

async function summarizeEarningsCall(articleText, language = 'he') {
  const isEn = language === 'en'
  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: [{ type: 'text', text: 'You are a skeptical financial analyst. Respond with valid JSON only.', cache_control: { type: 'ephemeral' } }],
      messages: [{
        role: 'user',
        content: `Summarize this earnings call in exactly 5 ${isEn ? 'English' : 'Hebrew'} bullet points for a skeptical investor.
Flag if management seemed evasive on: growth, margins, competition, or guidance.

Article: ${articleText.slice(0, 3000)}

Return JSON: { "bullets": ["bullet1","bullet2","bullet3","bullet4","bullet5"], "evasion_warning": null }`
      }]
    })
    return extractJson(message.content[0].text)
  } catch (err) {
    console.error('summarizeEarningsCall error:', err.message)
    return null
  }
}

function isMarketHours() {
  const et = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const day = et.getDay()   // 0=Sun, 6=Sat
  const hour = et.getHours()
  return day >= 1 && day <= 5 && hour >= 6 && hour < 22
}

async function pollNewsForUser(userId, alertLevel, language = 'he') {
  if (!process.env.NEWS_API_KEY) return
  const portfolioId = await getUserPortfolioId(userId)
  if (!portfolioId) return

  const { rows: holdings } = await pool.query(
    'SELECT ticker FROM holdings WHERE portfolio_id = $1', [portfolioId]
  )
  if (!holdings.length) return
  const tickers = holdings.map(h => h.ticker)

  try {
    const newsRes = await axios.get('https://newsapi.org/v2/everything', {
      params: { q: tickers.join(' OR '), sortBy: 'publishedAt', pageSize: 20,
                language: 'en', apiKey: process.env.NEWS_API_KEY },
      timeout: 10000
    })

    const articles = (newsRes.data.articles || []).filter(a => a.url)
    if (!articles.length) return

    // Dedup: skip articles already processed for this user
    const { rows: existing } = await pool.query(
      'SELECT article_url FROM news_notifications WHERE user_id = $1 AND article_url = ANY($2)',
      [userId, articles.map(a => a.url)]
    )
    const existingUrls = new Set(existing.map(r => r.article_url))
    const fresh = articles.filter(a => !existingUrls.has(a.url))
    if (!fresh.length) return

    // Pre-filter: ticker must appear somewhere in title or description
    // (Claude handles false positives via alert level — ticker symbols don't appear in headlines)
    const relevant = fresh.filter(a => {
      const text = ((a.title || '') + ' ' + (a.description || '')).toUpperCase()
      return tickers.some(t => text.includes(t.toUpperCase()))
    })
    if (!relevant.length) return

    const results = await batchFilterNewsAllTickers(tickers, relevant, alertLevel, language)
    const resultsByIndex = new Map(results.map(r => [r.index, r]))

    for (let i = 0; i < relevant.length; i++) {
      const article = relevant[i]
      const r = resultsByIndex.get(i)
      const shouldNotify = r?.notify === true

      let earningsBullets = null, evasionWarning = null
      if (shouldNotify && r.is_earnings && article.content) {
        const summary = await summarizeEarningsCall(article.content, language)
        earningsBullets = summary?.bullets || null
        evasionWarning = summary?.evasion_warning || null
      }

      // Store every relevant article (notified or not) so it is not re-evaluated next cycle
      await pool.query(
        `INSERT INTO news_notifications (user_id, ticker, headline, summary, category, importance, article_url, earnings_bullets, evasion_warning, notified)
         SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
         WHERE NOT EXISTS (SELECT 1 FROM news_notifications WHERE user_id=$1 AND article_url=$7)`,
        [userId, r?.ticker || tickers[0], article.title, shouldNotify ? r.summary : null,
         r?.category, r?.importance || 2, article.url,
         earningsBullets ? JSON.stringify(earningsBullets) : null, evasionWarning, shouldNotify]
      )

      if (!shouldNotify) continue
      const impLabel = language === 'en'
        ? ['','CRITICAL','HIGH','MEDIUM'][r.importance || 2]
        : ['','קריטי','גבוה','בינוני'][r.importance || 2]
      await sendPushToUser(userId, {
        title: `${r.ticker} — ${r.category} [${impLabel}]`,
        body: r.summary,
        tag: `${r.ticker}-${article.url}`,
        url: '/'
      })
    }
  } catch (err) {
    console.error('pollNewsForUser error:', err.message)
  }
}

async function pollNews() {
  if (!process.env.NEWS_API_KEY) return
  try {
    const { rows: users } = await pool.query(
      `SELECT DISTINCT po.user_id,
         COALESCE(up.profile_json->>'alert_level', '2') as alert_level,
         COALESCE(up.profile_json->>'language', 'he') as language
       FROM portfolios po JOIN holdings h ON h.portfolio_id = po.id
       LEFT JOIN user_profiles up ON up.user_id = po.user_id`
    )
    for (const u of users) await pollNewsForUser(u.user_id, parseInt(u.alert_level) || 2, u.language || 'he')
  } catch (err) {
    console.error('pollNews top-level error:', err.message)
  }
}

function startPolling() {
  const run = async () => {
    await pollNews()
    const interval = isMarketHours() ? 15 * 60 * 1000 : 60 * 60 * 1000
    setTimeout(run, interval)
  }
  console.log('Background news polling started (15 min market hours / 60 min off-hours)')
  run()
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

    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      profile_json JSONB NOT NULL DEFAULT '{"language":"he","alert_level":2}'
    );

    CREATE TABLE IF NOT EXISTS news_notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      ticker TEXT NOT NULL,
      headline TEXT,
      summary TEXT,
      category TEXT,
      importance INTEGER DEFAULT 2,
      article_url TEXT,
      earnings_bullets JSONB,
      evasion_warning TEXT,
      notified BOOLEAN DEFAULT true,
      sent_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_holdings_portfolio ON holdings(portfolio_id);
    CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);
    CREATE INDEX IF NOT EXISTS idx_notif_user ON news_notifications(user_id, sent_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_user_url ON news_notifications(user_id, article_url) WHERE article_url IS NOT NULL;
  `)
  // Migrate existing table: add new columns if they don't exist yet
  await pool.query(`
    ALTER TABLE news_notifications ADD COLUMN IF NOT EXISTS importance INTEGER DEFAULT 2;
    ALTER TABLE news_notifications ADD COLUMN IF NOT EXISTS notified BOOLEAN DEFAULT true;
  `)
  // Remove duplicate (user_id, article_url) rows before creating unique index
  await pool.query(`
    DELETE FROM news_notifications
    WHERE id NOT IN (
      SELECT MAX(id) FROM news_notifications
      WHERE article_url IS NOT NULL
      GROUP BY user_id, article_url
    ) AND article_url IS NOT NULL
  `).catch(e => console.warn('Dedup cleanup:', e.message))
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_user_url
    ON news_notifications(user_id, article_url)
    WHERE article_url IS NOT NULL
  `).catch(e => console.warn('Unique index:', e.message))
  console.log('DB initialized')
}

module.exports = app
module.exports.fetchStockData = fetchStockData
module.exports.pollNews = pollNews

if (require.main === module) {
  initDB().then(() => generateIcons()).then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`)
      refreshYFAuth()
      setInterval(refreshYFAuth, 6 * 60 * 60 * 1000) // refresh crumb every 6h
      startPolling()
    })
  }).catch(err => { console.error('Startup failed', err); process.exit(1) })
}
