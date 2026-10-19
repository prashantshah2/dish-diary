import { router, usePathname, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth';
import { radius, space, useBreakpoint, useColors } from '@/lib/theme';

const NAV: { href: Href; label: string; icon: string; match: (p: string) => boolean }[] = [
  {
    href: '/',
    label: 'Restaurants',
    icon: '🍽️',
    match: (p) => p === '/' || (p.startsWith('/restaurant/') && p !== '/restaurant/new') || p.startsWith('/dish/'),
  },
  { href: '/restaurant/new', label: 'Add place', icon: '➕', match: (p) => p === '/restaurant/new' },
  { href: '/about', label: 'About', icon: 'ℹ️', match: (p) => p === '/about' },
];

const ADMIN_NAV = { href: '/admin' as Href, label: 'Admin', icon: '🛠️', match: (p: string) => p === '/admin' };

/**
 * Responsive frame around every screen:
 *   phone        → content + bottom navigation bar
 *   tablet/desktop → left sidebar + content
 */
export function AppShell({ children }: { children: ReactNode }) {
  const c = useColors();
  const { isPhone, bp } = useBreakpoint();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { isAdmin } = useAuth();
  const nav = isAdmin ? [...NAV, ADMIN_NAV] : NAV;

  if (isPhone) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <View style={{ flex: 1 }}>{children}</View>
        <View
          accessibilityRole="tablist"
          style={{
            flexDirection: 'row',
            borderTopWidth: 1,
            borderTopColor: c.border,
            backgroundColor: c.surface,
            paddingBottom: insets.bottom,
          }}>
          {nav.map((item) => {
            const active = item.match(pathname);
            return (
              <Pressable
                key={item.label}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => router.navigate(item.href)}
                style={{ flex: 1, alignItems: 'center', paddingVertical: space.sm }}>
                <Text style={{ fontSize: 20 }}>{item.icon}</Text>
                <Text style={{ fontSize: 12, fontWeight: active ? '700' : '500', color: active ? c.primary : c.textMuted }}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  const sidebarWidth = bp === 'desktop' ? 240 : 200;
  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: c.background }}>
      <View
        style={{
          width: sidebarWidth,
          borderRightWidth: 1,
          borderRightColor: c.border,
          backgroundColor: c.surface,
          paddingTop: space.xl + insets.top,
          paddingHorizontal: space.md,
          gap: space.xs,
        }}>
        <Text style={{ fontSize: 20, fontWeight: '800', color: c.primary, paddingHorizontal: space.md, marginBottom: space.lg }}>
          Dish Diary
        </Text>
        {nav.map((item) => {
          const active = item.match(pathname);
          return (
            <Pressable
              key={item.label}
              accessibilityRole="link"
              onPress={() => router.navigate(item.href)}
              style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.sm,
                paddingVertical: space.sm + 2,
                paddingHorizontal: space.md,
                borderRadius: radius.sm,
                backgroundColor: active ? c.surfaceAlt : hovered || pressed ? c.background : 'transparent',
              })}>
              <Text style={{ fontSize: 16 }}>{item.icon}</Text>
              <Text style={{ fontSize: 15, fontWeight: active ? '700' : '500', color: active ? c.text : c.textMuted }}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}
