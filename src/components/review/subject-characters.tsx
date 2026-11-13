import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import type { Subject } from '@/lib/wanikani/types';

function fontSizeFor(length: number, base: number) {
  if (length <= 2) return base;
  if (length <= 4) return base * 0.75;
  if (length <= 6) return base * 0.58;
  return base * 0.45;
}

/** The subject's characters, or for an image-only radical, its SVG tinted to the text colour. */
export function SubjectCharacters({ subject, color, size = 96 }: { subject: Subject; color: string; size?: number }) {
  const { characters } = subject.data;
  if (characters) {
    return (
      <Text
        style={[styles.text, { color, fontSize: fontSizeFor(characters.length, size), lineHeight: undefined }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        accessibilityLanguage="ja">
        {characters}
      </Text>
    );
  }
  const image =
    subject.object === 'radical'
      ? (subject.data.character_images.find((i) => i.content_type === 'image/svg+xml') ??
        subject.data.character_images[0])
      : undefined;
  if (!image) return <Text style={[styles.text, { color, fontSize: size }]}>?</Text>;
  return (
    <View accessibilityLabel={subject.data.meanings[0]?.meaning}>
      <Image source={{ uri: image.url }} style={{ width: size, height: size }} tintColor={color} contentFit="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  text: { fontWeight: '400', textAlign: 'center' },
});
