import { Stack, useLocalSearchParams, useNavigation } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SubjectDetail, type HiddenPart } from '@/components/subject/subject-detail';
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

  return (
    <>
      <Stack.Screen options={{ title: subject.data ? TYPE_NAMES[subject.data.object] : '' }} />
      <Stack.Toolbar placement="right">
        {/* Closes the whole sheet, however deep into related subjects it has gone. */}
        <Stack.Toolbar.Button variant="done" onPress={() => navigation.getParent()?.goBack()}>
          Done
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
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
