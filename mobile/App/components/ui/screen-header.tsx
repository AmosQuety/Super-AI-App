import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// The part of the navigation header props this component reads.
export interface ScreenHeaderProps {
  options: { title?: string };
  back?: unknown;
}

export interface ScreenHeaderColors {
  background: string;
  foreground: string;
}

const LIGHT: ScreenHeaderColors = { background: '#ffffff', foreground: '#1f2937' };

const HEADER_CONTENT_HEIGHT = 56;
const MIN_TOUCH_TARGET = 48;

// Draws its own status-bar inset: on edge-to-edge Android the native stack header does not,
// so its title and back button would sit under the clock and status icons.
export function ScreenHeader({
  title,
  showBack,
  colors = LIGHT,
}: {
  title: string;
  showBack: boolean;
  colors?: ScreenHeaderColors;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <View style={styles.row}>
        {showBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={8}
            onPress={() => router.back()}
            style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.foreground} />
          </Pressable>
        ) : null}
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          style={[
            styles.title,
            { color: colors.foreground },
            !showBack && styles.titleWithoutBack,
          ]}>
          {title}
        </Text>
      </View>
    </View>
  );
}

// Adapts the props React Navigation passes to a `header` option.
export function renderScreenHeader(colors?: ScreenHeaderColors) {
  return function HeaderForStack({ options, back }: ScreenHeaderProps) {
    return <ScreenHeader title={options.title ?? ''} showBack={Boolean(back)} colors={colors} />;
  };
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  row: {
    height: HEADER_CONTENT_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  backButton: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
  },
  titleWithoutBack: {
    paddingLeft: 8,
  },
});
