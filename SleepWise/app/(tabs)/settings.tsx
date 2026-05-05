import { useEffect, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { AuroraBackground } from '../../components/ui/AuroraBackground';
import { Colors, Spacing } from '../../src/design/tokens';
import { i18n, Lang } from '../../src/i18n';
import { AlarmConfig, defaultAlarmConfig } from '../../src/models/AlarmConfig';
import { SOUNDS, SoundId } from '../../src/services/SoundService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ALARM_KEY = 'sw_alarm_config';

export default function SettingsScreen() {
  const [lang, setLang] = useState<Lang>(i18n.lang());
  const t = i18n.t();
  const [config, setConfig] = useState<AlarmConfig>(defaultAlarmConfig());

  useEffect(() => {
    AsyncStorage.getItem(ALARM_KEY).then(raw => {
      if (raw) setConfig(JSON.parse(raw));
    });
  }, []);

  const save = async (c: AlarmConfig) => {
    setConfig(c);
    await AsyncStorage.setItem(ALARM_KEY, JSON.stringify(c));
  };

  const switchLang = async (l: Lang) => {
    await i18n.setLang(l);
    setLang(l);
  };

  return (
    <AuroraBackground>
      <SafeAreaView style={s.safe}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <Text style={s.title}>{t.tabs.settings}</Text>

          {/* Alarm window */}
          <SettingSection label={t.settings.alarmWindow}>
            <View style={s.sliderRow}>
              <Text style={s.sliderVal}>{config.windowMinutes} {lang === 'he' ? 'דק׳' : 'min'}</Text>
              <Slider
                style={{ flex: 1, height: 40 }}
                minimumValue={10}
                maximumValue={90}
                step={5}
                value={config.windowMinutes}
                minimumTrackTintColor="rgba(60,200,180,0.7)"
                maximumTrackTintColor="rgba(60,200,180,0.15)"
                thumbTintColor="rgba(60,200,180,0.9)"
                onValueChange={v => save({ ...config, windowMinutes: v })}
              />
            </View>
          </SettingSection>

          {/* Sound picker */}
          <SettingSection label={t.settings.wakeSound}>
            <View style={s.soundGrid}>
              {SOUNDS.map(sound => (
                <Pressable
                  key={sound.id}
                  onPress={() => save({ ...config, soundId: sound.id })}
                  style={[s.soundBtn, config.soundId === sound.id && s.soundBtnActive]}
                >
                  <Text style={[s.soundTxt, config.soundId === sound.id && s.soundTxtActive]}>
                    {lang === 'he' ? sound.he : sound.en}
                  </Text>
                </Pressable>
              ))}
            </View>
          </SettingSection>

          {/* Volume */}
          <SettingSection label={lang === 'he' ? 'עוצמת השכמה' : 'Alarm Volume'}>
            <View style={s.sliderRow}>
              <Text style={s.sliderVal}>{Math.round(config.maxVolume * 100)}%</Text>
              <Slider
                style={{ flex: 1, height: 40 }}
                minimumValue={0.3}
                maximumValue={1.0}
                step={0.05}
                value={config.maxVolume}
                minimumTrackTintColor="rgba(60,200,180,0.7)"
                maximumTrackTintColor="rgba(60,200,180,0.15)"
                thumbTintColor="rgba(60,200,180,0.9)"
                onValueChange={v => save({ ...config, maxVolume: v })}
              />
            </View>
          </SettingSection>

          {/* Language */}
          <SettingSection label={t.settings.language}>
            <View style={s.langRow}>
              {(['he', 'en'] as Lang[]).map(l => (
                <Pressable
                  key={l}
                  onPress={() => switchLang(l)}
                  style={[s.langBtn, lang === l && s.langBtnActive]}
                >
                  <Text style={[s.langTxt, lang === l && s.langTxtActive]}>
                    {l === 'he' ? 'עברית' : 'English'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </SettingSection>

        </ScrollView>
      </SafeAreaView>
    </AuroraBackground>
  );
}

function SettingSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1 },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.xl },
  title:  { fontFamily: 'Gloock', fontSize: 28, color: Colors.textPrimary },

  section:      { gap: Spacing.sm },
  sectionLabel: { fontFamily: 'InstrumentSans', fontSize: 10, letterSpacing: 2, color: Colors.textMuted, textTransform: 'uppercase' },

  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.xs },
  sliderVal: { fontFamily: 'Gloock', fontSize: 20, color: Colors.textSecondary, width: 52 },

  soundGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  soundBtn:     { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(60,200,180,0.15)', backgroundColor: 'rgba(60,200,180,0.04)' },
  soundBtnActive: { backgroundColor: 'rgba(60,200,180,0.15)', borderColor: 'rgba(60,200,180,0.5)' },
  soundTxt:     { fontFamily: 'InstrumentSans_300', fontSize: 13, color: Colors.textMuted },
  soundTxtActive: { color: Colors.teal, fontFamily: 'InstrumentSans' },

  langRow:     { flexDirection: 'row', gap: Spacing.sm },
  langBtn:     { flex: 1, paddingVertical: Spacing.md, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(60,200,180,0.15)', backgroundColor: 'rgba(60,200,180,0.04)', alignItems: 'center' },
  langBtnActive: { backgroundColor: 'rgba(60,200,180,0.15)', borderColor: 'rgba(60,200,180,0.5)' },
  langTxt:     { fontFamily: 'InstrumentSans_300', fontSize: 14, color: Colors.textMuted },
  langTxtActive: { color: Colors.teal, fontFamily: 'InstrumentSans' },
});
