import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  type TextInputInstance,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toKana } from 'wanakana';

import { AnswerField } from '@/components/review/answer-field';
import { confirmEndSession } from '@/components/review/end-session';
import { HoldToUndo } from '@/components/review/hold-to-undo';
import { SessionSummary } from '@/components/review/session-summary';
import { SubjectCharacters } from '@/components/subject/subject-characters';
import { playAudio, pronunciations, stopAudio } from '@/lib/audio';
import { correctAnswers, type CheckResult } from '@/lib/review/answer-checker';
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
  // Coming back to a minimised session that was showing a result: show it again.
  const [input, setInput] = useState(() =>
    phase.kind === 'graded' ? displayedAnswer(phase.answer, state?.current?.type) : '',
  );
  const [message, setMessage] = useState<string | null>(() =>
    phase.kind === 'graded' ? closeEnough(phase.result) : null,
  );
  const shake = useRef(new Animated.Value(0)).current;
  const headerHeight = useHeaderHeight();
  const window = useWindowDimensions();

  // Opening this screen starts a session, or picks up the one that's minimised.
  const { start } = session;
  useEffect(() => start(), [start]);

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

  // A session with nothing left to resume (finished, empty, failed to load) ends when this screen
  // goes, not before, so the summary stays put while the screen slides away.
  // Ending from here works the same way: close first, end once gone.
  const spent = finished || session.empty || !!session.error;
  const spentRef = useRef(spent);
  const endOnLeave = useRef(false);
  useEffect(() => {
    spentRef.current = spent;
  }, [spent]);
  const { end } = session;
  useEffect(
    () => () => {
      if (spentRef.current || endOnLeave.current) end();
    },
    [end],
  );

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
    setInput(displayedAnswer(input, question.type));
    setMessage(closeEnough(result));
    if (result.kind === 'correct') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (question.type === 'reading' && session.autoplayAudio) {
        const audio = pronunciations(item.subject)[0];
        if (audio) playAudio(audio.url);
      }
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      AccessibilityInfo.announceForAccessibility(
        `Incorrect. ${correctAnswers(item.subject, question.type).join(', ')}`,
      );
    }
  }

  function undo() {
    const answer = session.undo();
    if (answer === null) return;
    setInput(answer);
    setMessage(null);
    stopAudio();
    inputRef.current?.focus();
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

  /**
   * Closes the screen. Mid-session that's minimising: the session carries on from the home screen
   * or the tab bar. One with nothing left in it is ended once the screen has gone (below).
   */
  function dismiss() {
    router.back();
  }

  function endSession() {
    confirmEndSession(session, () => {
      endOnLeave.current = true;
      router.back();
    });
  }

  // --- Non-question states ----------------------------------------------------------------------

  const header = (title: string, { leading, wrapUp = false }: { leading?: 'minimize' | 'close'; wrapUp?: boolean } = {}) => (
    <>
      <Stack.Screen
        options={{
          title,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
        }}
      />
      {leading ? (
        <Stack.Toolbar placement="left">
          {leading === 'minimize' ? (
            <Stack.Toolbar.Button icon="chevron.down" accessibilityLabel="Minimize" onPress={dismiss} />
          ) : (
            <Stack.Toolbar.Button icon="xmark" accessibilityLabel="Close" onPress={dismiss} />
          )}
        </Stack.Toolbar>
      ) : null}
      {wrapUp && state ? (
        <Stack.Toolbar placement="right">
          {/* Wrap up: finish the items in play, then stop. The title says so while it's on. */}
          <Stack.Toolbar.Button
            icon="flag.checkered"
            selected={state.wrappingUp}
            accessibilityLabel={state.wrappingUp ? 'Stop wrapping up' : 'Wrap up'}
            onPress={session.toggleWrapUp}
          />
          {/* Ending, beside it: the chevron on the left only puts the session away. */}
          <Stack.Toolbar.Button icon="xmark" accessibilityLabel="End session" onPress={endSession} />
        </Stack.Toolbar>
      ) : null}
    </>
  );

  if (session.loading || session.error || session.empty) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        {header('Reviews', { leading: session.loading ? 'minimize' : 'close' })}
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
        {/* No way out but Done: the session is over, there's nothing to minimise. */}
        {header('Session Complete')}
        <SessionSummary
          state={state}
          endingStages={session.endingStages}
          unsent={session.unsent}
          onRetrySync={session.sync}
          onDone={dismiss}
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

  const correction = graded && !graded.correct ? correctAnswers(item.subject, question.type).join(', ') : null;

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
        {header(state.wrappingUp ? `Wrapping up · ${stats.remaining} left` : `${stats.completed} / ${stats.total}`, {
          leading: 'minimize',
          wrapUp: true,
        })}

        <View style={styles.hero}>
          <View style={styles.heroStack}>
            {/* Hold the characters to take back an answer: slow on purpose, so it's never an accident. */}
            <HoldToUndo enabled={!!graded} onUndo={undo} ringColor={theme.surface}>
              <SubjectCharacters subject={item.subject} color={theme.text} size={112} />
            </HoldToUndo>
            {/* After a miss, the right answer, big, right under the characters. Positioned out of
                the layout so the characters and the answer area don't move. */}
            {correction ? (
              <Text
                style={[styles.correction, { color: theme.text, width: window.width - spacing.md * 2 }]}
                numberOfLines={2}
                adjustsFontSizeToFit
                accessibilityLanguage={isReading ? 'ja' : 'en'}>
                {correction}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.answerArea}>
          {/* What's being asked, kept quiet: the type in grey, the part in the text colour. Hidden
              (but still taking its space, so nothing moves) while the right answer is showing,
              which can reach down over it. */}
          <Text
            style={[styles.label, { color: theme.textSecondary, opacity: correction ? 0 : 1 }]}
            accessibilityElementsHidden={!!correction}>
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

/** Readings show as kana once graded, even if the last syllable was still romaji. */
function displayedAnswer(answer: string, type: 'meaning' | 'reading' | undefined) {
  return type === 'reading' ? toKana(answer.trim()) : answer;
}

function closeEnough(result: CheckResult) {
  return result.kind === 'correct' && !result.exact ? `Close enough — it’s “${result.matched}”.` : null;
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
  heroStack: { alignItems: 'center' },
  correction: { position: 'absolute', top: '100%', marginTop: spacing.sm, fontSize: 28, fontWeight: '600', textAlign: 'center' },

  answerArea: { padding: spacing.md, paddingTop: 0, gap: spacing.sm },
  label: { fontSize: 14, textAlign: 'center' },
  labelPart: { fontWeight: '600' },
  feedback: { minHeight: 44, gap: spacing.sm },
  message: { fontSize: 15, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1, borderWidth: 1, borderRadius: 999, paddingVertical: 11, alignItems: 'center' },
  actionText: { fontSize: 15, fontWeight: '600' },
});
