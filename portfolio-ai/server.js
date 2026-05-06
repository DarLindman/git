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

app.get('/api/portfolio', auth, async (req, res) => {
  res.json({ holdings: [] })
})

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

if (require.main === module) {
  initDB().then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`)
    })
  }).catch(err => { console.error('DB init failed', err); process.exit(1) })
}
