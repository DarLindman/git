require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const Anthropic = require('@anthropic-ai/sdk');
const multer = require('multer');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// DB
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });

// Anthropic
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Multer (memory storage — images not persisted, only analysis results saved)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.use(cors());
app.use(express.json({ limit: '15mb' }));
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
    const token = jwt.sign({ id: rows[0].id, username: rows[0].username }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, username: rows[0].username });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'שם המשתמש כבר קיים' });
    console.error(e);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username.toLowerCase()]);
    if (!rows[0] || !(await bcrypt.compare(password, rows[0].password_hash)))
      return res.status(401).json({ error: 'שם משתמש או סיסמא שגויים' });
    const token = jwt.sign({ id: rows[0].id, username: rows[0].username }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, username: rows[0].username });
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
    if (!(await bcrypt.compare(currentPassword, rows[0].password_hash)))
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
app.post('/api/analyze', auth, upload.single('image'), async (req, res) => {
  try {
    let imageBase64, mimeType;
    if (req.file) {
      imageBase64 = req.file.buffer.toString('base64');
      mimeType = req.file.mimetype;
    } else if (req.body.imageBase64) {
      // Accept base64 from JSON body too
      imageBase64 = req.body.imageBase64.replace(/^data:[^;]+;base64,/, '');
      mimeType = req.body.mimeType || 'image/jpeg';
    } else {
      return res.status(400).json({ error: 'No image provided' });
    }

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: imageBase64 }
          },
          {
            type: 'text',
            text: `Identify the food in the image. Reply with ONLY a single-line JSON object, no markdown, no code blocks, no explanation:\n{"foodName":"שם האוכל בעברית","calories":0,"protein_g":0,"carbs_g":0,"fat_g":0,"fiber_g":0}\nEstimate for the portion shown. All values except foodName must be numbers.`
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
      query = `SELECT * FROM food_logs WHERE user_id=$1 ORDER BY logged_at DESC LIMIT 100`;
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

// ─── Statistics ───────────────────────────────────────────────────────────────
// Daily summary
app.get('/api/stats/daily', auth, async (req, res) => {
  const { date } = req.query; // YYYY-MM-DD, defaults to today
  try {
    const { rows } = await pool.query(`
      SELECT
        meal_type,
        COUNT(*) AS items,
        SUM(calories) AS calories,
        SUM(protein_g) AS protein_g,
        SUM(carbs_g) AS carbs_g,
        SUM(fat_g) AS fat_g,
        SUM(fiber_g) AS fiber_g
      FROM food_logs
      WHERE user_id=$1 AND logged_at::date = COALESCE($2::date, CURRENT_DATE)
      GROUP BY meal_type
      ORDER BY meal_type
    `, [req.user.id, date || null]);

    const totals = rows.reduce((acc, r) => ({
      calories: acc.calories + (+r.calories || 0),
      protein_g: acc.protein_g + (+r.protein_g || 0),
      carbs_g: acc.carbs_g + (+r.carbs_g || 0),
      fat_g: acc.fat_g + (+r.fat_g || 0),
      fiber_g: acc.fiber_g + (+r.fiber_g || 0),
    }), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 });

    res.json({ byMeal: rows, totals });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

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
        AND TO_CHAR(logged_at, 'YYYY-MM') = COALESCE($2, TO_CHAR(CURRENT_DATE, 'YYYY-MM'))
      GROUP BY day
      ORDER BY day ASC
    `, [req.user.id, month || null]);
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
    res.json(rows[0] ? JSON.parse(rows[0].profile_json) : {});
  } catch (e) { console.error(e); res.status(500).json({ error: 'שגיאת שרת' }); }
});

app.put('/api/profile', auth, async (req, res) => {
  try {
    const json = JSON.stringify(req.body);
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
      `SELECT id, logged_at::text, weight_kg FROM weight_logs WHERE user_id=$1 ORDER BY logged_at ASC LIMIT 90`,
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
        SUM(fiber_g) AS fiber_g
      FROM food_logs
      WHERE user_id=$1
        AND EXTRACT(YEAR FROM logged_at) = COALESCE($2::integer, EXTRACT(YEAR FROM CURRENT_DATE))
      GROUP BY month
      ORDER BY month ASC
    `, [req.user.id, year || null]);
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
