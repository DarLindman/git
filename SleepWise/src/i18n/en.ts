export default {
  tabs: {
    tonight:    'Tonight',
    history:    'History',
    statistics: 'Statistics',
    settings:   'Settings',
  },
  tonight: {
    trackingActive: 'Sleep tracking active',
    watchTracking:  'Your Watch is tracking tonight',
    startTracking:  'Start Tracking',
    alarmSet:       'Alarm set for',
    window:         'Smart window',
    summary:        'Good morning',
  },
  stages: {
    DEEP:  'Deep Sleep',
    REM:   'REM Sleep',
    CORE:  'Light Sleep',
    AWAKE: 'Awake',
  },
  score:   'Sleep Score',
  history: { weekly: 'Weekly', monthly: 'Monthly' },
  stats:   { avg7: '7-day avg', avg30: '30-day avg', streak: 'Streak' },
  settings: {
    alarmWindow: 'Alarm window (minutes)',
    wakeSound:   'Wake sound',
    language:    'Language',
    appleWatch:  'Apple Watch',
  },
} as const;

export type Strings = typeof import('./en').default;
