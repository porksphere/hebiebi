import { router, Stack } from 'expo-router';
import { useDeferredValue, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Glyph } from '@/components/subject/subject-characters';
import { TypeDot } from '@/components/subject/type-dot';
import { searchSubjects, type SearchEntry } from '@/lib/wanikani/search-index';
import { useSearchIndex } from '@/lib/wanikani/queries';
import type { SubjectType } from '@/lib/wanikani/types';
import { spacing, useGutters, useTheme } from '@/theme';

const TYPE_NAMES: Record<SubjectType, string> = {
  radical: 'Radical',
  kanji: 'Kanji',
  vocabulary: 'Vocabulary',
  kana_vocabulary: 'Vocabulary',
};

export default function SearchScreen() {
  const theme = useTheme();
  const gutters = useGutters();
  const index = useSearchIndex();
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const results = useMemo(() => (index.data ? searchSubjects(index.data, deferred) : []), [index.data, deferred]);

  const searching = deferred.trim().length > 0;
  let empty: ReactNode = null;
  if (!index.data) {
    empty = index.error ? (
      <Text style={[styles.hint, { color: theme.textSecondary }]}>Couldn’t get the item list from WaniKani.</Text>
    ) : (
      <>
        <ActivityIndicator color={theme.textSecondary} />
        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          Getting every item from WaniKani.{'\n'}This only happens once.
        </Text>
      </>
    );
  } else if (searching) {
    empty = <Text style={[styles.hint, { color: theme.textSecondary }]}>No matches</Text>;
  } else {
    empty = (
      <Text style={[styles.hint, { color: theme.textSecondary }]}>
        Search by meaning, reading or characters.{'\n'}Romaji works too: “mizu”.
      </Text>
    );
  }

  return (
    <>
      <Stack.SearchBar
        placeholder="Meaning, reading or kanji"
        autoCapitalize="none"
        hideWhenScrolling={false}
        onChangeText={(e) => setQuery(e.nativeEvent.text)}
        onCancelButtonPress={() => setQuery('')}
      />
      <FlatList
        style={{ backgroundColor: theme.background }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        data={searching ? results : []}
        keyExtractor={(e) => String(e.id)}
        renderItem={({ item }) => <ResultRow entry={item} />}
        ItemSeparatorComponent={() => (
          <View style={[styles.separator, { backgroundColor: theme.border, marginLeft: gutters.left + 52 + spacing.md }]} />
        )}
        ListEmptyComponent={<View style={styles.empty}>{empty}</View>}
        contentContainerStyle={styles.list}
      />
    </>
  );
}

function ResultRow({ entry }: { entry: SearchEntry }) {
  const theme = useTheme();
  const gutters = useGutters();
  const detail = entry.reading ? `${TYPE_NAMES[entry.type]} · ${entry.reading}` : TYPE_NAMES[entry.type];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${entry.characters ?? ''} ${entry.meaning}, ${detail}, level ${entry.level}`}
      onPress={() => router.push({ pathname: '/subject/[id]', params: { id: String(entry.id) } })}
      style={({ pressed }) => [styles.row, gutters.padding, { opacity: pressed ? 0.5 : 1 }]}>
      <View style={[styles.glyph, { backgroundColor: theme.surface }]}>
        <Glyph characters={entry.characters} imageUrl={entry.imageUrl} color={theme.text} size={26} />
      </View>
      <View style={styles.text}>
        <Text style={[styles.meaning, { color: theme.text }]} numberOfLines={1}>
          {entry.meaning}
        </Text>
        <View style={styles.detailRow}>
          <TypeDot type={entry.type} />
          <Text style={[styles.detail, { color: theme.textSecondary }]} numberOfLines={1}>
            {detail}
          </Text>
        </View>
      </View>
      <Text style={[styles.level, { color: theme.textSecondary }]}>{entry.level}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 120 },
  empty: { paddingTop: 96, paddingHorizontal: spacing.lg, alignItems: 'center', gap: spacing.md },
  hint: { fontSize: 15, textAlign: 'center', lineHeight: 21 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 10 },
  glyph: { minWidth: 52, height: 52, borderRadius: 12, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  meaning: { fontSize: 17 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detail: { fontSize: 14, flexShrink: 1 },
  level: { fontSize: 15, fontVariant: ['tabular-nums'] },
  separator: { height: StyleSheet.hairlineWidth },
});
