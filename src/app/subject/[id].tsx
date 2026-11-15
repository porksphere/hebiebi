import { Stack, useLocalSearchParams, useNavigation } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { HeaderActions } from '@/components/header-actions';
import { SubjectDetail, type HiddenPart } from '@/components/subject/subject-detail';
import { typingInField, useScreenHotkeys } from '@/lib/hotkeys';
import { useSubject } from '@/lib/wanikani/queries';
import type { SubjectType } from '@/lib/wanikani/types';
import { useTheme } from '@/theme';

const TYPE_NAMES: Record<SubjectType, string> = {
  radical: 'Radical',
  kanji: 'Kanji',
  vocabulary: 'Vocabulary',
  kana_vocabulary: 'Vocabulary',
};

export default function SubjectScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { id, hide } = useLocalSearchParams<{ id: string; hide?: string }>();
  const subject = useSubject(Number(id));
  const hidden: HiddenPart = hide === 'meaning' || hide === 'reading' ? hide : undefined;
  /** Closes the whole sheet, however deep into related subjects it has gone. */
  const close = () => navigation.getParent()?.goBack();

  // Desktop: F closes the sheet again, as it opened it from a review; Escape (lib/hotkeys.ts) goes
  // back one page at a time.
  useScreenHotkeys((e) => {
    if (e.key.toLowerCase() !== 'f' || e.metaKey || e.ctrlKey || e.altKey || typingInField()) return;
    e.preventDefault();
    close();
  });

  return (
    <>
      <Stack.Screen options={{ title: subject.data ? TYPE_NAMES[subject.data.object] : '' }} />
      <HeaderActions placement="right" actions={[{ label: 'Done', done: true, onPress: close }]} />
      {subject.data ? (
        <ScrollView style={{ backgroundColor: theme.background }} contentInsetAdjustmentBehavior="automatic">
          <SubjectDetail subject={subject.data} hide={hidden} />
        </ScrollView>
      ) : (
        <View style={[styles.center, { backgroundColor: theme.background }]}>
          {subject.error ? (
            <Text style={{ color: theme.textSecondary, fontSize: 16 }}>Couldn’t load this item.</Text>
          ) : (
            <ActivityIndicator color={theme.textSecondary} />
          )}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
