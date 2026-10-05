import { Redirect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLogo } from '../components/BrandLogo';

import { MobileNav } from '../components/MobileNav';
import {
  fetchProviderReviews,
  saveProviderReviewResponse,
  stars,
  type ProviderReview,
  type ProviderReviewSummary,
} from '../lib/reviews';
import { theme } from '../lib/theme';
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
    if (savingReviewId) return;
    setEditingReviewId(review.id);
    setResponseDraft(review.provider_response || '');
    setActionError('');
    setNotice('');
  };

  const cancelResponse = () => {
    if (savingReviewId) return;
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
          <View style={styles.brandRow}><BrandLogo compact /></View>
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>PROVIDER REVIEWS</Text>
              <Text style={styles.title}>Customer feedback</Text>
              <Text style={styles.description}>
                Read published feedback and respond to Customer reviews.
              </Text>
            </View>
            <Pressable accessibilityRole="button" disabled={state.status === 'loading' || !!savingReviewId} onPress={() => void load()} style={[styles.refreshButton, (state.status === 'loading' || !!savingReviewId) && styles.refreshDisabled]}>
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
            <Text style={styles.guardTitle}>Response access</Text>
            <Text style={styles.muted}>You can respond only to reviews linked to your Provider profile.</Text>
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
                      editable={!savingReviewId}
                      accessibilityLabel="Provider review response"
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
                        accessibilityRole="button"
                        disabled={saving || responseDraft.trim().length < 3}
                        onPress={() => void saveResponse(review.id)}
                        style={[styles.primaryButton, (saving || responseDraft.trim().length < 3) && styles.buttonDisabled]}
                      >
                        <Text style={styles.primaryButtonText}>{saving ? 'Saving…' : 'Save response'}</Text>
                      </Pressable>
                      <Pressable accessibilityRole="button" disabled={saving} onPress={cancelResponse} style={styles.secondaryButton}>
                        <Text style={styles.secondaryButtonText}>Cancel</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable accessibilityRole="button" disabled={!!savingReviewId} accessibilityState={{ disabled: !!savingReviewId }} onPress={() => startResponse(review)} style={[styles.responseButton, !!savingReviewId && styles.buttonDisabled]}>
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
  safeArea: { flex: 1, backgroundColor: theme.colors.white },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  screen: { flex: 1, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10, gap: 10 },
  brandRow: { alignItems: 'center', paddingBottom: 6 },
  refreshDisabled: { opacity: 0.5 },
  content: { gap: 12, paddingBottom: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headerCopy: { flex: 1, minWidth: 0, gap: 5 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, color: theme.colors.inkMuted },
  title: { fontSize: 27, lineHeight: 33, fontWeight: '800', color: theme.colors.ink },
  description: { fontSize: 14, lineHeight: 20, color: theme.colors.inkMuted },
  refreshButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: theme.colors.secondary },
  refreshText: { fontSize: 12, fontWeight: '800', color: theme.colors.primaryStrong },
  summaryCard: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 17, borderRadius: 17, backgroundColor: '#fff' },
  summaryMain: { flex: 1, gap: 3 },
  average: { fontSize: 32, fontWeight: '800', color: theme.colors.ink },
  stars: { fontSize: 19, letterSpacing: 2, color: theme.colors.ink },
  summarySide: { alignItems: 'flex-end', gap: 3 },
  summaryLabel: { fontSize: 10, fontWeight: '800', color: theme.colors.inkMuted },
  summaryValue: { fontSize: 23, fontWeight: '800', color: theme.colors.primaryStrong },
  guardCard: { gap: 4, padding: 14, borderRadius: 14, backgroundColor: theme.colors.secondary },
  guardTitle: { fontSize: 13, fontWeight: '800', color: theme.colors.ink },
  inlineStatus: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  card: { borderWidth: 1, borderColor: theme.colors.border, gap: 10, padding: 16, borderRadius: 16, backgroundColor: '#fff' },
  cardTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.ink },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  cardTitleWrap: { flex: 1, minWidth: 0, gap: 4 },
  serviceName: { fontSize: 16, fontWeight: '800', color: theme.colors.ink },
  starsSmall: { fontSize: 17, letterSpacing: 2, color: theme.colors.ink },
  rating: { fontSize: 12, fontWeight: '800', color: theme.colors.inkMuted },
  comment: { fontSize: 14, lineHeight: 20, color: theme.colors.ink },
  timestamp: { fontSize: 10, color: theme.colors.inkMuted },
  responseCard: { gap: 5, padding: 12, borderRadius: 12, backgroundColor: theme.colors.secondary },
  responseLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8, color: theme.colors.inkMuted },
  responseText: { fontSize: 13, lineHeight: 19, color: theme.colors.inkMuted },
  composer: { gap: 8, paddingTop: 4 },
  label: { fontSize: 12, fontWeight: '800', color: theme.colors.inkMuted },
  input: { minHeight: 108, padding: 12, borderRadius: 12, backgroundColor: theme.colors.secondary, fontSize: 14, lineHeight: 20, color: theme.colors.ink },
  counter: { alignSelf: 'flex-end', fontSize: 10, color: theme.colors.inkMuted },
  actionRow: { flexDirection: 'row', gap: 8 },
  primaryButton: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48, borderRadius: 10, backgroundColor: theme.colors.primary },
  primaryButtonText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  secondaryButton: { alignItems: 'center', justifyContent: 'center', minHeight: 48, paddingHorizontal: 16, borderRadius: 10, backgroundColor: theme.colors.secondary },
  secondaryButtonText: { fontSize: 12, fontWeight: '800', color: theme.colors.inkMuted },
  responseButton: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: theme.colors.secondary },
  responseButtonText: { fontSize: 12, fontWeight: '800', color: theme.colors.primaryStrong },
  buttonDisabled: { opacity: 0.45 },
  noticeText: { fontSize: 13, lineHeight: 19, color: '#2f6a46' },
  muted: { fontSize: 13, lineHeight: 18, color: theme.colors.inkMuted },
  errorText: { fontSize: 13, lineHeight: 19, color: '#8b3535' },
});
