import { Image, StyleSheet, View } from 'react-native';

type BrandLogoProps = {
  compact?: boolean;
};

export function BrandLogo({ compact = false }: BrandLogoProps) {
  return (
    <View style={[styles.wrap, compact && styles.compactWrap]}>
      <Image
        accessibilityLabel="TakeItEsee"
        source={require('../assets/official-takeitesee-logo.png')}
        resizeMode="contain"
        style={[styles.logo, compact && styles.compactLogo]}
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
