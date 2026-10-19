import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppShell } from '@/components/app-shell';
import { AuthProvider } from '@/lib/auth';
import { useColors } from '@/lib/theme';

export default function RootLayout() {
  const scheme = useColorScheme();
  const c = useColors();
  const navTheme = scheme === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ThemeProvider
          value={{
            ...navTheme,
            colors: { ...navTheme.colors, primary: c.primary, background: c.background, card: c.surface, text: c.text, border: c.border },
          }}>
          <StatusBar style="auto" />
          <AppShell>
            <Stack
              screenOptions={{
                headerTintColor: c.primary,
                headerTitleStyle: { color: c.text },
                contentStyle: { backgroundColor: c.background },
              }}>
              <Stack.Screen name="index" options={{ title: 'Dish Diary' }} />
              <Stack.Screen name="restaurant/new" options={{ title: 'Add a restaurant' }} />
              <Stack.Screen name="restaurant/[id]" options={{ title: 'Restaurant' }} />
              <Stack.Screen name="dish/[id]" options={{ title: 'Dish' }} />
              <Stack.Screen name="about" options={{ title: 'About' }} />
              <Stack.Screen name="admin" options={{ title: 'Admin' }} />
              <Stack.Screen name="account" options={{ title: 'Account' }} />
            </Stack>
          </AppShell>
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
