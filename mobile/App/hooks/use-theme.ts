// hooks/use-theme-color.ts
import { useColorScheme } from 'react-native';

const Colors = {
  light: {
    text: '#11181C',
    tint: '#007AFF',
    tabIconDefault: '#687076',
    tabIconSelected: '#007AFF',
  },
  dark: {
    text: '#ECEDEE',
    tint: '#007AFF',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: '#007AFF',
  },
};

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  const theme = useColorScheme() ?? 'light';
  const colorFromProps = props[theme];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return Colors[theme][colorName];
  }
}
