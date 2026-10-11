import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '../providers/AuthProvider';
import { WorkspaceProvider } from '../providers/WorkspaceProvider';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <WorkspaceProvider>
          <Stack screenOptions={{ headerShown: false }} />
          <StatusBar style="dark" />
        </WorkspaceProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
