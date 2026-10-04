import { Link, Redirect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLogo } from '../../components/BrandLogo';

import {
  fetchCustomerReviewForBooking,
  stars,
  submitCustomerReview,
  type CustomerReview,
} from '../../lib/reviews';
import { theme } from '../../lib/theme';
import { useAuth } from '../../providers/AuthProvider';

type ReviewState =
  | { status: 'loading'; review: CustomerReview | null }
  | { status: 'ready'; review: CustomerReview | null }
  | { status: 'error'; review: null; message: string };

export default function CustomerReviewComposerScreen() {
  const auth = useAuth();
  const params = useLocalSearchParams<{ bookingId?: string | string[] }>();
  const bookingId = Array.isArray(params.bookingId) ? params.bookingId[0] : params.bookingId;
  const [state, setState] = useState<ReviewState>({ status: 'loading', review: null });
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    if (auth.status !== 'signedIn' || !bookingId) return;
    setState({ status: 'loading', review: null });
    try {
      const payload = await fetchCustomerReviewForBooking(bookingId);
      setState({ status: 'ready', review: payload.review ?? null });
    } catch (error) {
      setState({
        status: 'error',
        review: null,
        message: error instanceof Error ? error.message : 'Unable to load review state.',
      });
    }
  }, [auth.status, bookingId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    if (!bookingId || submitting || rating < 1 || rating > 5) return;
    setSubmitting(true);
    setActionError('');
    try {
      const payload = await submitCustomerReview({ bookingId, rating, comment });
      setState({ status: 'ready', review: payload.review });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Review could not be submitted.');
    } finally {
      setSubmitting(false);
    }
  };

  if (auth.status === 'loading') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator />
          <Text style={styles.muted}>Checking your session…</Text>
        </View>
      </SafeAreaView>
    );
  }
  if (auth.status === 'signedOut') return <Redirect href="/login" />;

  if (!bookingId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Booking ID is missing.</Text>
          <Link href="/bookings" style={styles.backLink}>Back to bookings</Link>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.brandRow}><BrandLogo compact /></View>
        <View style={styles.topRow}>
          <Link
            href={{ pathname: '/bookings/[bookingId]', params: { bookingId } }}
            style={styles.backLink}
          >
            ← Booking detail
          </Link>
          <Link href="/reviews" style={styles.backLink}>My reviews</Link>
        </View>

        <View style={styles.header}>
          <Text style={styles.eyebrow}>SERVICE REVIEW</Text>
          <Text style={styles.title}>Share your feedback</Text>
          <Text style={styles.description}>
            TakeItEsee server rules decide whether this completed booking is still inside the review window and whether a review already exists.
          </Text>
        </View>

        {state.status === 'loading' ? (
          <View style={styles.inlineStatus}><ActivityIndicator /><Text style={styles.muted}>Checking review eligibility…</Text></View>
        ) : null}
        {state.status === 'error' ? <Text style={styles.errorText}>{state.message}</Text> : null}
        {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}

        {state.status === 'ready' && state.review ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Review already published</Text>
            <View style={styles.ratingRow}>
              <Text style={styles.stars}>{stars(state.review.rating)}</Text>
              <Text style={styles.ratingValue}>{state.review.rating}/5</Text>
            </View>
            <Text style={styles.comment}>{state.review.comment || 'No written comment.'}</Text>
            {state.review.provider_response ? (
              <View style={styles.responseCard}>
                <Text style={styles.responseLabel}>PROVIDER RESPONSE</Text>
                <Text style={styles.responseText}>{state.review.provider_response}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {state.status === 'ready' && !state.review ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Your rating</Text>
            <View style={styles.ratingChoices}>
              {[1, 2, 3, 4, 5].map((value) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${value} star${value === 1 ? '' : 's'}`}
                  accessibilityState={{ selected: rating === value, disabled: submitting }}
                  disabled={submitting}
                  key={value}
                  onPress={() => setRating(value)}
                  style={[styles.starButton, rating === value && styles.starButtonSelected]}
                >
                  <Text style={[styles.starButtonText, rating === value && styles.starButtonTextSelected]}>{value}★</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Comment · optional</Text>
            <TextInput
              accessibilityLabel="Review comment"
              editable={!submitting}
              multiline
              maxLength={1000}
              onChangeText={setComment}
              placeholder="Tell the Provider what went well or what could improve."
              style={styles.input}
              textAlignVertical="top"
              value={comment}
            />
            <Text style={styles.counter}>{comment.length}/1000</Text>

            <Pressable
              accessibilityRole="button"
              disabled={submitting || rating < 1}
              onPress={() => void submit()}
              style={[styles.primaryButton, (submitting || rating < 1) && styles.primaryButtonDisabled]}
            >
              <Text style={styles.primaryButtonText}>{submitting ? 'Submitting…' : 'Publish review'}</Text>
            </Pressable>
            <Text style={styles.muted}>
              You can publish one review for an eligible completed booking. Duplicate submissions are prevented.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.white },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20 },
  brandRow: { alignItems: 'center' },
  content: { padding: 18, gap: 14, paddingBottom: 28 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  backLink: { fontSize: 13, fontWeight: '800', color: theme.colors.primaryStrong },
  header: { gap: 6 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.3, color: theme.colors.inkMuted },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '800', color: theme.colors.ink },
  description: { fontSize: 14, lineHeight: 20, color: theme.colors.inkMuted },
  inlineStatus: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  card: { borderWidth: 1, borderColor: theme.colors.border, gap: 12, padding: 17, borderRadius: 17, backgroundColor: '#fff' },
  cardTitle: { fontSize: 17, fontWeight: '800', color: theme.colors.ink },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stars: { fontSize: 21, letterSpacing: 2, color: theme.colors.ink },
  ratingValue: { fontSize: 12, fontWeight: '800', color: theme.colors.inkMuted },
  ratingChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  starButton: { minHeight: 48, justifyContent: 'center', minWidth: 52, alignItems: 'center', paddingHorizontal: 10, paddingVertical: 10, borderRadius: 10, backgroundColor: theme.colors.secondary },
  starButtonSelected: { backgroundColor: theme.colors.primary },
  starButtonText: { fontSize: 13, fontWeight: '800', color: theme.colors.inkMuted },
  starButtonTextSelected: { color: '#fff' },
  label: { fontSize: 12, fontWeight: '800', color: theme.colors.inkMuted },
  input: { minHeight: 118, padding: 13, borderRadius: 12, backgroundColor: theme.colors.secondary, fontSize: 14, lineHeight: 20, color: theme.colors.ink },
  counter: { alignSelf: 'flex-end', fontSize: 10, color: theme.colors.inkMuted },
  primaryButton: { alignItems: 'center', justifyContent: 'center', minHeight: 46, borderRadius: 12, backgroundColor: theme.colors.primary },
  primaryButtonDisabled: { opacity: 0.45 },
  primaryButtonText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  comment: { fontSize: 14, lineHeight: 20, color: theme.colors.ink },
  responseCard: { gap: 5, padding: 12, borderRadius: 12, backgroundColor: theme.colors.secondary },
  responseLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8, color: theme.colors.inkMuted },
  responseText: { fontSize: 13, lineHeight: 19, color: theme.colors.inkMuted },
  muted: { fontSize: 13, lineHeight: 18, color: theme.colors.inkMuted },
  errorText: { fontSize: 13, lineHeight: 19, color: '#8b3535' },
});
