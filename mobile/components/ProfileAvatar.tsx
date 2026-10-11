import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { profileInitials } from '../lib/profile-model';
import { theme } from '../lib/theme';

export function ProfileAvatar({ name, url, size = 48 }: { name: string; url?: string | null; size?: number }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return <View style={[styles.shell, { width: size, height: size, borderRadius: size / 2 }]}>
    {url && failedUrl !== url ? <Image source={{ uri: url }} accessibilityLabel={`${name} profile picture`} style={styles.image} onError={() => setFailedUrl(url)} /> : <Text style={[styles.initials, { fontSize: Math.round(size * 0.38) }]}>{profileInitials(name)}</Text>}
  </View>;
}
const styles = StyleSheet.create({
  shell: { backgroundColor: theme.colors.secondary, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  initials: { fontWeight: '900', color: theme.colors.primaryStrong },
});
