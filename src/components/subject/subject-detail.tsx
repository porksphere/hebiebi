import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { playAudio, pronunciations } from '@/lib/audio';
import { stageName } from '@/lib/srs';
import { useMnemonicImage, useSubjectProgress, useSubjects } from '@/lib/wanikani/queries';
import type { AnySubjectData, Reading, Subject, SubjectType } from '@/lib/wanikani/types';
import { spacing, useGutters, useTheme } from '@/theme';

import { Markup } from './markup';
import { SubjectCharacters } from './subject-characters';
import { SubjectTileGrid } from './subject-tile';
import { TypeDot } from './type-dot';

export type HiddenPart = 'meaning' | 'reading' | undefined;

const READING_TYPES: { type: NonNullable<Reading['type']>; label: string }[] = [
  { type: 'onyomi', label: 'On’yomi' },
  { type: 'kunyomi', label: 'Kun’yomi' },
  { type: 'nanori', label: 'Nanori' },
];

/**
 * Everything about one subject. `hide` keeps back a part the user is about to be asked in a review
 * (opening the page mid-review must not give the answer away).
 */
export function SubjectDetail({ subject, hide }: { subject: Subject; hide?: HiddenPart }) {
  const theme = useTheme();
  const gutters = useGutters();
  const data = subject.data as AnySubjectData;
  const showMeaning = hide !== 'meaning';
  const showReading = hide !== 'reading';
  const readings = data.readings ?? [];
  const primaryMeaning = data.meanings.find((m) => m.primary)?.meaning;
  const primaryReading = readings.find((r) => r.primary)?.reading;
  const progress = useSubjectProgress(subject.id);
  const assignment = progress.data?.assignment;

  const componentIds = data.component_subject_ids ?? [];
  const usedInIds = data.amalgamation_subject_ids ?? [];
  const similarIds = data.visually_similar_subject_ids ?? [];
  const components = useSubjects(componentIds);
  const usedIn = useSubjects(usedInIds);
  const similar = useSubjects(similarIds);

  return (
    <View style={[styles.root, gutters.padding]}>
      <View style={styles.hero}>
        <SubjectCharacters subject={subject} color={theme.text} size={104} />
        <Text style={[styles.heroMeaning, { color: theme.text }]}>{showMeaning ? primaryMeaning : '···'}</Text>
        {primaryReading ? (
          <Text style={[styles.heroReading, { color: theme.textSecondary }]} accessibilityLanguage="ja">
            {showReading ? primaryReading : '···'}
          </Text>
        ) : null}
        <View style={styles.heroMetaRow}>
          <TypeDot type={subject.object} />
          <Text style={[styles.heroMeta, { color: theme.textSecondary }]}>
            Level {data.level}
            {assignment?.started_at ? ` · ${stageName(assignment.srs_stage)}` : ''}
          </Text>
        </View>
      </View>

      {showMeaning ? <MeaningSection subject={subject} synonyms={progress.data?.material?.meaning_synonyms ?? []} /> : null}
      {showReading && readings.length ? <ReadingSection subject={subject} /> : null}

      {componentIds.length ? (
        <Section title={subject.object === 'kanji' ? 'Radicals' : 'Kanji'} type={subject.object === 'kanji' ? 'radical' : 'kanji'}>
          {components.data ? <SubjectTileGrid subjects={components.data} /> : <Placeholder />}
        </Section>
      ) : null}

      {/* Hidden mid-review: what a subject appears in (and their meanings) can give it away. */}
      {usedInIds.length && !hide ? (
        <Section
          title={subject.object === 'radical' ? 'Found in kanji' : 'Found in vocabulary'}
          type={subject.object === 'radical' ? 'kanji' : 'vocabulary'}>
          {usedIn.data ? <SubjectTileGrid subjects={usedIn.data} /> : <Placeholder />}
        </Section>
      ) : null}

      {similarIds.length && !hide ? (
        <Section title="Looks like" type="kanji">
          {similar.data ? <SubjectTileGrid subjects={similar.data} /> : <Placeholder />}
        </Section>
      ) : null}

      {showMeaning && showReading && data.context_sentences?.length ? (
        <Section title="Context">
          {data.context_sentences.map((s, i) => (
            <View key={i} style={styles.sentence}>
              <Text style={[styles.sentenceJa, { color: theme.text }]} accessibilityLanguage="ja">
                {s.ja}
              </Text>
              <Text style={[styles.secondary, { color: theme.textSecondary }]}>{s.en}</Text>
            </View>
          ))}
        </Section>
      ) : null}

      {progress.data?.material?.meaning_note && showMeaning ? (
        <Section title="Your meaning note">
          <Text style={[styles.body, { color: theme.text }]}>{progress.data.material.meaning_note}</Text>
        </Section>
      ) : null}
      {progress.data?.material?.reading_note && showReading ? (
        <Section title="Your reading note">
          <Text style={[styles.body, { color: theme.text }]}>{progress.data.material.reading_note}</Text>
        </Section>
      ) : null}

      {assignment?.started_at ? <ProgressSection progress={progress.data!} /> : null}

      <Pressable onPress={() => WebBrowser.openBrowserAsync(data.document_url)}>
        <Text style={[styles.link, { color: theme.textSecondary }]}>Open on WaniKani ↗</Text>
      </Pressable>
    </View>
  );
}

function MeaningSection({ subject, synonyms }: { subject: Subject; synonyms: string[] }) {
  const theme = useTheme();
  const data = subject.data as AnySubjectData;
  const alternatives = [
    ...data.meanings.filter((m) => !m.primary).map((m) => m.meaning),
    ...data.auxiliary_meanings.filter((m) => m.type === 'whitelist').map((m) => m.meaning),
  ];
  return (
    <Section title={subject.object === 'radical' ? 'Name' : 'Meaning'}>
      {alternatives.length ? (
        <Text style={[styles.secondary, { color: theme.textSecondary }]}>Also: {alternatives.join(', ')}</Text>
      ) : null}
      {synonyms.length ? (
        <Text style={[styles.secondary, { color: theme.textSecondary }]}>Your synonyms: {synonyms.join(', ')}</Text>
      ) : null}
      {data.parts_of_speech?.length ? (
        <Text style={[styles.secondary, { color: theme.textSecondary }]}>{data.parts_of_speech.join(' · ')}</Text>
      ) : null}
      <Markup text={data.meaning_mnemonic} />
      <MnemonicIllustration subject={subject} />
      {data.meaning_hint ? <Hint text={data.meaning_hint} /> : null}
    </Section>
  );
}

function ReadingSection({ subject }: { subject: Subject }) {
  const theme = useTheme();
  const data = subject.data as AnySubjectData;
  const readings = data.readings ?? [];
  const audios = pronunciations(subject);
  return (
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
        <Text style={[styles.readingValue, { color: theme.text }]} accessibilityLanguage="ja">
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
                ▶︎ {a.metadata.voice_actor_name}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {data.reading_mnemonic ? <Markup text={data.reading_mnemonic} /> : null}
      {data.reading_hint ? <Hint text={data.reading_hint} /> : null}
    </Section>
  );
}

function ProgressSection({ progress }: { progress: NonNullable<ReturnType<typeof useSubjectProgress>['data']> }) {
  const theme = useTheme();
  const { assignment, stats } = progress;
  if (!assignment) return null;
  const next = assignment.burned_at
    ? 'Burned'
    : assignment.available_at
      ? new Date(assignment.available_at) <= new Date()
        ? 'Now'
        : new Date(assignment.available_at).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })
      : '—';
  const rows: [string, string][] = [
    ['Stage', stageName(assignment.srs_stage)],
    ['Next review', next],
  ];
  if (stats) rows.push(['Answered right', `${stats.percentage_correct}%`]);
  return (
    <Section title="Your progress">
      {rows.map(([label, value]) => (
        <View key={label} style={styles.progressRow}>
          <Text style={[styles.secondary, { color: theme.textSecondary }]}>{label}</Text>
          <Text style={[styles.secondary, { color: theme.text }]}>{value}</Text>
        </View>
      ))}
    </Section>
  );
}

/** A radical's illustration, after its mnemonic as on WaniKani. Renders nothing until it's known. */
function MnemonicIllustration({ subject }: { subject: Subject }) {
  const theme = useTheme();
  const { data: image } = useMnemonicImage(subject);
  if (!image) return null;
  return (
    <View
      // The art is grey line work drawn for a white page, so it keeps a light card in dark mode.
      style={[styles.illustration, { backgroundColor: theme.scheme === 'dark' ? '#ECECEC' : theme.surface }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={image.description}>
      <Image
        source={{ uri: image.url }}
        style={{ width: '100%', aspectRatio: image.aspectRatio }}
        contentFit="contain"
        cachePolicy="disk"
        transition={150}
      />
    </View>
  );
}

/** `type`: the section lists items of one type, so its title gets that type's dot. */
function Section({ title, type, children }: { title: string; type?: SubjectType; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        {type ? <TypeDot type={type} /> : null}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{title}</Text>
      </View>
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

function Placeholder() {
  const theme = useTheme();
  return <View style={[styles.placeholder, { backgroundColor: theme.surface }]} />;
}

const styles = StyleSheet.create({
  root: { gap: spacing.xl, padding: spacing.md, paddingBottom: spacing.xl * 2 },
  hero: { alignItems: 'center', gap: 2, paddingTop: spacing.sm },
  heroMeaning: { fontSize: 24, fontWeight: '600', marginTop: spacing.sm },
  heroReading: { fontSize: 18 },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.xs },
  heroMeta: { fontSize: 13 },
  section: { gap: spacing.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  body: { fontSize: 16, lineHeight: 24 },
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
  progressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  placeholder: { height: 76, borderRadius: 14 },
  illustration: { borderRadius: 16, padding: spacing.md, alignSelf: 'center', width: '80%', maxWidth: 320 },
  link: { fontSize: 15, fontWeight: '500' },
});
