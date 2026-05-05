import { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AuroraBackground } from '../../components/ui/AuroraBackground';
import { Colors, Spacing } from '../../src/design/tokens';
import { i18n } from '../../src/i18n';
import { SleepSession, totalSleepMs, deepPct, remPct, corePct } from '../../src/models/SleepSession';
import { calculate } from '../../src/engine/SleepScore';
import { HealthKitService } from '../../src/services/HealthKitService';

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function streak(sessions: SleepSession[]): number {
  let count = 0;
  for (const s of [...sessions].reverse()) {
    if (totalSleepMs(s) / 3_600_000 >= 7) count++;
    else break;
  }
  return count;
}

interface StatsData {
  avgHours7: number;
  avgHours30: number;
  avgScore7: number;
  avgScore30: number;
  avgDeepPct: number;
  avgRemPct: number;
  avgCorePct: number;
  streakDays: number;
}

export default function StatisticsScreen() {
  const t = i18n.t();
  const lang = i18n.lang();
  const [stats, setStats] = useState<StatsData | null>(null);

  useEffect(() => {
    async function load() {
      const [sessions7, sessions30] = await Promise.all([
        HealthKitService.fetchSessions(Date.now() - 7 * 86_400_000, Date.now()),
        HealthKitService.fetchSessions(Date.now() - 30 * 86_400_000, Date.now()),
      ]);

      setStats({
        avgHours7:  avg(sessions7.map(s => totalSleepMs(s) / 3_600_000)),
        avgHours30: avg(sessions30.map(s => totalSleepMs(s) / 3_600_000)),
        avgScore7:  avg(sessions7.map(s => calculate(s, null))),
        avgScore30: avg(sessions30.map(s => calculate(s, null))),
        avgDeepPct: avg(sessions30.map(deepPct)) * 100,
        avgRemPct:  avg(sessions30.map(remPct))  * 100,
        avgCorePct: avg(sessions30.map(corePct)) * 100,
        streakDays: streak(sessions30),
      });
    }
    load();
  }, []);

  if (!stats) return (
    <AuroraBackground>
      <SafeAreaView style={s.safe}>
        <Text style={s.loading}>{lang === 'he' ? 'טוען...' : 'Loading...'}</Text>
      </SafeAreaView>
    </AuroraBackground>
  );

  return (
    <AuroraBackground>
      <SafeAreaView style={s.safe}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <Text style={s.title}>{t.tabs.statistics}</Text>

          {/* Average hours */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>{lang === 'he' ? 'שעות שינה' : 'Sleep Hours'}</Text>
            <View style={s.row}>
              <StatCard
                value={stats.avgHours7.toFixed(1) + 'h'}
                label={t.stats.avg7}
              />
              <StatCard
                value={stats.avgHours30.toFixed(1) + 'h'}
                label={t.stats.avg30}
              />
            </View>
          </View>

          {/* Score */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>{t.score}</Text>
            <View style={s.row}>
              <StatCard value={Math.round(stats.avgScore7).toString()} label={t.stats.avg7} accent />
              <StatCard value={Math.round(stats.avgScore30).toString()} label={t.stats.avg30} accent />
            </View>
          </View>

          {/* Stage breakdown */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>{lang === 'he' ? 'פירוט שלבים (30 יום)' : 'Stage Breakdown (30d)'}</Text>
            <StageBar label={lang === 'he' ? 'עמוקה' : 'Deep'} pct={stats.avgDeepPct} color="rgba(80,120,220,0.7)" />
            <StageBar label="REM"                              pct={stats.avgRemPct}  color="rgba(60,200,180,0.7)" />
            <StageBar label={lang === 'he' ? 'קלה' : 'Core'}  pct={stats.avgCorePct} color="rgba(140,100,220,0.6)" />
          </View>

          {/* Streak */}
          <View style={s.streakCard}>
            <Text style={s.streakNum}>{stats.streakDays}</Text>
            <Text style={s.streakLabel}>
              {t.stats.streak} {lang === 'he' ? '(7+ שעות)' : '(7+ hrs)'}
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </AuroraBackground>
  );
}

function StatCard({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <View style={s.statCard}>
      <Text style={[s.statVal, accent && s.statValAccent]}>{value}</Text>
      <Text style={s.statLbl}>{label}</Text>
    </View>
  );
}

function StageBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <View style={s.stageRow}>
      <Text style={s.stageLabel}>{label}</Text>
      <View style={s.barBg}>
        <View style={[s.barFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: color }]} />
      </View>
      <Text style={s.stagePct}>{pct.toFixed(0)}%</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1 },
  loading: { fontFamily: 'InstrumentSans_300', fontSize: 14, color: Colors.textMuted, textAlign: 'center', marginTop: 80 },
  scroll:  { padding: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.lg },
  title:   { fontFamily: 'Gloock', fontSize: 28, color: Colors.textPrimary, marginBottom: Spacing.sm },

  section:      { gap: Spacing.sm },
  sectionLabel: { fontFamily: 'InstrumentSans', fontSize: 10, letterSpacing: 2, color: Colors.textMuted, textTransform: 'uppercase' },
  row:          { flexDirection: 'row', gap: Spacing.sm },

  statCard:     { flex: 1, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(60,200,180,0.1)', backgroundColor: 'rgba(60,200,180,0.04)', padding: Spacing.md, alignItems: 'center', gap: 4 },
  statVal:      { fontFamily: 'Gloock', fontSize: 32, color: Colors.textPrimary, letterSpacing: -1 },
  statValAccent:{ color: 'rgba(60,200,180,0.9)' },
  statLbl:      { fontFamily: 'InstrumentSans_300', fontSize: 11, color: Colors.textMuted, letterSpacing: 1 },

  stageRow:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 4 },
  stageLabel: { fontFamily: 'InstrumentSans', fontSize: 11, color: Colors.textSecondary, width: 50 },
  barBg:      { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  barFill:    { height: 6, borderRadius: 3 },
  stagePct:   { fontFamily: 'InstrumentSans', fontSize: 11, color: Colors.textMuted, width: 32, textAlign: 'right' },

  streakCard:  { alignItems: 'center', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(60,200,180,0.15)', backgroundColor: 'rgba(60,200,180,0.06)', padding: Spacing.xl },
  streakNum:   { fontFamily: 'Gloock', fontSize: 56, color: 'rgba(60,200,180,0.9)', letterSpacing: -2, lineHeight: 60 },
  streakLabel: { fontFamily: 'InstrumentSans_300', fontSize: 12, color: Colors.textSecondary, marginTop: 4, letterSpacing: 0.5 },
});
