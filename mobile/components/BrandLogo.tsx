import { Image, StyleSheet, View } from 'react-native';

type BrandLogoProps = {
  compact?: boolean;
  large?: boolean;
};

export function BrandLogo({ compact = false, large = false }: BrandLogoProps) {
  return (
    <View style={[styles.wrap, compact && styles.compactWrap, large && styles.largeWrap]}>
      <Image
        accessibilityLabel="TakeItEsee"
        source={require('../assets/official-takeitesee-logo.png')}
        resizeMode="contain"
        style={[styles.logo, compact && styles.compactLogo, large && styles.largeLogo]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
  },
  largeWrap: { alignSelf: 'center', maxWidth: '100%' },
  largeLogo: { width: 260, height: 120, maxWidth: '100%' },
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
});
