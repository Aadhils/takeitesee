import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLogo } from '../components/BrandLogo';
import { theme } from '../lib/theme';
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
        <BrandLogo />
        <ActivityIndicator color={theme.colors.primary} />
        <Text style={styles.message}>Getting your marketplace ready…</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.canvas },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  message: { fontSize: 14, lineHeight: 20, textAlign: 'center', color: theme.colors.inkMuted },
});
