import { router } from 'expo-router';
import { Pressable, Text } from 'react-native';

import { radius, space, useColors } from '@/lib/theme';

/** Header button back to the restaurant list, from any page. */
export function HomeButton() {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel="Home"
      // Goes back to the list if it's earlier in the history, so Back doesn't loop.
      onPress={() => router.dismissTo('/')}
      hitSlop={8}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
        paddingHorizontal: space.sm + 2,
        paddingVertical: space.xs,
        marginHorizontal: space.sm,
        borderRadius: radius.pill,
        backgroundColor: pressed ? c.surfaceAlt : 'transparent',
      })}>
      <Text style={{ fontSize: 16 }}>🏠</Text>
      <Text style={{ fontSize: 15, fontWeight: '600', color: c.primary }}>Home</Text>
    </Pressable>
  );
}
