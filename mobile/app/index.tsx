import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { apiFetch } from '../lib/api';

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.eyebrow}>TAKEITESEE MOBILE</Text>
        <Text style={styles.title}>Android + iOS foundation is live.</Text>
        <Text style={styles.description}>
          This app shell builds against the frozen Native Contract v1. Authentication,
          roles, ownership and marketplace state remain server-authoritative.
        </Text>

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

          {healthState.state === 'error' ? (
            <Text style={styles.errorText}>{healthState.message}</Text>
          ) : null}
        </View>

        <Text style={styles.footer}>Native Contract v1 · Finance HOLD · Recurrence FROZEN</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f7f7fb',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 18,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: '#5b5b72',
  },
  title: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    color: '#171721',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: '#555565',
  },
  card: {
    padding: 18,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    gap: 12,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#171721',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusList: {
    gap: 6,
  },
  statusText: {
    fontSize: 15,
    color: '#333342',
  },
  releaseText: {
    fontSize: 13,
    color: '#77778a',
  },
  errorText: {
    fontSize: 14,
    color: '#a12626',
  },
  footer: {
    fontSize: 12,
    lineHeight: 18,
    color: '#7a7a8c',
  },
});
