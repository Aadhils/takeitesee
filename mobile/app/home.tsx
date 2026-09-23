import { Link, Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MobileNav } from '../components/MobileNav';
import { apiFetch } from '../lib/api';
import { useAuth } from '../providers/AuthProvider';

type HealthResponse = {
  status: string;
  app: string;
  database: string;
  release: string;
};

type HealthState =
  | { state: 'loading' }
  | { state: 'ready'; health: HealthResponse }
  | { state: 'error'; message: string };

export default function HomeScreen() {
  const auth = useAuth();
  const [healthState, setHealthState] = useState<HealthState>({ state: 'loading' });

  useEffect(() => {
    let active = true;

    apiFetch<HealthResponse>('/api/health')
      .then((health) => {
        if (active) setHealthState({ state: 'ready', health });
      })
      .catch((error: unknown) => {
        if (!active) return;
        const message = error instanceof Error ? error.message : 'Unable to reach TakeItEsee API.';
        setHealthState({ state: 'error', message });
      });

    return () => {
      active = false;
    };
  }, []);

  if (auth.status === 'signedOut') return <Redirect href="/login" />;

  if (auth.status === 'loading') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator />
          <Text style={styles.statusText}>Validating your session…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>TAKEITESEE MOBILE</Text>
          <Text style={styles.title}>Your marketplace</Text>
          <Text style={styles.description}>
            Customer access is ready. Explore services now; Provider navigation appears only from server-authoritative roles.
          </Text>
        </View>

        <Link href="/bookings" asChild>
          <Pressable style={styles.journeyCard}>
            <View style={styles.journeyCopy}>
              <Text style={styles.journeyTitle}>My bookings</Text>
              <Text style={styles.journeyText}>Review your service date, provider and current journey status.</Text>
            </View>
            <Text style={styles.journeyArrow}>→</Text>
          </Pressable>
        </Link>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Server-validated identity</Text>
          <Text style={styles.statusText}>User: {auth.identity.userId}</Text>
          <Text style={styles.statusText}>
            Roles: {auth.identity.roles.length ? auth.identity.roles.join(', ') : 'No roles returned'}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Backend connection</Text>
          {healthState.state === 'loading' ? (
            <View style={styles.statusRow}>
              <ActivityIndicator />
              <Text style={styles.statusText}>Checking production API…</Text>
            </View>
          ) : null}
          {healthState.state === 'ready' ? (
            <View style={styles.statusList}>
              <Text style={styles.statusText}>App: {healthState.health.app}</Text>
              <Text style={styles.statusText}>Database: {healthState.health.database}</Text>
              <Text style={styles.releaseText}>Release: {healthState.health.release}</Text>
            </View>
          ) : null}
          {healthState.state === 'error' ? <Text style={styles.errorText}>{healthState.message}</Text> : null}
        </View>

        <View style={styles.spacer} />
        <Text style={styles.footer}>Native Contract v1 · Finance HOLD · Recurrence FROZEN</Text>
        <MobileNav />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f7fb' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  screen: { flex: 1, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 10, gap: 14 },
  header: { gap: 8 },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 1.6, color: '#5b5b72' },
  title: { fontSize: 32, lineHeight: 38, fontWeight: '800', color: '#171721' },
  description: { fontSize: 16, lineHeight: 24, color: '#555565' },
  journeyCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, borderRadius: 18, backgroundColor: '#30304a' },
  journeyCopy: { flex: 1, gap: 4 },
  journeyTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },
  journeyText: { fontSize: 14, lineHeight: 20, color: '#dedee9' },
  journeyArrow: { fontSize: 24, fontWeight: '800', color: '#fff' },
  card: { padding: 18, borderRadius: 18, backgroundColor: '#ffffff', gap: 12 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#171721' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusList: { gap: 6 },
  statusText: { fontSize: 15, color: '#333342' },
  releaseText: { fontSize: 13, color: '#77778a' },
  errorText: { fontSize: 14, color: '#a12626' },
  spacer: { flex: 1 },
  footer: { fontSize: 12, lineHeight: 18, color: '#7a7a8c' },
});
