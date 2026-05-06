import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { AuroraBackground } from '../../components/ui/AuroraBackground';
import { SleepGraph } from '../../components/ui/SleepGraph';
import { Colors, Spacing } from '../../src/design/tokens';
import { i18n } from '../../src/i18n';
import { AlarmConfig, defaultAlarmConfig } from '../../src/models/AlarmConfig';
import { SleepEntry } from '../../src/models/SleepEntry';
import { SleepSession } from '../../src/models/SleepSession';
import { SleepStage, stageDisplayName } from '../../src/models/SleepStage';
import { calculate } from '../../src/engine/SleepScore';
import { evaluate, AlarmDecision, snoozeDecision, SnoozeDecision, SNOOZE_DELAY_MS } from '../../src/engine/AlarmEngine';
import { MotionService } from '../../src/services/MotionService';
import { SoundService } from '../../src/services/SoundService';
import { getSleepProvider, isMockMode, pollIntervalMs, SleepProvider } from '../../src/services/SleepProviderFactory';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ScreenState = 'before' | 'active' | 'summary';
const ALARM_KEY = 'sw_alarm_config';

export default function TonightScreen() {
  const t = i18n.t();
  const lang = i18n.lang();

  const [state, setState] = useState<ScreenState>('before');
  const [watchEnabled, setWatchEnabled] = useState<boolean | null>(null);
  const [config, setConfig] = useState<AlarmConfig>(defaultAlarmConfig());
  const [entries, setEntries] = useState<SleepEntry[]>([]);
  const [currentStage, setCurrentStage] = useState<SleepStage | null>(null);
  const [wokeInStage, setWokeInStage] = useState<SleepStage | null>(null);
  const [snoozeCount, setSnoozeCount] = useState(0);
  const [lastSession, setLastSession] = useState<SleepSession | null>(null);
  const [now, setNow] = useState(Date.now());
  const [mockMode, setMockMode] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const providerRef = useRef<SleepProvider | null>(null);

  useEffect(() => {
    // Update clock every 30s
    clockRef.current = setInterval(() => setNow(Date.now()), 30_000);
    return () => { if (clockRef.current) clearInterval(clockRef.current); };
  }, []);

  useEffect(() => {
    async function load() {
      const raw = await AsyncStorage.getItem(ALARM_KEY);
      let targetMs: number;
      if (raw) {
        const saved = JSON.parse(raw) as AlarmConfig;
        const d = new Date();
        const t = new Date(saved.targetTimeMs);
        d.setHours(t.getHours(), t.getMinutes(), 0, 0);
        targetMs = d.getTime();
        setConfig({ ...saved, targetTimeMs: targetMs });
      } else {
        const d = new Date();
        d.setHours(7, 0, 0, 0);
        targetMs = d.getTime();
        setConfig(c => ({ ...c, targetTimeMs: targetMs }));
      }

      const provider = await getSleepProvider();
      providerRef.current = provider;
      setMockMode(isMockMode());

      const hasWatch = await provider.isWatchTrackingEnabled();
      setWatchEnabled(hasWatch);
      if (hasWatch) startTracking(true);

      const sessions = await provider.fetchSessions(Date.now() - 86_400_000, Date.now());
      if (sessions.length) setLastSession(sessions[sessions.length - 1]);
    }
    load();
  }, []);

  const startTracking = (isWatch = false) => {
    setState('active');
    if (!isWatch) MotionService.start();
    beginPolling();
  };

  const beginPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    const interval = pollIntervalMs();
    pollRef.current = setInterval(poll, interval);
    poll();
  };

  const poll = async () => {
    const provider = providerRef.current;
    if (!provider) return;
    const interval = pollIntervalMs();
    const stage = await provider.currentStage();
    setCurrentStage(stage);
    setNow(Date.now());

    const nowMs = Date.now();
    setEntries(prev => [
      ...prev,
      { id: String(nowMs), stage: stage ?? SleepStage.Core, startMs: nowMs - interval, endMs: nowMs },
    ]);

    const decision = evaluate(config, nowMs, stage);
    if (decision === AlarmDecision.FireNow) fireAlarm(stage);
  };

  const fireAlarm = async (stage: SleepStage | null) => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!watchEnabled && !isMockMode()) MotionService.stop();
    setWokeInStage(stage);
    await SoundService.play(config.soundId as any, config.maxVolume);
    setState('summary');
  };

  const handleSnooze = () => {
    const dec = snoozeDecision(snoozeCount);
    SoundService.stop();
    if (dec === SnoozeDecision.ForceWake) return;
    setSnoozeCount(c => c + 1);
    setTimeout(beginPolling, SNOOZE_DELAY_MS);
  };

  const handleDismiss = () => SoundService.stop();

  const saveConfig = async (c: AlarmConfig) => {
    setConfig(c);
    await AsyncStorage.setItem(ALARM_KEY, JSON.stringify(c));
  };

  const adjustTime = (deltaMin: number) => {
    const d = new Date(config.targetTimeMs);
    d.setMinutes(d.getMinutes() + deltaMin);
    saveConfig({ ...config, targetTimeMs: d.getTime() });
  };

  const fmt = (ms: number) =>
    new Date(ms).toLocaleTimeString(lang === 'he' ? 'he-IL' : 'en-US', {
      hour: '2-digit', minute: '2-digit', hour12: false,
    });

  const score = lastSession ? calculate(lastSession, wokeInStage) : null;

  return (
    <AuroraBackground>
      <SafeAreaView style={s.safe}>

        {/* Demo mode badge */}
        {mockMode && (
          <View style={s.demoBadge}>
            <Text style={s.demoText}>
              {lang === 'he' ? '⚙ מצב הדגמה — נתונים מדומים' : '⚙ Demo Mode — simulated data'}
            </Text>
          </View>
        )}

        {/* ── BEFORE ── */}
        {state === 'before' && (
          <View style={s.center}>
            {score !== null && lastSession && (
              <View style={s.lastNightCard}>
                <Text style={s.cardLabel}>{lang === 'he' ? 'אמש' : 'Last night'}</Text>
                <Text style={s.bigNum}>{score}</Text>
                <Text style={s.cardSub}>{t.score}</Text>
              </View>
            )}

            {/* Time picker — tap +/- buttons */}
            <View style={s.timePicker}>
              <Text style={s.eyebrow}>{t.tonight.alarmSet}</Text>
              <View style={s.timeRow}>
                <Pressable onPress={() => adjustTime(-5)} style={s.adj}><Text style={s.adjText}>−</Text></Pressable>
                <Text style={s.bigClock}>{fmt(config.targetTimeMs)}</Text>
                <Pressable onPress={() => adjustTime(5)} style={s.adj}><Text style={s.adjText}>+</Text></Pressable>
              </View>
              <Text style={s.windowLabel}>
                {t.tonight.window}: {fmt(config.targetTimeMs - config.windowMinutes * 60_000)} – {fmt(config.targetTimeMs)}
              </Text>
            </View>

            {watchEnabled === true ? (
              <View style={s.badge}>
                <View style={s.dot} />
                <Text style={s.badgeText}>{t.tonight.watchTracking}</Text>
              </View>
            ) : watchEnabled === false ? (
              <Pressable onPress={() => startTracking(false)} style={s.startBtn}>
                <Text style={s.startBtnText}>{t.tonight.startTracking}</Text>
              </Pressable>
            ) : null}
          </View>
        )}

        {/* ── ACTIVE ── */}
        {state === 'active' && (
          <View style={s.center}>
            <Text style={s.eyebrow}>{t.tonight.trackingActive}</Text>
            <Text style={s.bigClock}>{fmt(now)}</Text>
            {currentStage && (
              <Text style={s.phase}>{stageDisplayName(currentStage, lang)}</Text>
            )}
            <View style={s.graphWrap}>
              <SleepGraph entries={entries} width={300} height={64} />
            </View>
            <Text style={s.alarmFooter}>{t.tonight.alarmSet} {fmt(config.targetTimeMs)}</Text>
          </View>
        )}

        {/* ── SUMMARY ── */}
        {state === 'summary' && (
          <View style={s.center}>
            <Text style={s.greeting}>{t.tonight.summary}</Text>
            {score !== null && <>
              <Text style={s.bigNum}>{score}</Text>
              <Text style={s.cardSub}>{t.score}</Text>
            </>}
            {wokeInStage && (
              <Text style={s.phase}>
                {lang === 'he' ? 'הועלת ב' : 'Woken during'} {stageDisplayName(wokeInStage, lang)}
              </Text>
            )}
            <View style={s.graphWrap}>
              <SleepGraph entries={entries} width={300} height={64} />
            </View>
            <View style={s.actionRow}>
              <Pressable onPress={handleSnooze} style={s.snoozeBtn}>
                <Text style={s.snoozeTxt}>{lang === 'he' ? 'נודניק' : 'Snooze'}</Text>
              </Pressable>
              <Pressable onPress={handleDismiss} style={s.dismissBtn}>
                <Text style={s.dismissTxt}>{lang === 'he' ? 'עצור' : 'Dismiss'}</Text>
              </Pressable>
            </View>
          </View>
        )}

      </SafeAreaView>
    </AuroraBackground>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.lg, gap: Spacing.md },

  demoBadge: {
    alignSelf: 'center',
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255,180,0,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,180,0,0.25)',
  },
  demoText: {
    fontFamily: 'InstrumentSans',
    fontSize: 10,
    color: 'rgba(255,200,80,0.7)',
    letterSpacing: 0.5,
  },

  lastNightCard: {
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(60,200,180,0.12)',
    backgroundColor: 'rgba(60,200,180,0.05)',
    minWidth: 140,
  },
  cardLabel: { fontFamily: 'InstrumentSans', fontSize: 9, letterSpacing: 2, color: Colors.textMuted, textTransform: 'uppercase', marginBottom: 4 },
  cardSub:   { fontFamily: 'InstrumentSans_300', fontSize: 11, color: Colors.textSecondary, letterSpacing: 1 },

  timePicker: { alignItems: 'center', paddingVertical: Spacing.lg },
  timeRow:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  adj:        { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: 'rgba(60,200,180,0.08)', borderWidth: 1, borderColor: 'rgba(60,200,180,0.2)' },
  adjText:    { fontFamily: 'InstrumentSans', fontSize: 20, color: Colors.teal },
  windowLabel: { fontFamily: 'InstrumentSans_300', fontSize: 11, color: Colors.textSecondary, marginTop: 6, letterSpacing: 0.3 },

  eyebrow:   { fontFamily: 'InstrumentSans', fontSize: 9, letterSpacing: 3, color: Colors.textMuted, textTransform: 'uppercase', marginBottom: 4 },
  bigClock:  { fontFamily: 'Gloock', fontSize: 72, color: Colors.textPrimary, letterSpacing: -3, lineHeight: 76 },
  bigNum:    { fontFamily: 'Gloock', fontSize: 72, color: Colors.textPrimary, letterSpacing: -3, lineHeight: 76 },
  phase:     { fontFamily: 'InstrumentSerif_Italic', fontSize: 17, color: Colors.textSecondary, marginTop: -4 },
  alarmFooter: { fontFamily: 'InstrumentSans_300', fontSize: 12, color: Colors.textMuted, marginTop: Spacing.sm },
  greeting:  { fontFamily: 'Gloock', fontSize: 30, color: Colors.textPrimary },

  graphWrap: { marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: 'rgba(60,200,180,0.1)', width: '100%', alignItems: 'center' },

  badge:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: 20, backgroundColor: 'rgba(60,200,180,0.08)', borderWidth: 1, borderColor: 'rgba(60,200,180,0.15)' },
  dot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(60,200,180,0.7)' },
  badgeText: { fontFamily: 'InstrumentSans_300', fontSize: 12, color: Colors.textSecondary, letterSpacing: 0.5 },

  startBtn:     { paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl, borderRadius: 50, backgroundColor: 'rgba(60,200,180,0.12)', borderWidth: 1, borderColor: 'rgba(60,200,180,0.35)' },
  startBtnText: { fontFamily: 'InstrumentSans', fontSize: 15, color: Colors.teal, letterSpacing: 0.5 },

  actionRow:   { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg },
  snoozeBtn:   { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg, borderRadius: 50, borderWidth: 1, borderColor: 'rgba(60,200,180,0.2)' },
  snoozeTxt:   { fontFamily: 'InstrumentSans', fontSize: 14, color: Colors.textSecondary },
  dismissBtn:  { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg, borderRadius: 50, backgroundColor: 'rgba(60,200,180,0.12)', borderWidth: 1, borderColor: 'rgba(60,200,180,0.35)' },
  dismissTxt:  { fontFamily: 'InstrumentSans', fontSize: 14, color: Colors.teal },
});
