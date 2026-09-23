import { Link, Redirect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MobileNav } from '../components/MobileNav';
import { fetchCustomerReviews, stars, type CustomerReview } from '../lib/reviews';
import { useAuth } from '../providers/AuthProvider';

type ReviewState =
  | { status: 'loading'; reviews: CustomerReview[] }
  | { status: 'ready'; reviews: CustomerReview[] }
  | { status: 'error'; reviews: CustomerReview[]; message: string };

export default function CustomerReviewsScreen() {
  const auth = useAuth();
  const [state, setState] = useState<ReviewState>({ status: 'loading', reviews: [] });

  const load = useCallback(async () => {
    if (auth.status !== 'signedIn') return;
    setState((current) => ({ status: 'loading', reviews: current.reviews }));
    try {
      const payload = await fetchCustomerReviews();
      setState({ status: 'ready', reviews: payload.reviews ?? [] });
    } catch (error) {
      setState({
        status: 'error',
        reviews: [],
        message: error instanceof Error ? error.message : 'Unable to load reviews.',
      });
    }
  }, [auth.status]);

  useEffect(() => {
    void load();
  }, [load]);

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>MY REVIEWS</Text>
              <Text style={styles.title}>Your service feedback</Text>
              <Text style={styles.description}>
                Review history and Provider responses are read-only in this native slice.
              </Text>
            </View>
            <Pressable onPress={() => void load()} style={styles.refreshButton}>
              <Text style={styles.refreshText}>Refresh</Text>
            </Pressable>
          </View>

          <View style={styles.readOnlyCard}>
            <Text style={styles.readOnlyTitle}>History only</Text>
            <Text style={styles.muted}>Creating or editing a review is intentionally outside this slice.</Text>
          </View>

          {state.status === 'loading' ? (
            <View style={styles.inlineStatus}><ActivityIndicator /><Text style={styles.muted}>Loading reviews…</Text></View>
          ) : null}
          {state.status === 'error' ? <Text style={styles.errorText}>{state.message}</Text> : null}
          {state.status === 'ready' && state.reviews.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>No reviews yet</Text>
              <Text style={styles.muted}>Published reviews from completed service journeys will appear here.</Text>
              <Link href="/bookings" style={styles.linkButton}>View bookings</Link>
            </View>
          ) : null}

          {state.reviews.map((review) => (
            <View key={review.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleWrap}>
                  <Text style={styles.reference}>BOOKING REVIEW</Text>
                  <Text style={styles.stars}>{stars(review.rating)}</Text>
                </View>
                <Text style={styles.rating}>{review.rating}/5</Text>
              </View>
              <Text style={styles.comment}>{review.comment || 'No written comment.'}</Text>
              <Text style={styles.timestamp}>{review.created_at}</Text>

              {review.provider_response ? (
                <View style={styles.responseCard}>
                  <Text style={styles.responseLabel}>PROVIDER RESPONSE</Text>
                  <Text style={styles.responseText}>{review.provider_response}</Text>
                  {review.provider_responded_at ? <Text style={styles.timestamp}>{review.provider_responded_at}</Text> : null}
                </View>
              ) : (
                <Text style={styles.muted}>No Provider response yet.</Text>
              )}

              <Link
                href={{ pathname: '/bookings/[bookingId]', params: { bookingId: review.booking_id } }}
                style={styles.openLink}
              >
                View booking →
              </Link>
            </View>
          ))}
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
  readOnlyCard: { gap: 4, padding: 14, borderRadius: 14, backgroundColor: '#f0f0f6' },
  readOnlyTitle: { fontSize: 13, fontWeight: '800', color: '#3d3d54' },
  inlineStatus: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  card: { gap: 10, padding: 16, borderRadius: 16, backgroundColor: '#fff' },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  cardTitleWrap: { flex: 1, gap: 3 },
  reference: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, color: '#77778a' },
  stars: { fontSize: 21, letterSpacing: 2, color: '#333342' },
  rating: { fontSize: 12, fontWeight: '800', color: '#555565' },
  comment: { fontSize: 14, lineHeight: 20, color: '#333342' },
  timestamp: { fontSize: 10, color: '#888899' },
  responseCard: { gap: 5, padding: 12, borderRadius: 12, backgroundColor: '#f3f3f8' },
  responseLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8, color: '#77778a' },
  responseText: { fontSize: 13, lineHeight: 19, color: '#444454' },
  openLink: { fontSize: 12, fontWeight: '800', color: '#30304a' },
  linkButton: { alignSelf: 'flex-start', paddingVertical: 9, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#30304a', color: '#fff', fontWeight: '800' },
  muted: { fontSize: 13, lineHeight: 18, color: '#77778a' },
  errorText: { fontSize: 13, lineHeight: 19, color: '#8b3535' },
});
