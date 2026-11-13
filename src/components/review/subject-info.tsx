import * as WebBrowser from 'expo-web-browser';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { playAudio, pronunciations } from '@/lib/audio';
import type { AnySubjectData, Reading, Subject } from '@/lib/wanikani/types';
import { spacing, useTheme } from '@/theme';

import { Markup } from './markup';

const READING_TYPES: { type: NonNullable<Reading['type']>; label: string }[] = [
  { type: 'onyomi', label: 'On’yomi' },
  { type: 'kunyomi', label: 'Kun’yomi' },
  { type: 'nanori', label: 'Nanori' },
];

/**
 * What the item teaches, shown after an answer. Only the parts already asked are revealed: seeing
 * the reading before being asked for it would give the answer away.
 */
export function SubjectInfo({
  subject,
  synonyms,
  showMeaning,
  showReading,
}: {
  subject: Subject;
  synonyms: string[];
  showMeaning: boolean;
  showReading: boolean;
}) {
  const theme = useTheme();
  const data = subject.data as AnySubjectData;
  const readings = data.readings ?? [];
  const audios = pronunciations(subject);
  const primaryMeaning = data.meanings.find((m) => m.primary)?.meaning;
  const otherMeanings = [
    ...data.meanings.filter((m) => !m.primary).map((m) => m.meaning),
    ...data.auxiliary_meanings.filter((m) => m.type === 'whitelist').map((m) => m.meaning),
  ];

  return (
    <View style={styles.root}>
      {showMeaning ? (
        <Section title="Meaning">
          <Text style={[styles.answer, { color: theme.text }]}>{primaryMeaning}</Text>
          {otherMeanings.length ? (
            <Text style={[styles.secondary, { color: theme.textSecondary }]}>{otherMeanings.join(', ')}</Text>
          ) : null}
          {synonyms.length ? (
            <Text style={[styles.secondary, { color: theme.textSecondary }]}>
              Your synonyms: {synonyms.join(', ')}
            </Text>
          ) : null}
          {data.parts_of_speech?.length ? (
            <Text style={[styles.secondary, { color: theme.textSecondary }]}>{data.parts_of_speech.join(' · ')}</Text>
          ) : null}
          <Markup text={data.meaning_mnemonic} />
          {data.meaning_hint ? <Hint text={data.meaning_hint} /> : null}
        </Section>
      ) : null}

      {showReading && readings.length ? (
        <Section title="Reading">
          {subject.object === 'kanji' ? (
            READING_TYPES.map(({ type, label }) => {
              const ofType = readings.filter((r) => r.type === type);
              if (!ofType.length) return null;
              const taught = ofType.some((r) => r.primary);
              return (
                <View key={type} style={styles.readingRow}>
                  <Text style={[styles.readingLabel, { color: theme.textSecondary }]}>{label}</Text>
                  <Text
                    style={[styles.readingValue, { color: taught ? theme.text : theme.textSecondary }]}
                    accessibilityLanguage="ja">
                    {ofType.map((r) => r.reading).join('、')}
                  </Text>
                </View>
              );
            })
          ) : (
            <Text style={[styles.answer, { color: theme.text }]} accessibilityLanguage="ja">
              {readings.map((r) => r.reading).join('、')}
            </Text>
          )}
          {audios.length ? (
            <View style={styles.audioRow}>
              {audios.map((a) => (
                <Pressable
                  key={a.url}
                  onPress={() => playAudio(a.url)}
                  style={({ pressed }) => [styles.audioButton, { borderColor: theme.border, opacity: pressed ? 0.6 : 1 }]}>
                  <Text style={[styles.audioText, { color: theme.text }]}>
                    ▶︎ {a.metadata.voice_actor_name} ({a.metadata.gender === 'female' ? '♀' : '♂'})
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {data.reading_mnemonic ? <Markup text={data.reading_mnemonic} /> : null}
          {data.reading_hint ? <Hint text={data.reading_hint} /> : null}
        </Section>
      ) : null}

      {showMeaning && showReading && data.context_sentences?.length ? (
        <Section title="Context">
          {data.context_sentences.slice(0, 3).map((s, i) => (
            <View key={i} style={styles.sentence}>
              <Text style={[styles.sentenceJa, { color: theme.text }]} accessibilityLanguage="ja">
                {s.ja}
              </Text>
              <Text style={[styles.secondary, { color: theme.textSecondary }]}>{s.en}</Text>
            </View>
          ))}
        </Section>
      ) : null}

      <Pressable onPress={() => WebBrowser.openBrowserAsync(data.document_url)}>
        <Text style={[styles.link, { color: theme.textSecondary }]}>View on WaniKani ↗</Text>
      </Pressable>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{title}</Text>
      {children}
    </View>
  );
}

function Hint({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.hint, { backgroundColor: theme.surface }]}>
      <Text style={[styles.hintLabel, { color: theme.textSecondary }]}>Hint</Text>
      <Markup text={text} style={{ fontSize: 15, lineHeight: 22 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.lg, paddingBottom: spacing.xl },
  section: { gap: spacing.sm },
  sectionTitle: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  answer: { fontSize: 22, fontWeight: '600' },
  secondary: { fontSize: 15 },
  readingRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.md },
  readingLabel: { width: 76, fontSize: 13, fontWeight: '600' },
  readingValue: { fontSize: 20, flexShrink: 1 },
  audioRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  audioButton: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  audioText: { fontSize: 14, fontWeight: '500' },
  hint: { borderRadius: 12, padding: spacing.md, gap: 4 },
  hintLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  sentence: { gap: 2 },
  sentenceJa: { fontSize: 17, lineHeight: 26 },
  link: { fontSize: 15, fontWeight: '500' },
});
