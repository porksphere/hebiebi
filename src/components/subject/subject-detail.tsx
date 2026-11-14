import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { playAudio, pronunciations } from '@/lib/audio';
import { stageName } from '@/lib/srs';
import {
  useMnemonicImage,
  usePatternsOfUse,
  useSubjectProgress,
  useSubjects,
  type SubjectProgress,
} from '@/lib/wanikani/queries';
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

      {showMeaning ? <MeaningSection subject={subject} progress={progress.data} /> : null}
      {showReading && readings.length ? <ReadingSection subject={subject} progress={progress.data} /> : null}

      {componentIds.length ? (
        <Section title={subject.object === 'kanji' ? 'Radicals' : 'Kanji'} type={subject.object === 'kanji' ? 'radical' : 'kanji'}>
          {components.data ? <SubjectTileGrid subjects={components.data} showReading={showReading} /> : <Placeholder />}
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

      {/* Their English gives the meaning away, so like context sentences they wait until both are known. */}
      {showMeaning && showReading ? <PatternsOfUse subject={subject} /> : null}

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

      {assignment?.unlocked_at && progress.data ? <ProgressSection progress={progress.data} /> : null}

      <Pressable onPress={() => WebBrowser.openBrowserAsync(data.document_url)}>
        <Text style={[styles.link, { color: theme.textSecondary }]}>Open on WaniKani ↗</Text>
      </Pressable>
    </View>
  );
}

function MeaningSection({ subject, progress }: { subject: Subject; progress: SubjectProgress | undefined }) {
  const theme = useTheme();
  const data = subject.data as AnySubjectData;
  const alternatives = [
    ...data.meanings.filter((m) => !m.primary).map((m) => m.meaning),
    ...data.auxiliary_meanings.filter((m) => m.type === 'whitelist').map((m) => m.meaning),
  ];
  const synonyms = progress?.material?.meaning_synonyms ?? [];
  return (
    <Section title={subject.object === 'radical' ? 'Name' : 'Meaning'}>
      {alternatives.length ? (
        <Text style={[styles.secondary, { color: theme.textSecondary }]}>Also: {alternatives.join(', ')}</Text>
      ) : null}
      {data.parts_of_speech?.length ? (
        <Text style={[styles.secondary, { color: theme.textSecondary }]}>{data.parts_of_speech.join(' · ')}</Text>
      ) : null}
      <Markup text={data.meaning_mnemonic} />
      <MnemonicIllustration subject={subject} />
      {data.meaning_hint ? <Hint text={data.meaning_hint} /> : null}
      {/* Yours, editable, once it's known whether there's anything saved. */}
      {progress ? (
        <View style={styles.mine}>
          <Mine
            label="Your synonyms"
            value={synonyms.length ? synonyms.join(', ') : null}
            onEdit={() => editMine(subject.id, 'synonyms')}
          />
          <Mine label="Your note" value={progress.material?.meaning_note ?? null} onEdit={() => editMine(subject.id, 'meaning_note')} />
        </View>
      ) : null}
    </Section>
  );
}

function ReadingSection({ subject, progress }: { subject: Subject; progress: SubjectProgress | undefined }) {
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
                {a.metadata.voice_description ? (
                  <Text style={{ color: theme.textSecondary, fontWeight: '400' }}> {a.metadata.voice_description}</Text>
                ) : null}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {data.reading_mnemonic ? <Markup text={data.reading_mnemonic} /> : null}
      {data.reading_hint ? <Hint text={data.reading_hint} /> : null}
      {progress ? (
        <View style={styles.mine}>
          <Mine label="Your note" value={progress.material?.reading_note ?? null} onEdit={() => editMine(subject.id, 'reading_note')} />
        </View>
      ) : null}
    </Section>
  );
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });

/** Where the user is with this item, and how their answers have gone, as on WaniKani's item page. */
function ProgressSection({ progress }: { progress: SubjectProgress }) {
  const theme = useTheme();
  const { assignment, stats } = progress;
  if (!assignment) return null;
  const started = !!assignment.started_at;
  const next = assignment.burned_at
    ? 'Burned'
    : !started
      ? 'After its lesson'
      : assignment.available_at
        ? new Date(assignment.available_at) <= new Date()
          ? 'Now'
          : new Date(assignment.available_at).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
        : '—';
  const rows: [string, string][] = [
    ['Stage', started ? stageName(assignment.srs_stage) : 'Lesson waiting'],
    ['Next review', next],
  ];
  const dates: [string, string | null][] = [
    ['Unlocked', assignment.unlocked_at],
    ['Started', assignment.started_at],
    ['Passed', assignment.passed_at],
    ['Burned', assignment.burned_at],
    ['Brought back', assignment.resurrected_at],
  ];
  for (const [label, date] of dates) if (date) rows.push([label, formatDate(date)]);

  // Per part: right and wrong so far, and the run of right answers (with the longest).
  const parts: [string, number, number, number, number][] = [];
  if (stats && stats.meaning_correct + stats.meaning_incorrect > 0) {
    parts.push(['Meaning', stats.meaning_correct, stats.meaning_incorrect, stats.meaning_current_streak, stats.meaning_max_streak]);
  }
  if (stats && stats.reading_correct + stats.reading_incorrect > 0) {
    parts.push(['Reading', stats.reading_correct, stats.reading_incorrect, stats.reading_current_streak, stats.reading_max_streak]);
  }

  return (
    <Section title="Your progress">
      {rows.map(([label, value]) => (
        <Row key={label} label={label} value={value} />
      ))}
      {parts.length ? (
        <View style={[styles.stats, { borderTopColor: theme.border }]}>
          {parts.map(([label, right, wrong, streak, best]) => (
            <View key={label} style={styles.statBlock}>
              <Text style={[styles.statTitle, { color: theme.textSecondary }]}>{label}</Text>
              <Text style={[styles.statValue, { color: theme.text }]}>
                {Math.round((right / (right + wrong)) * 100)}%
              </Text>
              <Text style={[styles.statDetail, { color: theme.textSecondary }]}>
                {right} right · {wrong} wrong{'\n'}Streak {streak} · best {best}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </Section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.progressRow}>
      <Text style={[styles.secondary, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.secondary, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

type MineField = 'synonyms' | 'meaning_note' | 'reading_note';

function editMine(id: number, field: MineField) {
  router.push({ pathname: '/subject/edit', params: { id: String(id), field } });
}

/** One of the user's own additions: what's saved (or nothing yet), and a way to change it. */
function Mine({ label, value, onEdit }: { label: string; value: string | null; onEdit: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onEdit}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value ?? 'none'}. ${value ? 'Edit' : 'Add'}`}
      style={({ pressed }) => [styles.mineRow, { borderTopColor: theme.border, opacity: pressed ? 0.6 : 1 }]}>
      <View style={styles.mineText}>
        <Text style={[styles.mineLabel, { color: theme.textSecondary }]}>{label}</Text>
        {value ? <Text style={[styles.body, { color: theme.text }]}>{value}</Text> : null}
      </View>
      <Text style={[styles.mineAction, { color: theme.text }]}>{value ? 'Edit' : 'Add'}</Text>
    </Pressable>
  );
}

/**
 * A word's Patterns of Use, from its WaniKani page: the ways it's commonly used (大人に〜, 大人の〜, …),
 * one picked at a time, with that pattern's common word combinations underneath.
 */
function PatternsOfUse({ subject }: { subject: Subject }) {
  const theme = useTheme();
  const { data: patterns } = usePatternsOfUse(subject);
  const [picked, setPicked] = useState(0);
  if (!patterns?.length) return null;
  const current = patterns[Math.min(picked, patterns.length - 1)];
  return (
    <Section title={patterns.length === 1 ? 'Pattern of use' : 'Patterns of use'}>
      <View style={styles.patterns} accessibilityRole="tablist">
        {patterns.map((p, i) => {
          const on = p === current;
          return (
            <Pressable
              key={p.pattern}
              onPress={() => setPicked(i)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={[styles.pattern, { backgroundColor: on ? theme.inverseBackground : theme.surface }]}>
              <Text style={[styles.patternText, { color: on ? theme.inverseText : theme.text }]} accessibilityLanguage="ja">
                {p.pattern}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {current.combinations.map((c, i) => (
        <View key={i} style={styles.sentence}>
          <Text style={[styles.sentenceJa, { color: theme.text }]} accessibilityLanguage="ja">
            {c.ja}
          </Text>
          <Text style={[styles.secondary, { color: theme.textSecondary }]}>{c.en}</Text>
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
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  stats: { flexDirection: 'row', gap: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm, marginTop: spacing.xs },
  statBlock: { flex: 1, gap: 2 },
  statTitle: { fontSize: 13, fontWeight: '600' },
  statValue: { fontSize: 22, fontWeight: '600', fontVariant: ['tabular-nums'] },
  statDetail: { fontSize: 13, lineHeight: 18, fontVariant: ['tabular-nums'] },
  mine: { marginTop: spacing.xs },
  mineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: spacing.sm + 2 },
  mineText: { flex: 1, gap: 2 },
  mineLabel: { fontSize: 13, fontWeight: '600' },
  mineAction: { fontSize: 15, fontWeight: '600' },
  patterns: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pattern: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  patternText: { fontSize: 15 },
  placeholder: { height: 76, borderRadius: 14 },
  illustration: { borderRadius: 16, padding: spacing.md, alignSelf: 'center', width: '80%', maxWidth: 320 },
  link: { fontSize: 15, fontWeight: '500' },
});
