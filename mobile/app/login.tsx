import { Link, Redirect } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLogo } from '../components/BrandLogo';
import { cardShadow, theme } from '../lib/theme';
import { useAuth } from '../providers/AuthProvider';

export default function LoginScreen() {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (auth.status === 'signedIn') return <Redirect href="/home" />;

  const submit = async () => {
    if (submitting || !email.trim() || !password) return;
    setSubmitting(true);
    setError('');

    try {
      await auth.signIn(email, password);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.intro}>
            <View style={styles.brandRow}><BrandLogo /></View>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.description}>
              Find trusted services and manage your bookings with your TakeItEsee account.
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                autoCapitalize="none"
                accessibilityLabel="Email"
                autoComplete="email"
                textContentType="username"
                autoCorrect={false}
                returnKeyType="next"
                keyboardType="email-address"
                placeholder="you@example.com"
                value={email}
                onChangeText={setEmail}
                style={styles.input}
                editable={!submitting}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                autoCapitalize="none"
                accessibilityLabel="Password"
                autoComplete="current-password"
                textContentType="password"
                autoCorrect={false}
                returnKeyType="go"
                secureTextEntry
                placeholder="Your password"
                value={password}
                onChangeText={setPassword}
                style={styles.input}
                editable={!submitting}
                onSubmitEditing={() => void submit()}
              />
            </View>

            {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: submitting || !email.trim() || !password, busy: submitting }}
              disabled={submitting || !email.trim() || !password}
              onPress={() => void submit()}
              style={({ pressed }) => [
                styles.button,
                (pressed || submitting) && styles.buttonPressed,
                (!email.trim() || !password) && styles.buttonDisabled,
              ]}
            >
              {submitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Sign in</Text>}
            </Pressable>
          </View>

          <Link href="/explore" style={styles.exploreLink}>
            Explore services without signing in
          </Link>

          <Text style={styles.footer}>Secure sign-in for your TakeItEsee account.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.white },
  keyboardView: { flex: 1 },
  container: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 28, gap: 22 },
  brandRow: { alignItems: 'center' },
  intro: { gap: 12 },
  title: { textAlign: 'center', fontSize: 32, lineHeight: 38, fontWeight: '900', color: theme.colors.ink },
  description: { textAlign: 'center', fontSize: 16, lineHeight: 24, color: theme.colors.inkMuted },
  card: { gap: 16, padding: 20, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.xl, backgroundColor: theme.colors.surface, ...cardShadow },
  field: { gap: 7 },
  label: { fontSize: 14, fontWeight: '600', color: theme.colors.ink },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: theme.colors.ink,
    backgroundColor: theme.colors.surface,
  },
  error: { fontSize: 14, lineHeight: 20, color: theme.colors.danger },
  button: {
    minHeight: 50,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 18,
  },
  buttonPressed: { opacity: 0.82 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  exploreLink: { textAlign: 'center', fontSize: 15, fontWeight: '800', color: theme.colors.primary },
  footer: { textAlign: 'center', fontSize: 12, lineHeight: 18, color: theme.colors.inkMuted },
});
