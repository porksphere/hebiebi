import { useQueryClient } from '@tanstack/react-query';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
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
import { LiftAway, Shine, useArrive, type ShineHandle } from '@/components/review/done-effects';
import { HoldToUndo } from '@/components/review/hold-to-undo';
import { SessionSummary } from '@/components/review/session-summary';
import { SubjectCharacters } from '@/components/subject/subject-characters';
import { playAudio, pronunciations, stopAudio } from '@/lib/audio';
import { haptics } from '@/lib/haptics';
import { correctAnswers, type CheckResult } from '@/lib/review/answer-checker';
import { sessionStats } from '@/lib/review/session';
import { useReviewSession } from '@/lib/review/use-review-session';
import { useAnswerStyle } from '@/lib/answer-style';
import type { Subject, SubjectType } from '@/lib/wanikani/types';
import { blend, spacing, TYPE_COLORS, typeTint, useTheme } from '@/theme';

const TYPE_NAMES: Record<SubjectType, string> = {
  radical: 'Radical',
  kanji: 'Kanji',
  vocabulary: 'Vocabulary',
  kana_vocabulary: 'Vocabulary',
};

export default function ReviewScreen() {
  const theme = useTheme();
  const answerStyle = useAnswerStyle();
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
  const shine = useRef<ShineHandle>(null);
  const arrive = useArrive();
  /** The item just finished, lifting away over the next one (see LiftAway). */
  const [lifting, setLifting] = useState<{ id: number; subject: Subject } | null>(null);
  const endLift = useCallback(() => setLifting(null), []);
  const playArrive = arrive.play;
  const liftingId = lifting?.id;
  useLayoutEffect(() => {
    if (liftingId !== undefined) playArrive();
  }, [liftingId, playArrive]);
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
    // Right, with the item's other part already right: this answer finishes the item.
    const finishes = question.type === 'meaning' ? item.readingDone : item.meaningDone;
    const result = session.submit(input);
    if (!result) return;
    if (result.kind === 'retry') {
      if (result.message) setMessage(result.message);
      runShake();
      haptics.retry();
      return;
    }
    setInput(displayedAnswer(input, question.type));
    setMessage(closeEnough(result));
    if (result.kind === 'correct') {
      if (finishes) {
        haptics.itemDone();
        shine.current?.play();
      } else {
        haptics.correct();
      }
      if (question.type === 'reading' && session.autoplayAudio) {
        const audio = pronunciations(item.subject)[0];
        if (audio) playAudio(audio.url);
      }
    } else {
      haptics.wrong();
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
    // A finished item lifts away as the next one arrives.
    if (graded?.completedItem && item) {
      setLifting({ id: item.assignmentId, subject: item.subject });
    }
    haptics.next();
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

  const header = (
    title: string,
    {
      leading,
      wrapUp = false,
      background = theme.background,
    }: { leading?: 'minimize' | 'close'; wrapUp?: boolean; background?: string } = {},
  ) => (
    <>
      <Stack.Screen
        options={{
          title,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: background },
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

  // Before Enter, the answer carries the item type's WaniKani colour with WaniKani's light/dark cue
  // for what to type: faint for a meaning (English), stronger for a reading (kana), so "what is
  // it?" and "English or kana?" read at a glance. After Enter, green or red. Where that colour
  // goes depends on the answer style chosen in Settings (lib/answer-style.ts).
  const dark = theme.scheme === 'dark';
  const typeColor = TYPE_COLORS[item.subject.object];
  const gradeColor = graded ? (graded.correct ? theme.correct : theme.incorrect) : null;
  const inputBg =
    answerStyle === 'pill'
      ? (gradeColor ?? typeTint(item.subject.object, isReading ? (dark ? 0.42 : 0.36) : dark ? 0.2 : 0.13))
      : 'transparent';
  const inputFg = answerStyle === 'pill' ? (graded ? '#FFFFFF' : theme.text) : (gradeColor ?? theme.text);
  const placeholderFg = theme.textSecondary;
  // Page wash: the whole screen, header included, so solid colours rather than see-through ones.
  const screenBg =
    answerStyle === 'wash'
      ? gradeColor
        ? blend(theme.background, gradeColor, dark ? 0.22 : 0.16)
        : blend(theme.background, typeColor, isReading ? (dark ? 0.24 : 0.16) : dark ? 0.1 : 0.06)
      : theme.background;

  return (
    // The system keyboard avoidance. It measures itself against its parent, which starts below the
    // native header, so the header's height goes in the offset. The home-indicator inset comes off
    // it too, since the content inside already keeps clear of that.
    <KeyboardAvoidingView
      behavior="padding"
      keyboardVerticalOffset={headerHeight - insets.bottom}
      style={[styles.root, { backgroundColor: screenBg }]}>
      <View style={[styles.root, { paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }]}>
        {header(state.wrappingUp ? `Wrapping up · ${stats.remaining} left` : `${stats.completed} / ${stats.total}`, {
          leading: 'minimize',
          wrapUp: true,
          background: screenBg,
        })}

        <View
          style={styles.hero}
          onLayout={__DEV__ ? (e) => logLayout('hero', e.nativeEvent.layout) : undefined}>
          <View style={styles.heroStack}>
            {/* Hold the characters to take back an answer: slow on purpose, so it's never an accident. */}
            <HoldToUndo enabled={!!graded} onUndo={undo} ringColor={theme.surface}>
              <Animated.View style={arrive.style}>
                <SubjectCharacters subject={item.subject} color={theme.text} size={112} />
              </Animated.View>
            </HoldToUndo>
            {lifting ? (
              <LiftAway key={lifting.id} onDone={endLift}>
                <SubjectCharacters subject={lifting.subject} color={theme.text} size={112} />
              </LiftAway>
            ) : null}
            {/* After a miss, the right answer, big, right under the characters. Positioned out of
                the layout so the characters and the answer area don't move. */}
            {correction ? (
              <Text
                style={[
                  styles.correction,
                  { color: theme.text, width: window.width - insets.left - insets.right - spacing.md * 2 },
                ]}
                // One line, shrinking to fit: several long meanings get smaller rather than
                // wrapping down over the answer field.
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.4}
                accessibilityLanguage={isReading ? 'ja' : 'en'}>
                {correction}
              </Text>
            ) : null}
          </View>
        </View>

        <View
          style={styles.answerArea}
          // Development only: logs to Metro whenever the answer area moves or resizes.
          onLayout={__DEV__ ? (e) => logLayout('answer area', e.nativeEvent.layout) : undefined}>
          {/* What's being asked, kept quiet: the type in grey, the part in the text colour. Hidden
              (but still taking its space, so nothing moves) while the right answer is showing,
              which can reach down over it. */}
          <Text
            style={[styles.label, { color: theme.textSecondary, opacity: correction ? 0 : 1 }]}
            accessibilityElementsHidden={!!correction}>
            {answerStyle === 'ink' ? <Text style={{ color: typeColor }}>● </Text> : null}
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
              placeholderColor={placeholderFg}
              backgroundColor={inputBg}
              placeholder={isReading ? 'こたえ' : 'Your answer'}
              returnKeyType={graded ? 'next' : 'done'}
              accessibilityLabel={`${typeName} ${partName.toLowerCase()} answer`}
            />
            {answerStyle === 'underline' ? (
              <View
                style={[
                  styles.underline,
                  {
                    backgroundColor: gradeColor ?? (isReading ? typeColor : typeTint(item.subject.object, 0.45)),
                    height: graded || isReading ? 3 : 1.5,
                  },
                ]}
              />
            ) : null}
            {/* An item done: light sweeps across the green field. (Only the pill has a field.) */}
            {answerStyle === 'pill' ? <Shine ref={shine} radius={30} /> : null}
          </Animated.View>

          <View style={styles.feedback}>
            {/* One line kept for it even when empty, shrinking to fit, so a message never moves anything. */}
            <Text
              style={[styles.message, { color: theme.textSecondary }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}>
              {message ?? ' '}
            </Text>
            {/* Always there, so nothing moves on Enter; they only work once the answer is graded. */}
            <View style={styles.actions}>
              <ActionButton label="Item Info" onPress={openInfo} disabled={!graded} />
              <ActionButton label="Next" onPress={goNext} primary disabled={!graded} />
            </View>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function logLayout(what: string, { y, height }: { y: number; height: number }) {
  console.log(`[review layout] ${what}: y ${y.toFixed(1)}, height ${height.toFixed(1)}`);
}

/** Readings show as kana once graded, even if the last syllable was still romaji. */
function displayedAnswer(answer: string, type: 'meaning' | 'reading' | undefined) {
  return type === 'reading' ? toKana(answer.trim()) : answer;
}

function closeEnough(result: CheckResult) {
  return result.kind === 'correct' && !result.exact ? `Close enough — it’s “${result.matched}”.` : null;
}

/**
 * Disabled (before the answer is graded): an outline only, quiet text. Enabled: filled in, black
 * for Next, grey for Item Info.
 */
function ActionButton({
  label,
  onPress,
  primary,
  disabled,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const fill = disabled ? 'transparent' : primary ? theme.inverseBackground : theme.surfaceStrong;
  const border = disabled ? theme.border : fill;
  const color = disabled ? theme.textSecondary : primary ? theme.inverseText : theme.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      // Not focusable from the keyboard either way, so Enter stays with the answer field.
      focusable={false}
      style={({ pressed }) => [
        styles.action,
        { backgroundColor: fill, borderColor: border, opacity: pressed ? 0.7 : 1 },
      ]}>
      <Text style={[styles.actionText, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg },
  centerText: { fontSize: 17, textAlign: 'center' },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 10 },

  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
  // Centres the lifting characters (absolutely positioned) over the arriving ones.
  heroStack: { alignItems: 'center', justifyContent: 'center' },
  correction: { position: 'absolute', top: '100%', marginTop: spacing.sm, fontSize: 28, fontWeight: '600', textAlign: 'center' },

  answerArea: { padding: spacing.md, paddingTop: 0, gap: spacing.sm },
  label: { fontSize: 14, textAlign: 'center', marginBottom: spacing.sm },
  underline: { marginHorizontal: spacing.sm, borderRadius: 2 },
  labelPart: { fontWeight: '600' },
  feedback: { gap: spacing.sm },
  message: { fontSize: 15, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1, borderWidth: 1, borderRadius: 999, paddingVertical: 11, alignItems: 'center' },
  actionText: { fontSize: 15, fontWeight: '600' },
});
