import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../providers/AuthProvider';

export default function AppEntryScreen() {
  const auth = useAuth();

  if (auth.status === 'signedIn') {
    return <Redirect href="/home" />;
  }

  if (auth.status === 'signedOut') {
    return <Redirect href="/login" />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <ActivityIndicator />
        <Text style={styles.title}>TakeItEsee</Text>
        <Text style={styles.message}>Validating your saved session with the server…</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f7fb' },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  title: { fontSize: 24, fontWeight: '800', color: '#171721' },
  message: { fontSize: 14, lineHeight: 20, textAlign: 'center', color: '#666678' },
});
