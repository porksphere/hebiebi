import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  type TextInputInstance,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toKana } from 'wanakana';

import { AnswerField } from '@/components/review/answer-field';
import { SessionSummary } from '@/components/review/session-summary';
import { SubjectCharacters } from '@/components/subject/subject-characters';
import { playAudio, pronunciations, stopAudio } from '@/lib/audio';
import { sessionStats } from '@/lib/review/session';
import { useReviewSession } from '@/lib/review/use-review-session';
import type { SubjectType } from '@/lib/wanikani/types';
import { spacing, useTheme } from '@/theme';

const TYPE_NAMES: Record<SubjectType, string> = {
  radical: 'Radical',
  kanji: 'Kanji',
  vocabulary: 'Vocabulary',
  kana_vocabulary: 'Vocabulary',
};

export default function ReviewScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const session = useReviewSession();
  const { state, phase } = session;

  const inputRef = useRef<TextInputInstance>(null);
  const [input, setInput] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const shake = useRef(new Animated.Value(0)).current;
  const headerHeight = useHeaderHeight();

  // Coming back from an item's page (a sheet over this screen): the field lost focus to it.
  useFocusEffect(
    useCallback(() => {
      inputRef.current?.focus();
    }, []),
  );

  // The dashboard's counts are stale the moment this screen closes.
  useEffect(
    () => () => {
      stopAudio();
      queryClient.invalidateQueries();
    },
    [queryClient],
  );

  const question = state?.current ?? null;
  const item = question && state ? state.items[question.assignmentId] : null;
  const graded = phase.kind === 'graded' ? phase : null;
  const finished = !!state && !question;

  function runShake() {
    shake.setValue(0);
    Animated.sequence(
      [10, -10, 7, -7, 3, 0].map((toValue) => Animated.timing(shake, { toValue, duration: 45, useNativeDriver: true })),
    ).start();
  }

  function onChangeText(text: string) {
    if (graded) return; // Read-only while showing a result; the keyboard stays up.
    setMessage(null);
    // Romaji → kana as you type. A lone trailing "n" waits, since it may start "na", "ni", ….
    setInput(question?.type === 'reading' ? toKana(text, { IMEMode: true }) : text);
  }

  function onSubmit() {
    if (graded) return goNext();
    if (!item || !question) return;
    const result = session.submit(input);
    if (!result) return;
    if (result.kind === 'retry') {
      if (result.message) setMessage(result.message);
      runShake();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    if (question.type === 'reading') setInput(toKana(input.trim()));
    if (result.kind === 'correct') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setMessage(result.exact ? null : `Close enough — it’s “${result.matched}”.`);
      if (question.type === 'reading' && session.autoplayAudio) {
        const audio = pronunciations(item.subject)[0];
        if (audio) playAudio(audio.url);
      }
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setMessage(null);
    }
  }

  function goNext() {
    session.next();
    setInput('');
    setMessage(null);
    stopAudio();
    inputRef.current?.focus();
  }

  /** The item's page, as a sheet. Keeps back whichever part hasn't been asked yet. */
  function openInfo() {
    if (!item || !question) return;
    const hide =
      question.type === 'meaning' && !item.readingDone
        ? 'reading'
        : question.type === 'reading' && !item.meaningDone
          ? 'meaning'
          : undefined;
    router.push({
      pathname: '/subject/[id]',
      params: { id: String(item.subject.id), ...(hide ? { hide } : {}) },
    });
  }

  function close() {
    const started = state && Object.values(state.items).some(
      (i) => !state.completed.includes(i.assignmentId) && (i.incorrectMeaning || i.incorrectReading || (i.meaningDone && !i.readingDone) || (!i.meaningDone && i.readingDone)),
    );
    if (!started) return router.back();
    Alert.alert('End this session?', 'Finished items are already saved. Items you’ve only partly answered will come back next time.', [
      { text: 'Keep Going', style: 'cancel' },
      { text: 'End Session', style: 'destructive', onPress: () => router.back() },
    ]);
  }

  // --- Non-question states ----------------------------------------------------------------------

  const header = (title: string, withMenu = false) => (
    <>
      <Stack.Screen
        options={{
          title,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
        }}
      />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button icon="xmark" accessibilityLabel="Close" onPress={close} />
      </Stack.Toolbar>
      {withMenu && state ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Menu icon="ellipsis" accessibilityLabel="Session options">
            <Stack.Toolbar.MenuAction
              icon="flag.checkered"
              isOn={state.wrappingUp}
              subtitle="Finish the items in play, then stop"
              onPress={session.toggleWrapUp}>
              Wrap Up
            </Stack.Toolbar.MenuAction>
            <Stack.Toolbar.MenuAction icon="forward" disabled={!!graded} onPress={session.skipQuestion}>
              Skip Question
            </Stack.Toolbar.MenuAction>
          </Stack.Toolbar.Menu>
        </Stack.Toolbar>
      ) : null}
    </>
  );

  if (session.loading || session.error || session.empty) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        {header('Reviews')}
        {session.loading ? (
          <>
            <ActivityIndicator color={theme.textSecondary} />
            <Text style={[styles.centerText, { color: theme.textSecondary }]}>Getting your reviews…</Text>
          </>
        ) : session.error ? (
          <>
            <Text style={[styles.centerText, { color: theme.text }]}>Couldn’t load your reviews.</Text>
            <Pressable onPress={() => session.retryLoad()} style={[styles.pill, { borderColor: theme.border }]}>
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600' }}>Try Again</Text>
            </Pressable>
          </>
        ) : (
          <Text style={[styles.centerText, { color: theme.text }]}>No reviews right now. Nice.</Text>
        )}
      </View>
    );
  }

  if (finished && state) {
    return (
      <>
        {header('Session Complete')}
        <SessionSummary
          state={state}
          endingStages={session.endingStages}
          unsent={session.unsent}
          onRetrySync={session.sync}
          onDone={() => router.back()}
        />
      </>
    );
  }

  if (!state || !item || !question) return null;

  // --- Question -------------------------------------------------------------------------------

  const stats = sessionStats(state);
  const isReading = question.type === 'reading';
  const typeName = TYPE_NAMES[item.subject.object];
  const partName = isReading ? 'Reading' : item.subject.object === 'radical' ? 'Name' : 'Meaning';

  const inputBg = graded ? (graded.correct ? theme.correct : theme.incorrect) : theme.surface;
  const inputFg = graded ? '#FFFFFF' : theme.text;

  return (
    // The system keyboard avoidance. It measures itself against its parent, which starts below the
    // native header, so the header's height goes in the offset. The home-indicator inset comes off
    // it too, since the content inside already keeps clear of that.
    <KeyboardAvoidingView
      behavior="padding"
      keyboardVerticalOffset={headerHeight - insets.bottom}
      style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={[styles.root, { paddingBottom: insets.bottom }]}>
        {header(state.wrappingUp ? `Wrapping up · ${stats.remaining} left` : `${stats.completed} / ${stats.total}`, true)}

        <View style={styles.hero}>
          <SubjectCharacters subject={item.subject} color={theme.text} size={112} />
        </View>

        <View style={styles.answerArea}>
          {/* What's being asked, kept quiet: the type in grey, the part in the text colour. */}
          <Text style={[styles.label, { color: theme.textSecondary }]}>
            {typeName} <Text style={[styles.labelPart, { color: theme.text }]}>{partName.toLowerCase()}</Text>
          </Text>

          <Animated.View style={{ transform: [{ translateX: shake }] }}>
            <AnswerField
              inputRef={inputRef}
              value={input}
              onChangeText={onChangeText}
              onSubmit={onSubmit}
              kana={isReading}
              readOnly={!!graded}
              textColor={inputFg}
              placeholderColor={theme.textSecondary}
              backgroundColor={inputBg}
              placeholder={isReading ? 'こたえ' : 'Your answer'}
              returnKeyType={graded ? 'next' : 'done'}
              accessibilityLabel={`${typeName} ${partName.toLowerCase()} answer`}
            />
          </Animated.View>

          <View style={styles.feedback}>
            {message ? <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text> : null}
            {graded ? (
              <View style={styles.actions}>
                <ActionButton label="Item Info" onPress={openInfo} />
                <ActionButton label="Next" onPress={goNext} primary />
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function ActionButton({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        primary
          ? { backgroundColor: theme.inverseBackground, borderColor: theme.inverseBackground }
          : { borderColor: theme.border },
        { opacity: pressed ? 0.7 : 1 },
      ]}>
      <Text style={[styles.actionText, { color: primary ? theme.inverseText : theme.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg },
  centerText: { fontSize: 17, textAlign: 'center' },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 10 },

  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },

  answerArea: { padding: spacing.md, paddingTop: 0, gap: spacing.sm },
  label: { fontSize: 14, textAlign: 'center' },
  labelPart: { fontWeight: '600' },
  feedback: { minHeight: 44, gap: spacing.sm },
  message: { fontSize: 15, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1, borderWidth: 1, borderRadius: 999, paddingVertical: 11, alignItems: 'center' },
  actionText: { fontSize: 15, fontWeight: '600' },
});
