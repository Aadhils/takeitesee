import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  createOneTimeRequirement,
  fetchRequirementCatalog,
  type CreatedRequirement,
  type RequirementCatalog,
} from '../lib/requirements';
import { useAuth } from '../providers/AuthProvider';

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function RequestServiceScreen() {
  const params = useLocalSearchParams<{
    title?: string | string[];
    description?: string | string[];
    location?: string | string[];
  }>();
  const auth = useAuth();
  const [title, setTitle] = useState(firstParam(params.title) ?? '');
  const [description, setDescription] = useState(firstParam(params.description) ?? '');
  const [catalog, setCatalog] = useState<RequirementCatalog | null>(null);
  const [categoryId, setCategoryId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<CreatedRequirement | null>(null);
  const idempotencyKey = useRef(
    `mobile-one-time-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  );

  useEffect(() => {
    if (auth.status !== 'signedIn') return;
    let active = true;
    setLoadingCatalog(true);
    setError('');

    fetchRequirementCatalog()
      .then((result) => {
        if (!active) return;
        setCatalog(result);

        const requestedLocation = (firstParam(params.location) ?? '').trim().toLowerCase();
        const matchingLocation = result.locations.find((item) =>
          requestedLocation
            ? item.name.toLowerCase().includes(requestedLocation) || requestedLocation.includes(item.name.toLowerCase())
            : false,
        );
        if (matchingLocation) setLocationId(matchingLocation.id);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : 'Unable to load requirement options.');
      })
      .finally(() => {
        if (active) setLoadingCatalog(false);
      });

    return () => {
      active = false;
    };
  }, [auth.status, params.location]);

  const submit = async () => {
    if (submitting || !title.trim() || !description.trim() || !categoryId || !locationId) return;
    setSubmitting(true);
    setError('');

    try {
      const result = await createOneTimeRequirement({
        idempotencyKey: idempotencyKey.current,
        categoryId,
        locationId,
        title,
        description,
      });
      setCreated(result.requirement);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Requirement could not be posted.');
    } finally {
      setSubmitting(false);
    }
  };

  if (auth.status === 'loading') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator />
          <Text style={styles.muted}>Checking your account…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (auth.status === 'signedOut') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centeredCardWrap}>
          <View style={styles.card}>
            <Text style={styles.eyebrow}>CUSTOMER REQUEST</Text>
            <Text style={styles.title}>Sign in to post a requirement</Text>
            <Text style={styles.description}>
              Explore stays public. Posting a requirement uses your server-validated Customer account.
            </Text>
            <Link href="/login" asChild>
              <Pressable style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Sign in</Text>
              </Pressable>
            </Link>
            <Link href="/explore" asChild>
              <Pressable style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Back to Explore</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (created) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centeredCardWrap}>
          <View style={styles.successCard}>
            <Text style={styles.eyebrow}>REQUIREMENT POSTED</Text>
            <Text style={styles.title}>Your request is live</Text>
            <Text style={styles.description}>{created.title}</Text>
            <Text style={styles.reference}>{created.reference}</Text>
            <Link href="/home" asChild>
              <Pressable style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Go to Home</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Link href="/explore" asChild>
          <Pressable style={styles.backButton}>
            <Text style={styles.backText}>‹ Back to Explore</Text>
          </Pressable>
        </Link>

        <View style={styles.header}>
          <Text style={styles.eyebrow}>ONE-TIME REQUIREMENT</Text>
          <Text style={styles.title}>Tell providers what you need</Text>
          <Text style={styles.description}>
            This mobile flow posts a one-time, negotiable requirement. Recurrence stays outside the native v1 flow.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Title</Text>
          <TextInput value={title} onChangeText={setTitle} style={styles.input} placeholder="What service do you need?" />

          <Text style={styles.label}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            style={[styles.input, styles.multiline]}
            placeholder="Add enough detail for providers to respond clearly."
            multiline
            textAlignVertical="top"
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Category</Text>
          {loadingCatalog ? <ActivityIndicator /> : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {(catalog?.categories ?? []).map((item) => (
              <Pressable
                key={item.id}
                onPress={() => setCategoryId(item.id)}
                style={[styles.chip, categoryId === item.id && styles.chipSelected]}
              >
                <Text style={[styles.chipText, categoryId === item.id && styles.chipTextSelected]}>{item.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Location</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {(catalog?.locations ?? []).map((item) => (
              <Pressable
                key={item.id}
                onPress={() => setLocationId(item.id)}
                style={[styles.chip, locationId === item.id && styles.chipSelected]}
              >
                <Text style={[styles.chipText, locationId === item.id && styles.chipTextSelected]}>{item.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          accessibilityRole="button"
          disabled={submitting || !title.trim() || !description.trim() || !categoryId || !locationId}
          onPress={() => void submit()}
          style={({ pressed }) => [
            styles.primaryButton,
            (pressed || submitting) && styles.buttonPressed,
            (!title.trim() || !description.trim() || !categoryId || !locationId) && styles.buttonDisabled,
          ]}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Post requirement</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f7fb' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  centeredCardWrap: { flex: 1, justifyContent: 'center', padding: 20 },
  content: { padding: 18, gap: 14 },
  backButton: { alignSelf: 'flex-start', paddingVertical: 7, paddingRight: 12 },
  backText: { fontSize: 14, fontWeight: '700', color: '#42425f' },
  header: { gap: 7 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4, color: '#666678' },
  title: { fontSize: 27, lineHeight: 33, fontWeight: '800', color: '#171721' },
  description: { fontSize: 14, lineHeight: 21, color: '#666678' },
  card: { padding: 18, borderRadius: 18, backgroundColor: '#fff', gap: 10 },
  successCard: { padding: 20, borderRadius: 20, backgroundColor: '#fff', gap: 12 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#171721' },
  label: { fontSize: 13, fontWeight: '700', color: '#44445d' },
  input: { minHeight: 48, borderWidth: 1, borderColor: '#d9d9e3', borderRadius: 12, paddingHorizontal: 13, paddingVertical: 10, fontSize: 15, color: '#171721', backgroundColor: '#fff' },
  multiline: { minHeight: 118 },
  chips: { gap: 8, paddingVertical: 2 },
  chip: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, backgroundColor: '#efeff5' },
  chipSelected: { backgroundColor: '#30304a' },
  chipText: { fontSize: 13, fontWeight: '700', color: '#4b4b65' },
  chipTextSelected: { color: '#fff' },
  primaryButton: { minHeight: 50, justifyContent: 'center', alignItems: 'center', borderRadius: 12, backgroundColor: '#30304a', paddingHorizontal: 18 },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  secondaryButton: { minHeight: 48, justifyContent: 'center', alignItems: 'center', borderRadius: 12, backgroundColor: '#ededf4' },
  secondaryButtonText: { color: '#30304a', fontSize: 14, fontWeight: '800' },
  buttonPressed: { opacity: 0.82 },
  buttonDisabled: { opacity: 0.45 },
  reference: { fontSize: 14, fontWeight: '800', color: '#3f3f58' },
  muted: { fontSize: 13, lineHeight: 19, color: '#77778a' },
  error: { fontSize: 13, lineHeight: 19, color: '#a12626' },
});
