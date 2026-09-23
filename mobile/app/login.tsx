import { Link, Redirect } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
        <View style={styles.container}>
          <View style={styles.intro}>
            <Text style={styles.eyebrow}>TAKEITESEE</Text>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.description}>
              Sign in with the same email and password you use on TakeItEsee web.
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
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
                autoComplete="current-password"
                secureTextEntry
                placeholder="Your password"
                value={password}
                onChangeText={setPassword}
                style={styles.input}
                editable={!submitting}
                onSubmitEditing={() => void submit()}
              />
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              accessibilityRole="button"
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

          <Text style={styles.footer}>
            Your access token is validated by TakeItEsee server before the app accepts the session.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f7fb' },
  keyboardView: { flex: 1 },
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, gap: 22 },
  intro: { gap: 8 },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 1.6, color: '#5b5b72' },
  title: { fontSize: 32, lineHeight: 38, fontWeight: '800', color: '#171721' },
  description: { fontSize: 16, lineHeight: 24, color: '#555565' },
  card: { gap: 16, padding: 20, borderRadius: 20, backgroundColor: '#ffffff' },
  field: { gap: 7 },
  label: { fontSize: 14, fontWeight: '600', color: '#333342' },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: '#d9d9e3',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#171721',
    backgroundColor: '#ffffff',
  },
  error: { fontSize: 14, lineHeight: 20, color: '#a12626' },
  button: {
    minHeight: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#30304a',
    paddingHorizontal: 18,
  },
  buttonPressed: { opacity: 0.82 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  exploreLink: { textAlign: 'center', fontSize: 15, fontWeight: '700', color: '#30304a' },
  footer: { fontSize: 12, lineHeight: 18, color: '#77778a' },
});
