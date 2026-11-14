import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useKeyboardSpace } from '@/lib/keyboard-space';
import { useReviewSession } from '@/lib/review/use-review-session';
import { useSaveStudyMaterial, useSubjectProgress } from '@/lib/wanikani/queries';
import { spacing, useGutters, useTheme } from '@/theme';

type Field = 'synonyms' | 'meaning_note' | 'reading_note';

const TITLES: Record<Field, string> = {
  synonyms: 'Your Synonyms',
  meaning_note: 'Meaning Note',
  reading_note: 'Reading Note',
};

/** WaniKani's own form stops a synonym at 64 characters. */
const SYNONYM_MAX = 64;

/**
 * Changes the user's own synonyms or a note for an item, saved to WaniKani (study materials). Pushed
 * inside the item sheet. If saving fails the screen stays, with what was typed, and a toast says why.
 */
export default function EditMineScreen() {
  const theme = useTheme();
  const gutters = useGutters();
  const keyboardSpace = useKeyboardSpace();
  const params = useLocalSearchParams<{ id: string; field: string }>();
  const id = Number(params.id);
  const field: Field = params.field === 'meaning_note' || params.field === 'reading_note' ? params.field : 'synonyms';
  const progress = useSubjectProgress(id);
  const save = useSaveStudyMaterial(id);
  const session = useReviewSession();

  const saved = progress.data?.material;
  // What's been typed; until then, what's saved (null while that's still loading).
  const [noteEdit, setNote] = useState<string | null>(null);
  const [synonymsEdit, setSynonyms] = useState<string[] | null>(null);
  const [draft, setDraft] = useState('');
  const loaded = !!progress.data;
  const note = noteEdit ?? (loaded && field !== 'synonyms' ? (saved?.[field] ?? '') : null);
  const synonyms = synonymsEdit ?? (loaded ? (saved?.meaning_synonyms ?? []) : null);

  /** The list as it would be saved, counting a synonym typed but not yet added. */
  function finalSynonyms(list: string[], pending: string) {
    const extra = pending.trim();
    return extra && !list.some((s) => s.toLowerCase() === extra.toLowerCase()) ? [...list, extra] : list;
  }

  function addDraft() {
    if (!synonyms) return;
    setSynonyms(finalSynonyms(synonyms, draft));
    setDraft('');
  }

  // The native Save button can hold on to an old callback, so it reads the latest values from here.
  const latest = useRef({ note, synonyms, draft });
  useEffect(() => {
    latest.current = { note, synonyms, draft };
  });

  const savingRef = useRef(false);
  async function onSave() {
    if (savingRef.current) return;
    const { note: n, synonyms: list, draft: pending } = latest.current;
    savingRef.current = true;
    try {
      if (field === 'synonyms') {
        if (!list) return;
        const next = finalSynonyms(list, pending);
        await save.mutateAsync({ meaning_synonyms: next });
        // A review under way accepts them from the next question on.
        session.updateSynonyms(id, next);
      } else {
        if (n === null) return;
        const trimmed = n.trim();
        await save.mutateAsync({ [field]: trimmed ? trimmed : null });
      }
      router.back();
    } catch {
      // The toast says why; stay put so nothing typed is lost.
    } finally {
      savingRef.current = false;
    }
  }

  const ready = field === 'synonyms' ? synonyms !== null : note !== null;
  const changed =
    field === 'synonyms'
      ? !!synonyms && JSON.stringify(finalSynonyms(synonyms, draft)) !== JSON.stringify(saved?.meaning_synonyms ?? [])
      : note !== null && note.trim() !== (saved?.[field] ?? '');

  return (
    <>
      <Stack.Screen options={{ title: TITLES[field] }} />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button variant="done" disabled={!ready || !changed || save.isPending} onPress={onSave}>
          Save
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      {!ready ? (
        <View style={[styles.center, { backgroundColor: theme.background }]}>
          <ActivityIndicator color={theme.textSecondary} />
        </View>
      ) : field === 'synonyms' ? (
        <ScrollView
          style={{ backgroundColor: theme.background }}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, gutters.padding, { paddingBottom: keyboardSpace + spacing.lg }]}>
          <Text style={[styles.help, { color: theme.textSecondary }]}>
            Answers you want accepted for this item’s meaning, besides WaniKani’s own.
          </Text>
          <View>
            {synonyms!.map((s) => (
              <View key={s} style={[styles.row, { borderBottomColor: theme.border }]}>
                <Text style={[styles.rowText, { color: theme.text }]}>{s}</Text>
                <Pressable
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${s}`}
                  onPress={() => setSynonyms(synonyms!.filter((x) => x !== s))}
                  style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
                  <Text style={[styles.remove, { color: theme.textSecondary }]}>Remove</Text>
                </Pressable>
              </View>
            ))}
            <TextInput
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={addDraft}
              submitBehavior="submit"
              placeholder="Add a synonym"
              placeholderTextColor={theme.textSecondary}
              maxLength={SYNONYM_MAX}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              style={[styles.row, styles.rowText, { color: theme.text, borderBottomColor: theme.border }]}
            />
          </View>
        </ScrollView>
      ) : (
        <View style={[styles.noteWrap, gutters.padding, { backgroundColor: theme.background, paddingBottom: keyboardSpace }]}>
          <TextInput
            value={note!}
            onChangeText={setNote}
            multiline
            autoFocus
            placeholder={field === 'meaning_note' ? 'Anything that helps you remember the meaning' : 'Anything that helps you remember the reading'}
            placeholderTextColor={theme.textSecondary}
            style={[styles.note, { color: theme.text }]}
            textAlignVertical="top"
          />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingTop: spacing.md, gap: spacing.md },
  help: { fontSize: 15, lineHeight: 21 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: { fontSize: 17, flexShrink: 1 },
  remove: { fontSize: 15, fontWeight: '500' },
  noteWrap: { flex: 1, paddingTop: spacing.md },
  note: { flex: 1, fontSize: 17, lineHeight: 24 },
});
