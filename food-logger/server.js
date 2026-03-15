require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');
// ─── PWA Icon ─────────────────────────────────────────────────────────────────
let ICON_PNG = null;
function buildIcon() {
  try {
    const { createCanvas } = require('@napi-rs/canvas');
    const size = 180, cx = size / 2, cy = size / 2, cr = 40;
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Rounded orange background
    ctx.beginPath();
    ctx.moveTo(cr, 0); ctx.lineTo(size - cr, 0);
    ctx.arcTo(size, 0, size, cr, cr);
    ctx.lineTo(size, size - cr);
    ctx.arcTo(size, size, size - cr, size, cr);
    ctx.lineTo(cr, size);
    ctx.arcTo(0, size, 0, size - cr, cr);
    ctx.lineTo(0, cr);
    ctx.arcTo(0, 0, cr, 0, cr);
    ctx.closePath();
    ctx.fillStyle = '#E8703A';
    ctx.fill();

    // Bowl rim
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 18, 62, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bowl body (bottom half)
    ctx.beginPath();
    ctx.arc(cx, cy + 18, 62, 0, Math.PI);
    ctx.fill();

    // Salad greens (layered circles)
    for (const [lx, ly, lr, lc] of [
      [cx,      cy - 12, 19, '#388E3C'],
      [cx - 22, cy - 4,  18, '#4CAF50'],
      [cx + 24, cy - 4,  18, '#4CAF50'],
      [cx - 38, cy + 10, 13, '#66BB6A'],
      [cx + 38, cy + 10, 13, '#66BB6A'],
      [cx + 10, cy + 2,  13, '#81C784'],
      [cx - 10, cy + 4,  11, '#A5D6A7'],
    ]) {
      ctx.fillStyle = lc;
      ctx.beginPath();
      ctx.arc(lx, ly, lr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Red tomato
    ctx.fillStyle = '#EF5350';
    ctx.beginPath();
    ctx.arc(cx - 12, cy + 10, 11, 0, Math.PI * 2);
    ctx.fill();

    // Yellow corn dot
    ctx.fillStyle = '#FFD54F';
    ctx.beginPath();
    ctx.arc(cx + 16, cy + 12, 7, 0, Math.PI * 2);
    ctx.fill();

    ICON_PNG = canvas.toBuffer('image/png');
    console.log('PWA icon generated');
  } catch (e) {
    console.warn('icon generation failed:', e.message);
  }
}
buildIcon();
const serveIcon = (_, res) => {
  if (ICON_PNG) return res.type('png').send(ICON_PNG);
  res.redirect('/icon.svg');
};

const app = express();
const port = process.env.PORT || 3000;

// DB
// NOTE: rejectUnauthorized:false skips cert validation on the Postgres TLS connection.
// This is required for Railway/Render managed databases that use self-signed certs.
// Risk: no MITM protection on the DB connection. To harden, obtain the CA cert from
// your provider and pass it as ssl:{ ca: fs.readFileSync('ca.crt') } instead.
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });

// Anthropic
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(cors({ origin: process.env.ORIGIN || 'http://localhost:3000' }));
app.use(express.json({ limit: '15mb' }));

const loginLimiter = rateLimit({ windowMs: 60_000, max: 10, standardHeaders: true, legacyHeaders: false });
const analyzeLimiter = rateLimit({ windowMs: 3_600_000, max: 20, standardHeaders: true, legacyHeaders: false });
app.get('/apple-touch-icon.png', serveIcon);
app.get('/apple-touch-icon-precomposed.png', serveIcon);
app.get('/icon-180.png', serveIcon);
app.use(express.static(path.join(__dirname, 'public')));

// ─── DB Init ─────────────────────────────────────────────────────────────────
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS food_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      logged_at TIMESTAMPTZ DEFAULT NOW(),
      meal_type TEXT CHECK (meal_type IN ('breakfast','lunch','dinner','snack')),
      food_name TEXT NOT NULL,
      calories INTEGER,
      protein_g NUMERIC(6,1),
      carbs_g NUMERIC(6,1),
      fat_g NUMERIC(6,1),
      fiber_g NUMERIC(6,1),
      notes TEXT
    );
    CREATE TABLE IF NOT EXISTS weight_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      logged_at DATE NOT NULL DEFAULT CURRENT_DATE,
      weight_kg NUMERIC(5,1) NOT NULL
    );
    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      profile_json TEXT NOT NULL DEFAULT '{}'
    );
    CREATE INDEX IF NOT EXISTS idx_food_logs_user_date ON food_logs(user_id, logged_at DESC);
    CREATE INDEX IF NOT EXISTS idx_weight_logs_user ON weight_logs(user_id, logged_at ASC);
  `);
  console.log('DB ready');
}

// ─── Auth middleware ──────────────────────────────────────────────────────────
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing-parity', 10); // for timing parity
function createToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

// ─── Auth routes ─────────────────────────────────────────────────────────────
app.post('/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password || username.length < 3 || password.length < 6)
    return res.status(400).json({ error: 'שם משתמש חייב להכיל לפחות 3 תווים, סיסמא לפחות 6' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username',
      [username.toLowerCase(), hash]
    );
    res.json({ token: createToken(rows[0]), username: rows[0].username });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'שם המשתמש כבר קיים' });
    console.error(e);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

app.post('/auth/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  const lowerUser = (username || '').toLowerCase();
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [lowerUser]);
    const user = rows[0];
    // Always run bcrypt to prevent timing-based username enumeration
    const valid = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
    if (!valid || !user) return res.status(401).json({ error: 'שם משתמש או סיסמא שגויים' });
    res.json({ token: createToken(user), username: user.username });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

app.post('/auth/change-password', auth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6)
    return res.status(400).json({ error: 'סיסמא חדשה חייבת להכיל לפחות 6 תווים' });
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (!rows[0] || !(await bcrypt.compare(currentPassword, rows[0].password_hash)))
      return res.status(401).json({ error: 'סיסמא נוכחית שגויה' });
    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// ─── Analyze food image ───────────────────────────────────────────────────────
app.post('/api/analyze', auth, analyzeLimiter, async (req, res) => {
  const { imageBase64: raw, mimeType: mime } = req.body;
  if (!raw) return res.status(400).json({ error: 'No image provided' });
  const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const mimeType = ALLOWED_MIME.includes(mime) ? mime : 'image/jpeg';
  const imageBase64 = raw.replace(/^data:[^;]+;base64,/, '');
  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: 'You are a food nutrition analyzer. You MUST always write food names in Hebrew script only (כתב עברי). Never use Latin, English, or any non-Hebrew characters in the foodName field. Examples: use "עוף בתנור" not "Grilled Chicken", use "פסטה ברוטב עגבניות" not "Pasta with tomato sauce".',
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: imageBase64 }
          },
          {
            type: 'text',
            text: `Identify the food in the image. Reply with ONLY a single-line JSON object, no markdown, no code blocks, no explanation:\n{"foodName":"שם האוכל בעברית","calories":0,"protein_g":0,"carbs_g":0,"fat_g":0,"fiber_g":0}\nEstimate for the portion shown. All values except foodName must be numbers.\nCRITICAL: foodName must be in Hebrew script only — no English, no Latin characters. Example: "עוף בתנור" not "Grilled Chicken".`
          }
        ]
      }]
    });

    const text = message.content[0].text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'לא ניתן לנתח את תגובת ה-AI' });
    let data;
    try {
      data = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr.message, '\nClaude raw output:', text);
      return res.status(500).json({ error: 'לא ניתן לנתח את תגובת ה-AI' });
    }
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'שגיאה בניתוח התמונה' });
  }
});

// ─── Analyze food text ────────────────────────────────────────────────────────
app.post('/api/analyze-text', auth, analyzeLimiter, async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'No text provided' });
  if (text.length > 500) return res.status(400).json({ error: 'תיאור ארוך מדי (מקסימום 500 תווים)' });
  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      temperature: 0,
      messages: [{
        role: 'user',
        content: `זהה כל מאכל בטקסט וחשב את ערכיו התזונתיים לפי הכמות שצוינה.\nכשאין כמות: השתמש בכמות הקטנה הסבירה — חתיכה/יחידה אחת, לא פחית שלמה. דגים קטנים (סרדין, אנשובי, מקרל) = דג/חתיכה בודדת. טונה ללא כמות = פחית קטנה (85 גרם).\nהחזר ONLY a JSON array, no markdown, no explanation:\n[{"name":"שם בעברית","calories":0,"protein_g":0,"carbs_g":0,"fat_g":0,"fiber_g":0}]\nשם בעברית בלבד. כל הערכים מספרים.\n\nהטקסט: ${text.trim()}`
      }]
    });
    const raw = message.content[0].text.trim();
    const arrMatch = raw.match(/\[[\s\S]*\]/);
    if (!arrMatch) return res.status(500).json({ error: 'לא ניתן לנתח את תגובת ה-AI' });
    let items;
    try { items = JSON.parse(arrMatch[0]); }
    catch { return res.status(500).json({ error: 'לא ניתן לנתח את תגובת ה-AI' }); }
    if (!Array.isArray(items) || items.length === 0) return res.status(500).json({ error: 'לא ניתן לנתח את תגובת ה-AI' });
    const totals = items.reduce((acc, item) => ({
      calories: acc.calories + (Number(item.calories) || 0),
      protein_g: acc.protein_g + (Number(item.protein_g) || 0),
      carbs_g: acc.carbs_g + (Number(item.carbs_g) || 0),
      fat_g: acc.fat_g + (Number(item.fat_g) || 0),
      fiber_g: acc.fiber_g + (Number(item.fiber_g) || 0),
    }), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 });
    res.json({ foodName: items.map(i => i.name).join(', '), ...totals });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'שגיאה בניתוח הטקסט' });
  }
});

// ─── Food log CRUD ────────────────────────────────────────────────────────────
app.post('/api/food', auth, async (req, res) => {
  const { meal_type, food_name, calories, protein_g, carbs_g, fat_g, fiber_g, notes, logged_at } = req.body;
  if (!food_name) return res.status(400).json({ error: 'שם האוכל חסר' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO food_logs (user_id, meal_type, food_name, calories, protein_g, carbs_g, fat_g, fiber_g, notes, logged_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, COALESCE($10::timestamptz, NOW())) RETURNING *`,
      [req.user.id, meal_type, food_name, calories, protein_g, carbs_g, fat_g, fiber_g, notes, logged_at || null]
    );
    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

app.get('/api/food', auth, async (req, res) => {
  const { date } = req.query; // YYYY-MM-DD
  try {
    let query, params;
    if (date) {
      query = `SELECT * FROM food_logs WHERE user_id=$1 AND logged_at::date = $2::date ORDER BY logged_at ASC`;
      params = [req.user.id, date];
    } else {
      query = `SELECT * FROM food_logs WHERE user_id=$1 ORDER BY logged_at DESC LIMIT 500`;
      params = [req.user.id];
    }
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

app.delete('/api/food/:id', auth, async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM food_logs WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'לא נמצא' });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// ─── Streak ───────────────────────────────────────────────────────────────────
app.get('/api/streak', auth, async (req, res) => {
  try {
    // ::text forces pg to return 'YYYY-MM-DD' string, not a Date object
    const { rows } = await pool.query(
      `SELECT DISTINCT logged_at::date::text AS day FROM food_logs WHERE user_id=$1 ORDER BY day DESC`,
      [req.user.id]
    );
    const days = rows.map(r => r.day); // already 'YYYY-MM-DD' strings
    if (!days.length) return res.json({ streak: 0 });
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (days[0] !== today && days[0] !== yesterday) return res.json({ streak: 0 });
    let streak = 0;
    let expected = days[0];
    for (const day of days) {
      if (day !== expected) break;
      streak++;
      // advance expected to previous day using UTC arithmetic
      const d = new Date(expected + 'T12:00:00Z');
      d.setUTCDate(d.getUTCDate() - 1);
      expected = d.toISOString().slice(0, 10);
    }
    res.json({ streak });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// ─── Statistics ───────────────────────────────────────────────────────────────
// Weekly summary — returns 7 days of daily totals
app.get('/api/stats/weekly', auth, async (req, res) => {
  const { start } = req.query; // YYYY-MM-DD (start of week), defaults to 7 days ago
  try {
    const { rows } = await pool.query(`
      SELECT
        logged_at::date AS day,
        SUM(calories) AS calories,
        SUM(protein_g) AS protein_g,
        SUM(carbs_g) AS carbs_g,
        SUM(fat_g) AS fat_g,
        SUM(fiber_g) AS fiber_g
      FROM food_logs
      WHERE user_id=$1
        AND logged_at::date >= COALESCE($2::date, CURRENT_DATE - INTERVAL '6 days')
        AND logged_at::date <= COALESCE($2::date + INTERVAL '6 days', CURRENT_DATE)
      GROUP BY day
      ORDER BY day ASC
    `, [req.user.id, start || null]);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Monthly summary — returns daily totals for a month
app.get('/api/stats/monthly', auth, async (req, res) => {
  const { month } = req.query; // YYYY-MM, defaults to current month
  try {
    const { rows } = await pool.query(`
      SELECT
        logged_at::date AS day,
        SUM(calories) AS calories,
        SUM(protein_g) AS protein_g,
        SUM(carbs_g) AS carbs_g,
        SUM(fat_g) AS fat_g,
        SUM(fiber_g) AS fiber_g
      FROM food_logs
      WHERE user_id=$1
        AND logged_at::date >= DATE_TRUNC('month', COALESCE($2::date, CURRENT_DATE))::date
        AND logged_at::date <  (DATE_TRUNC('month', COALESCE($2::date, CURRENT_DATE)) + INTERVAL '1 month')::date
      GROUP BY day
      ORDER BY day ASC
    `, [req.user.id, month ? month + '-01' : null]);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// ─── Profile endpoints ────────────────────────────────────────────────────────
app.get('/api/profile', auth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT profile_json FROM user_profiles WHERE user_id=$1', [req.user.id]);
    if (!rows[0]) return res.json({});
    try {
      res.json(JSON.parse(rows[0].profile_json));
    } catch {
      console.error('Corrupt profile_json for user', req.user.id);
      res.json({});
    }
  } catch (e) { console.error(e); res.status(500).json({ error: 'שגיאת שרת' }); }
});

const PROFILE_ALLOWED_KEYS = new Set(['gender', 'birthDate', 'height', 'weight', 'activity', 'goalKg']);
app.put('/api/profile', auth, async (req, res) => {
  try {
    const sanitized = Object.fromEntries(
      Object.entries(req.body).filter(([k]) => PROFILE_ALLOWED_KEYS.has(k))
    );
    const json = JSON.stringify(sanitized);
    await pool.query(
      `INSERT INTO user_profiles (user_id, profile_json) VALUES ($1,$2)
       ON CONFLICT (user_id) DO UPDATE SET profile_json=$2`,
      [req.user.id, json]
    );
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'שגיאת שרת' }); }
});

// ─── Weight log endpoints ─────────────────────────────────────────────────────
app.post('/api/weight', auth, async (req, res) => {
  const { weight_kg, logged_at } = req.body;
  if (!weight_kg || isNaN(+weight_kg)) return res.status(400).json({ error: 'משקל לא תקין' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO weight_logs (user_id, weight_kg, logged_at) VALUES ($1, $2, COALESCE($3::date, CURRENT_DATE)) RETURNING id, logged_at::text, weight_kg`,
      [req.user.id, +weight_kg, logged_at || null]
    );
    res.json(rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: 'שגיאת שרת' }); }
});

app.get('/api/weight', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, logged_at::text, weight_kg FROM weight_logs WHERE user_id=$1 ORDER BY logged_at ASC LIMIT 1095`,
      [req.user.id]
    );
    res.json(rows);
  } catch (e) { console.error(e); res.status(500).json({ error: 'שגיאת שרת' }); }
});

app.delete('/api/weight/:id', auth, async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM weight_logs WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'לא נמצא' });
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'שגיאת שרת' }); }
});

// Yearly summary — returns monthly totals for a year
app.get('/api/stats/yearly', auth, async (req, res) => {
  const { year } = req.query; // YYYY, defaults to current year
  try {
    const { rows } = await pool.query(`
      SELECT
        TO_CHAR(logged_at, 'YYYY-MM') AS month,
        SUM(calories) AS calories,
        SUM(protein_g) AS protein_g,
        SUM(carbs_g) AS carbs_g,
        SUM(fat_g) AS fat_g,
        SUM(fiber_g) AS fiber_g,
        COUNT(DISTINCT logged_at::date) AS day_count
      FROM food_logs
      WHERE user_id=$1
        AND logged_at >= make_date(COALESCE($2::int, EXTRACT(YEAR FROM CURRENT_DATE)::int), 1, 1)
        AND logged_at <  make_date(COALESCE($2::int, EXTRACT(YEAR FROM CURRENT_DATE)::int) + 1, 1, 1)
      GROUP BY month
      ORDER BY month ASC
    `, [req.user.id, year ? +year : null]);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
initDB().then(() => {
  app.listen(port, () => console.log(`Food Logger running on http://localhost:${port}`));
}).catch(e => { console.error('DB init failed', e); process.exit(1); });
