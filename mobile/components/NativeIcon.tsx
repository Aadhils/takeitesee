import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { theme } from '../lib/theme';

export type NativeIconName = 'home' | 'search' | 'plus' | 'calendar' | 'person' | 'camera' | 'chevron' | 'check' | 'close' | 'menu';

export function NativeIcon({ name, color = theme.colors.inkMuted, size = 24 }: { name: NativeIconName; color?: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    {name === 'home' ? <><Path d="M3 10.5 12 3l9 7.5V21h-6v-7H9v7H3Z" /></> : null}
    {name === 'search' ? <><Circle cx={10.5} cy={10.5} r={6.5} /><Path d="m16 16 5 5" /></> : null}
    {name === 'plus' ? <Path d="M12 5v14M5 12h14" /> : null}
    {name === 'calendar' ? <><Rect x={3} y={5} width={18} height={16} rx={2} /><Path d="M7 3v4M17 3v4M3 10h18M7 14h3M14 14h3M7 17h3" /></> : null}
    {name === 'person' ? <><Circle cx={12} cy={8} r={3.5} /><Path d="M5 21v-2a7 7 0 0 1 14 0v2" /></> : null}
    {name === 'camera' ? <><Path d="M3 7h4l2-3h6l2 3h4v13H3Z" /><Circle cx={12} cy={13} r={3.5} /></> : null}
    {name === 'chevron' ? <Path d="m6 9 6 6 6-6" /> : null}
    {name === 'check' ? <Path d="m5 12 4 4L19 6" /> : null}
    {name === 'close' ? <Path d="m6 6 12 12M18 6 6 18" /> : null}
    {name === 'menu' ? <Path d="M4 6h16M4 12h16M4 18h16" /> : null}
  </Svg>;
}
