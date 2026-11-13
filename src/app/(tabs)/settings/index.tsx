import { Button, FieldGroup, Host, Picker, Row, Spacer, Switch, Text } from '@expo/ui';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { Alert } from 'react-native';

import { setAppearance, useAppearance, type AppearanceChoice } from '@/lib/appearance';
import { useAuth } from '@/lib/auth';
import { useUpdatePreferences, useUser } from '@/lib/wanikani/queries';
import { useTheme } from '@/theme';

function InfoRow({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <Row>
      <Text>{label}</Text>
      <Spacer />
      <Text textStyle={{ color: theme.textSecondary }}>{value}</Text>
    </Row>
  );
}

const SUBSCRIPTION_NAMES = { free: 'Free', recurring: 'Subscribed', lifetime: 'Lifetime', unknown: 'Free' };

export default function SettingsScreen() {
  const theme = useTheme();
  const { signOut } = useAuth();
  const { data: user } = useUser();
  const update = useUpdatePreferences();
  const prefs = user?.preferences;
  const appearance = useAppearance();

  function confirmSignOut() {
    Alert.alert('Sign out?', 'Your token will be removed from this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  }

  return (
    <Host style={{ flex: 1 }} seedColor={theme.text}>
      <FieldGroup>
        <FieldGroup.Section title="Account">
          <InfoRow label="Username" value={user?.username ?? '…'} />
          <InfoRow label="Level" value={user ? String(user.level) : '…'} />
          <InfoRow label="Plan" value={user ? SUBSCRIPTION_NAMES[user.subscription.type] : '…'} />
          <InfoRow
            label="Studying since"
            value={user ? new Date(user.started_at).toLocaleDateString([], { year: 'numeric', month: 'short' }) : '…'}
          />
        </FieldGroup.Section>

        {prefs ? (
          <FieldGroup.Section title="Reviews">
            <Switch
              label="Play audio after a correct reading"
              value={prefs.reviews_autoplay_audio}
              onValueChange={(v) => update.mutate({ reviews_autoplay_audio: v })}
            />
            <Row>
              <Text>Order</Text>
              <Spacer />
              <Picker
                selectedValue={prefs.reviews_presentation_order}
                onValueChange={(v) => update.mutate({ reviews_presentation_order: v })}>
                <Picker.Item label="Shuffled" value="shuffled" />
                <Picker.Item label="Lower levels first" value="lower_levels_first" />
              </Picker>
            </Row>
            <FieldGroup.SectionFooter>
              <Text>
                {update.error
                  ? 'Couldn’t save. Changing settings needs a token with “user:update” ticked.'
                  : 'These are your WaniKani preferences, shared with the website.'}
              </Text>
            </FieldGroup.SectionFooter>
          </FieldGroup.Section>
        ) : null}

        <FieldGroup.Section title="Appearance">
          <Row>
            <Text>Theme</Text>
            <Spacer />
            <Picker selectedValue={appearance} onValueChange={(v) => setAppearance(v as AppearanceChoice)}>
              <Picker.Item label="System" value="auto" />
              <Picker.Item label="Light" value="light" />
              <Picker.Item label="Dark" value="dark" />
            </Picker>
          </Row>
        </FieldGroup.Section>

        <FieldGroup.Section title="About">
          <InfoRow label="Version" value={Constants.expoConfig?.version ?? '—'} />
          <Button
            variant="text"
            label="Open WaniKani"
            onPress={() => WebBrowser.openBrowserAsync('https://www.wanikani.com/dashboard')}
          />
          <FieldGroup.SectionFooter>
            <Text>Hebiebi is an unofficial, third-party app. It isn’t made or endorsed by WaniKani or Tofugu.</Text>
          </FieldGroup.SectionFooter>
        </FieldGroup.Section>

        <FieldGroup.Section>
          <Button variant="text" label="Sign Out" onPress={confirmSignOut} />
        </FieldGroup.Section>
      </FieldGroup>
    </Host>
  );
}
