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
