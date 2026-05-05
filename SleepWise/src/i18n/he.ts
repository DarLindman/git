export default {
  tabs: {
    tonight:    'הלילה',
    history:    'היסטוריה',
    statistics: 'סטטיסטיקות',
    settings:   'הגדרות',
  },
  tonight: {
    trackingActive: 'מעקב שינה פעיל',
    watchTracking:  'השעון עוקב הלילה',
    startTracking:  'התחל מעקב',
    alarmSet:       'אזעקה ב-',
    window:         'חלון חכם',
    summary:        'בוקר טוב',
  },
  stages: {
    DEEP:  'שינה עמוקה',
    REM:   'שנת REM',
    CORE:  'שינה קלה',
    AWAKE: 'ערני',
  },
  score:   'ציון שינה',
  history: { weekly: 'שבועי', monthly: 'חודשי' },
  stats:   { avg7: 'ממוצע 7 ימים', avg30: 'ממוצע 30 יום', streak: 'רצף' },
  settings: {
    alarmWindow: 'חלון השכמה (דקות)',
    wakeSound:   'צליל השכמה',
    language:    'שפה',
    appleWatch:  'Apple Watch',
  },
} as const;
