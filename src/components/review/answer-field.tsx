import { useEffect, useState, type Ref } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ReturnKeyTypeOptions,
  type TextInputInstance,
} from 'react-native';

/**
 * The answer box. For readings (`kana`), typed romaji shows as kana with no flash of the letters.
 *
 * The flash comes from iOS drawing each keystroke itself before JS can answer it: type "ko" and the
 * field shows "ko" for a frame before the converted "こ" comes back. So for readings the native
 * field's own text is drawn transparent and the converted value is drawn over it, with a caret of
 * our own at the end. The field still owns the text, so backspace, paste, the Japanese keyboard and
 * the return key all behave natively. Romaji still waiting to become kana (the "k" of "ko") is
 * shown faded.
 */
export function AnswerField({
  inputRef,
  value,
  onChangeText,
  onSubmit,
  kana,
  readOnly,
  textColor,
  placeholderColor,
  backgroundColor,
  placeholder,
  returnKeyType,
  accessibilityLabel,
}: {
  inputRef: Ref<TextInputInstance>;
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  kana: boolean;
  /** Showing a graded answer: no caret, input ignored, but the keyboard stays up. */
  readOnly: boolean;
  textColor: string;
  placeholderColor: string;
  backgroundColor: string;
  placeholder: string;
  returnKeyType: ReturnKeyTypeOptions;
  accessibilityLabel: string;
}) {
  const [focused, setFocused] = useState(false);
  const masked = kana && value.length > 0;
  const pending = masked ? (/[a-z]+$/i.exec(value)?.[0] ?? '') : '';
  const settled = masked ? value.slice(0, value.length - pending.length) : '';

  return (
    <View style={[styles.wrap, { backgroundColor }]}>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        submitBehavior="submit"
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        autoComplete="off"
        returnKeyType={returnKeyType}
        placeholder={placeholder}
        placeholderTextColor={placeholderColor}
        caretHidden={masked || readOnly}
        selectionColor={masked ? 'transparent' : textColor}
        style={[styles.input, { color: masked ? 'transparent' : textColor }]}
        textAlign="center"
        accessibilityLabel={accessibilityLabel}
      />
      {masked ? (
        <View pointerEvents="none" style={styles.overlay} accessibilityElementsHidden>
          <Text style={[styles.text, { color: textColor }]} numberOfLines={1}>
            {settled}
            {pending ? <Text style={styles.pending}>{pending}</Text> : null}
          </Text>
          {/* Always there, only hidden, so the centred text doesn't jump sideways when it goes. */}
          {focused && !readOnly ? <Caret color={textColor} /> : <View style={styles.caret} />}
        </View>
      ) : null}
    </View>
  );
}

function Caret({ color }: { color: string }) {
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    const blink = Animated.loop(
      Animated.sequence([
        Animated.delay(500),
        Animated.timing(opacity, { toValue: 0, duration: 80, useNativeDriver: true }),
        Animated.delay(420),
        Animated.timing(opacity, { toValue: 1, duration: 80, useNativeDriver: true }),
      ]),
    );
    blink.start();
    return () => blink.stop();
  }, [opacity]);
  return <Animated.View style={[styles.caret, { backgroundColor: color, opacity }]} />;
}

const FONT_SIZE = 24;

const styles = StyleSheet.create({
  wrap: { borderRadius: 30 },
  input: { fontSize: FONT_SIZE, paddingVertical: 14, paddingHorizontal: 24, minHeight: 60 },
  overlay: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  text: { fontSize: FONT_SIZE, flexShrink: 1 },
  pending: { opacity: 0.4 },
  caret: { width: 2, height: FONT_SIZE + 4, borderRadius: 1, marginLeft: 1 },
});
