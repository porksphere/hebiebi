import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

import type { PronunciationAudio, Subject } from './wanikani/types';

let player: AudioPlayer | null = null;
let modeSet = false;

/** One pronunciation per voice actor, preferring MP3 (what iOS decodes natively). */
export function pronunciations(subject: Subject): PronunciationAudio[] {
  if (subject.object !== 'vocabulary' && subject.object !== 'kana_vocabulary') return [];
  const byActor = new Map<number, PronunciationAudio>();
  for (const audio of subject.data.pronunciation_audios) {
    const id = audio.metadata.voice_actor_id;
    const existing = byActor.get(id);
    if (!existing || (audio.content_type === 'audio/mpeg' && existing.content_type !== 'audio/mpeg')) {
      byActor.set(id, audio);
    }
  }
  return [...byActor.values()];
}

export async function playAudio(url: string) {
  if (!modeSet) {
    // Reviews are deliberate listening; play even with the ringer switch off.
    await setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    modeSet = true;
  }
  player?.remove();
  player = createAudioPlayer({ uri: url });
  player.play();
}

export function stopAudio() {
  player?.remove();
  player = null;
}
