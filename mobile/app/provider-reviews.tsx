import { Redirect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MobileNav } from '../components/MobileNav';
import {
  fetchProviderReviews,
  saveProviderReviewResponse,
  stars,
  type ProviderReview,
  type ProviderReviewSummary,
} from '../lib/reviews';
import { useAuth } from '../providers/AuthProvider';

type ReviewState =
  | { status: 'loading'; reviews: ProviderReview[]; summary: ProviderReviewSummary }
  | { status: 'ready'; reviews: ProviderReview[]; summary: ProviderReviewSummary }
  | { status: 'error'; reviews: ProviderReview[]; summary: ProviderReviewSummary; message: string };

const emptySummary: ProviderReviewSummary = {
  total: 0,
  average: 0,
  counts: {},
  five_star_share: 0,
};

export default function ProviderReviewsScreen() {
  const auth = useAuth();
  const [state, setState] = useState<ReviewState>({ status: 'loading', reviews: [], summary: emptySummary });
  const [editingReviewId, setEditingReviewId] = useState('');
  const [responseDraft, setResponseDraft] = useState('');
  const [savingReviewId, setSavingReviewId] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const providerAccess = auth.status === 'signedIn'
    && (auth.identity.roles.includes('professional') || auth.identity.roles.includes('business_owner'));

  const load = useCallback(async () => {
    if (auth.status !== 'signedIn' || !providerAccess) return;
    setState((current) => ({ status: 'loading', reviews: current.reviews, summary: current.summary }));
    try {
      const payload = await fetchProviderReviews();
      setState({ status: 'ready', reviews: payload.reviews ?? [], summary: payload.summary ?? emptySummary });
    } catch (error) {
      setState({
        status: 'error',
        reviews: [],
        summary: emptySummary,
        message: error instanceof Error ? error.message : 'Unable to load Provider reviews.',
      });
    }
  }, [auth.status, providerAccess]);

  useEffect(() => {
    void load();
  }, [load]);

  const startResponse = (review: ProviderReview) => {
    setEditingReviewId(review.id);
    setResponseDraft(review.provider_response || '');
    setActionError('');
    setNotice('');
  };

  const cancelResponse = () => {
    setEditingReviewId('');
    setResponseDraft('');
    setActionError('');
  };

  const saveResponse = async (reviewId: string) => {
    if (savingReviewId) return;
    setSavingReviewId(reviewId);
    setActionError('');
    setNotice('');
    try {
      await saveProviderReviewResponse(reviewId, responseDraft);
      setEditingReviewId('');
      setResponseDraft('');
      setNotice('Your response was saved.');
      await load();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Review response could not be saved.');
    } finally {
      setSavingReviewId('');
    }
  };

  if (auth.status === 'loading') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator />
          <Text style={styles.muted}>Checking Provider access…</Text>
        </View>
      </SafeAreaView>
    );
  }
  if (auth.status === 'signedOut') return <Redirect href="/login" />;
  if (!providerAccess) return <Redirect href="/home" />;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>PROVIDER REVIEWS</Text>
              <Text style={styles.title}>Customer feedback</Text>
              <Text style={styles.description}>
                Read published feedback and respond through the server-owned Provider review contract.
              </Text>
            </View>
            <Pressable onPress={() => void load()} style={styles.refreshButton}>
              <Text style={styles.refreshText}>Refresh</Text>
            </Pressable>
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.summaryMain}>
              <Text style={styles.average}>{state.summary.average.toFixed(1)}</Text>
              <Text style={styles.stars}>{stars(state.summary.average)}</Text>
              <Text style={styles.muted}>{state.summary.total} published reviews</Text>
            </View>
            <View style={styles.summarySide}>
              <Text style={styles.summaryLabel}>5-star share</Text>
              <Text style={styles.summaryValue}>{state.summary.five_star_share}%</Text>
            </View>
          </View>

          <View style={styles.guardCard}>
            <Text style={styles.guardTitle}>Server-guarded responses</Text>
            <Text style={styles.muted}>Only reviews owned by your verified Provider identity can be updated.</Text>
          </View>

          {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}
          {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}
          {state.status === 'loading' ? <View style={styles.inlineStatus}><ActivityIndicator /><Text style={styles.muted}>Loading feedback…</Text></View> : null}
          {state.status === 'error' ? <Text style={styles.errorText}>{state.message}</Text> : null}
          {state.status === 'ready' && state.reviews.length === 0 ? (
            <View style={styles.card}><Text style={styles.cardTitle}>No published reviews yet</Text><Text style={styles.muted}>Customer feedback will appear here after eligible completed services are reviewed.</Text></View>
          ) : null}

          {state.reviews.map((review) => {
            const editing = editingReviewId === review.id;
            const saving = savingReviewId === review.id;
            return (
              <View key={review.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleWrap}>
                    <Text style={styles.serviceName}>{review.service_name}</Text>
                    <Text style={styles.starsSmall}>{stars(review.rating)}</Text>
                  </View>
                  <Text style={styles.rating}>{review.rating}/5</Text>
                </View>
                <Text style={styles.comment}>{review.comment || 'No written comment.'}</Text>
                <Text style={styles.timestamp}>{review.created_at}</Text>

                {review.provider_response ? (
                  <View style={styles.responseCard}>
                    <Text style={styles.responseLabel}>YOUR RESPONSE</Text>
                    <Text style={styles.responseText}>{review.provider_response}</Text>
                    <Text style={styles.timestamp}>{review.provider_response_updated_at || review.provider_responded_at || ''}</Text>
                  </View>
                ) : (
                  <Text style={styles.muted}>No Provider response has been published yet.</Text>
                )}

                {editing ? (
                  <View style={styles.composer}>
                    <Text style={styles.label}>Provider response</Text>
                    <TextInput
                      maxLength={1000}
                      multiline
                      onChangeText={setResponseDraft}
                      placeholder="Write a professional response to this review."
                      style={styles.input}
                      textAlignVertical="top"
                      value={responseDraft}
                    />
                    <Text style={styles.counter}>{responseDraft.length}/1000</Text>
                    <View style={styles.actionRow}>
                      <Pressable
                        disabled={saving || responseDraft.trim().length < 3}
                        onPress={() => void saveResponse(review.id)}
                        style={[styles.primaryButton, (saving || responseDraft.trim().length < 3) && styles.buttonDisabled]}
                      >
                        <Text style={styles.primaryButtonText}>{saving ? 'Saving…' : 'Save response'}</Text>
                      </Pressable>
                      <Pressable disabled={saving} onPress={cancelResponse} style={styles.secondaryButton}>
                        <Text style={styles.secondaryButtonText}>Cancel</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable onPress={() => startResponse(review)} style={styles.responseButton}>
                    <Text style={styles.responseButtonText}>{review.provider_response ? 'Edit response' : 'Respond to review'}</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </ScrollView>
        <MobileNav />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f7fb' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  screen: { flex: 1, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10, gap: 10 },
  content: { gap: 12, paddingBottom: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headerCopy: { flex: 1, gap: 5 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, color: '#77778a' },
  title: { fontSize: 27, lineHeight: 33, fontWeight: '800', color: '#171721' },
  description: { fontSize: 14, lineHeight: 20, color: '#666678' },
  refreshButton: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: '#ededf4' },
  refreshText: { fontSize: 12, fontWeight: '800', color: '#3f3f58' },
  summaryCard: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 17, borderRadius: 17, backgroundColor: '#fff' },
  summaryMain: { flex: 1, gap: 3 },
  average: { fontSize: 32, fontWeight: '800', color: '#171721' },
  stars: { fontSize: 19, letterSpacing: 2, color: '#333342' },
  summarySide: { alignItems: 'flex-end', gap: 3 },
  summaryLabel: { fontSize: 10, fontWeight: '800', color: '#77778a' },
  summaryValue: { fontSize: 23, fontWeight: '800', color: '#30304a' },
  guardCard: { gap: 4, padding: 14, borderRadius: 14, backgroundColor: '#f0f0f6' },
  guardTitle: { fontSize: 13, fontWeight: '800', color: '#3d3d54' },
  inlineStatus: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  card: { gap: 10, padding: 16, borderRadius: 16, backgroundColor: '#fff' },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#171721' },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  cardTitleWrap: { flex: 1, gap: 4 },
  serviceName: { fontSize: 16, fontWeight: '800', color: '#171721' },
  starsSmall: { fontSize: 17, letterSpacing: 2, color: '#333342' },
  rating: { fontSize: 12, fontWeight: '800', color: '#555565' },
  comment: { fontSize: 14, lineHeight: 20, color: '#333342' },
  timestamp: { fontSize: 10, color: '#888899' },
  responseCard: { gap: 5, padding: 12, borderRadius: 12, backgroundColor: '#f3f3f8' },
  responseLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8, color: '#77778a' },
  responseText: { fontSize: 13, lineHeight: 19, color: '#444454' },
  composer: { gap: 8, paddingTop: 4 },
  label: { fontSize: 12, fontWeight: '800', color: '#555565' },
  input: { minHeight: 108, padding: 12, borderRadius: 12, backgroundColor: '#f4f4f8', fontSize: 14, lineHeight: 20, color: '#22222f' },
  counter: { alignSelf: 'flex-end', fontSize: 10, color: '#888899' },
  actionRow: { flexDirection: 'row', gap: 8 },
  primaryButton: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 42, borderRadius: 10, backgroundColor: '#30304a' },
  primaryButtonText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  secondaryButton: { alignItems: 'center', justifyContent: 'center', minHeight: 42, paddingHorizontal: 16, borderRadius: 10, backgroundColor: '#ededf4' },
  secondaryButtonText: { fontSize: 12, fontWeight: '800', color: '#444454' },
  responseButton: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: '#ededf4' },
  responseButtonText: { fontSize: 12, fontWeight: '800', color: '#30304a' },
  buttonDisabled: { opacity: 0.45 },
  noticeText: { fontSize: 13, lineHeight: 19, color: '#2f6a46' },
  muted: { fontSize: 13, lineHeight: 18, color: '#77778a' },
  errorText: { fontSize: 13, lineHeight: 19, color: '#8b3535' },
});
