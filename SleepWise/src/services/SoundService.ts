import { Audio } from 'expo-av';

export const SOUNDS = [
  { id: 'forest_morning', he: 'יער בוקר',   en: 'Forest Morning' },
  { id: 'ocean_waves',    he: 'גלי ים',     en: 'Ocean Waves' },
  { id: 'tibetan_bowls',  he: 'קערות טיבט', en: 'Tibetan Bowls' },
  { id: 'dawn_chimes',    he: 'פעמוני שחר', en: 'Dawn Chimes' },
] as const;

export type SoundId = typeof SOUNDS[number]['id'];

const SOUND_FILES: Record<SoundId, ReturnType<typeof require>> = {
  forest_morning: require('../../assets/sounds/forest_morning.mp3'),
  ocean_waves:    require('../../assets/sounds/ocean_waves.mp3'),
  tibetan_bowls:  require('../../assets/sounds/tibetan_bowls.mp3'),
  dawn_chimes:    require('../../assets/sounds/dawn_chimes.mp3'),
};

const RAMP_DURATION_MS = 90_000;

/** Pure helper — volume at a given elapsed time. Testable without device. */
export const rampedVolume = (elapsedMs: number, maxVolume = 1.0): number => {
  const progress = Math.min(elapsedMs / RAMP_DURATION_MS, 1);
  return 0.1 + progress * (maxVolume - 0.1);
};

let _sound: Audio.Sound | null = null;
let _rampInterval: ReturnType<typeof setInterval> | null = null;

export const SoundService = {
  async play(soundId: SoundId, maxVolume = 1.0) {
    await SoundService.stop();
    await Audio.setAudioModeAsync({
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
    });
    const { sound } = await Audio.Sound.createAsync(SOUND_FILES[soundId] as any, {
      isLooping: true,
      volume: 0.1,
    });
    _sound = sound;
    await sound.playAsync();

    const start = Date.now();
    _rampInterval = setInterval(async () => {
      if (!_sound) { clearInterval(_rampInterval!); return; }
      const vol = rampedVolume(Date.now() - start, maxVolume);
      await _sound.setVolumeAsync(vol);
      if (vol >= maxVolume) clearInterval(_rampInterval!);
    }, 1000);
  },

  async stop() {
    if (_rampInterval) { clearInterval(_rampInterval); _rampInterval = null; }
    if (_sound) {
      await _sound.stopAsync();
      await _sound.unloadAsync();
      _sound = null;
    }
  },
};
