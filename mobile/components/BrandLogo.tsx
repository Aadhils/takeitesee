import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { theme } from '../lib/theme';

const OFFICIAL_LOGO_URL = 'https://www.takeitesee.com/official-takeitesee-logo.png';

type BrandLogoProps = {
  compact?: boolean;
};

export function BrandLogo({ compact = false }: BrandLogoProps) {
  const [failed, setFailed] = useState(false);

  return (
    <View style={[styles.wrap, compact && styles.compactWrap]}>
      {failed ? (
        <Text accessibilityRole="header" style={[styles.fallback, compact && styles.compactFallback]}>
          TakeItEsee
        </Text>
      ) : (
        <Image
          accessibilityLabel="TakeItEsee"
          source={{ uri: OFFICIAL_LOGO_URL }}
          resizeMode="contain"
          onError={() => setFailed(true)}
          style={[styles.logo, compact && styles.compactLogo]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
  },
  compactWrap: {
    minHeight: 30,
  },
  logo: {
    width: 154,
    height: 44,
  },
  compactLogo: {
    width: 112,
    height: 30,
  },
  fallback: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.6,
    color: theme.colors.primaryStrong,
  },
  compactFallback: {
    fontSize: 18,
  },
});
