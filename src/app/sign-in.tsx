import { Button, FieldGroup, Host, Text, TextInput } from '@expo/ui';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { StyleSheet, Text as RNText, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth';
import { WaniKaniError } from '@/lib/wanikani/client';
import { groupedBackground } from '@/theme/native';
import { useTheme } from '@/theme';

const NEW_TOKEN_URL = 'https://www.wanikani.com/settings/personal_access_tokens/new';

export default function SignInScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!token.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(token);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(
        e instanceof WaniKaniError && e.isUnauthorized
          ? 'WaniKani didn’t accept that token. Check you copied all of it.'
          : 'Couldn’t reach WaniKani. Check your connection and try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: groupedBackground(theme) }]}>
      <View style={[styles.hero, { paddingTop: insets.top + 48 }]}>
        <RNText style={[styles.glyph, { color: theme.text }]}>蛇</RNText>
        <RNText style={[styles.title, { color: theme.text }]}>Hebiebi</RNText>
        <RNText style={[styles.subtitle, { color: theme.textSecondary }]}>
          An unofficial client for WaniKani
        </RNText>
      </View>

      <Host style={styles.form} seedColor={theme.text}>
        <FieldGroup>
          <FieldGroup.Section title="Personal access token">
            <TextInput
              placeholder="Paste your token"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              onChangeText={setToken}
              onSubmitEditing={submit}
            />
            <FieldGroup.SectionFooter>
              <Text>
                {error ??
                  'WaniKani apps sign in with a token, not your password. Create one with “reviews:create” ticked so your reviews can be saved, then paste it here.'}
              </Text>
            </FieldGroup.SectionFooter>
          </FieldGroup.Section>
          <FieldGroup.Section>
            <Button label={busy ? 'Signing in…' : 'Sign In'} onPress={submit} disabled={busy || !token.trim()} />
            <Button
              variant="text"
              label="Create a token on WaniKani"
              onPress={() => WebBrowser.openBrowserAsync(NEW_TOKEN_URL)}
            />
          </FieldGroup.Section>
        </FieldGroup>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: { alignItems: 'center', paddingBottom: 8, gap: 4 },
  glyph: { fontSize: 88, fontWeight: '300', lineHeight: 104 },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { fontSize: 15 },
  form: { flex: 1 },
});
