import { useEffect, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AuroraBackground } from '../../components/ui/AuroraBackground';
import { SleepGraph } from '../../components/ui/SleepGraph';
import { Colors, Spacing } from '../../src/design/tokens';
import { i18n } from '../../src/i18n';
import { SleepSession, totalSleepMs } from '../../src/models/SleepSession';
import { calculate } from '../../src/engine/SleepScore';
import { HealthKitService } from '../../src/services/HealthKitService';

type Period = 'weekly' | 'monthly';

const DAY_NAMES_HE = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
const DAY_NAMES_EN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function scoreColor(score: number): string {
  if (score >= 80) return 'rgba(60,200,180,0.7)';
  if (score >= 60) return 'rgba(180,200,60,0.6)';
  return 'rgba(200,80,60,0.55)';
}

export default function HistoryScreen() {
  const t = i18n.t();
  const lang = i18n.lang();
  const [period, setPeriod] = useState<Period>('weekly');
  const [sessions, setSessions] = useState<SleepSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const days = period === 'weekly' ? 7 : 30;
      const data = await HealthKitService.fetchSessions(
        Date.now() - days * 86_400_000,
        Date.now(),
      );
      setSessions(data.reverse()); // newest first
      setLoading(false);
    }
    load();
  }, [period]);

  const fmtHours = (ms: number) => `${(ms / 3_600_000).toFixed(1)}h`;
  const fmtDate  = (ms: number) => {
    const d = new Date(ms);
    const names = lang === 'he' ? DAY_NAMES_HE : DAY_NAMES_EN;
    return `${names[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
  };

  return (
    <AuroraBackground>
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <Text style={s.title}>{t.tabs.history}</Text>
          <View style={s.toggle}>
            {(['weekly', 'monthly'] as Period[]).map(p => (
              <Pressable
                key={p}
                onPress={() => setPeriod(p)}
                style={[s.toggleBtn, period === p && s.toggleActive]}
              >
                <Text style={[s.toggleTxt, period === p && s.toggleActiveTxt]}>
                  {p === 'weekly' ? t.history.weekly : t.history.monthly}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
          {loading && (
            <Text style={s.empty}>{lang === 'he' ? 'טוען...' : 'Loading...'}</Text>
          )}
          {!loading && sessions.length === 0 && (
            <Text style={s.empty}>{lang === 'he' ? 'אין נתוני שינה' : 'No sleep data'}</Text>
          )}
          {sessions.map(session => {
            const score = calculate(session, null);
            const hours = totalSleepMs(session);
            return (
              <View key={session.id} style={s.card}>
                <View style={s.cardTop}>
                  <Text style={s.cardDate}>{fmtDate(session.dateMs)}</Text>
                  <View style={s.cardRight}>
                    <Text style={s.cardHours}>{fmtHours(hours)}</Text>
                    <View style={[s.scoreBadge, { backgroundColor: scoreColor(score) }]}>
                      <Text style={s.scoreTxt}>{score}</Text>
                    </View>
                  </View>
                </View>
                <View style={s.miniGraph}>
                  <SleepGraph entries={session.entries} width={280} height={40} />
                </View>
              </View>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </AuroraBackground>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1 },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.md },
  title:  { fontFamily: 'Gloock', fontSize: 28, color: Colors.textPrimary, marginBottom: Spacing.md },

  toggle:      { flexDirection: 'row', gap: 4, alignSelf: 'flex-start', backgroundColor: 'rgba(60,200,180,0.06)', borderRadius: 20, padding: 3 },
  toggleBtn:   { paddingVertical: 6, paddingHorizontal: Spacing.md, borderRadius: 16 },
  toggleActive: { backgroundColor: 'rgba(60,200,180,0.15)', borderWidth: 1, borderColor: 'rgba(60,200,180,0.3)' },
  toggleTxt:       { fontFamily: 'InstrumentSans', fontSize: 12, color: Colors.textMuted },
  toggleActiveTxt: { color: Colors.teal },

  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.sm },
  empty: { fontFamily: 'InstrumentSans_300', fontSize: 14, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.xxl },

  card:    { borderRadius: 16, borderWidth: 1, borderColor: 'rgba(60,200,180,0.1)', backgroundColor: 'rgba(60,200,180,0.04)', padding: Spacing.md, gap: Spacing.sm },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardDate:  { fontFamily: 'InstrumentSans', fontSize: 13, color: Colors.textSecondary },
  cardRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  cardHours: { fontFamily: 'Gloock', fontSize: 18, color: Colors.textPrimary },
  scoreBadge: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  scoreTxt:   { fontFamily: 'InstrumentSans', fontSize: 11, color: '#fff', fontWeight: '500' },
  miniGraph:  { alignItems: 'center' },
});
