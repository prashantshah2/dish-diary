import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { getCoords, type Coords } from '@/lib/location';
import { searchPlaces, type PlaceResult, type PlaceSearchResults, type PlaceSuggestion } from '@/lib/place-lookup';
import { radius, space, useColors } from '@/lib/theme';

import { AppText, Field, Loading } from './ui';

/** "Find the restaurant" box: type a name or address, pick a match to fill the form. */
export function PlaceSearch({ onPick }: { onPick: (place: PlaceResult) => void }) {
  const c = useColors();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceSearchResults | null>(null);
  const [resolving, setResolving] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const coords = useRef<Promise<Coords | null> | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) return;
    const controller = new AbortController();
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const where = coords.current ? await coords.current : null;
        const found = await searchPlaces(q, where, controller.signal);
        setResults(found);
        setError(null);
      } catch {
        if (!controller.signal.aborted) {
          setError('Search isn’t available right now — fill in the details below.');
          setResults(null);
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query]);

  const changeQuery = (text: string) => {
    setQuery(text);
    if (text.trim().length < 3) setResults(null);
  };

  const pick = async (suggestion: PlaceSuggestion) => {
    setResolving(true);
    const place = await suggestion.resolve();
    setResolving(false);
    onPick(place);
    setQuery('');
    setResults(null);
  };

  return (
    <View style={{ gap: space.xs }}>
      <Field
        label="Find the restaurant"
        hint="Search by restaurant name. Or skip this and type the details below."
        value={query}
        onChangeText={changeQuery}
        onFocus={() => {
          // Ask for location only once someone actually starts a search.
          coords.current ??= getCoords();
        }}
        placeholder="e.g. Taj Palace San Jose"
        autoCorrect={false}
        returnKeyType="search"
      />

      {(searching || resolving) && <Loading />}
      {error && <AppText variant="small" style={{ color: c.danger }}>{error}</AppText>}

      {results && !searching && !resolving && (
        <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: c.surface }}>
          {results.suggestions.length === 0 ? (
            <AppText variant="muted" style={{ padding: space.md }}>
              No matches — fill in the details below.
            </AppText>
          ) : (
            results.suggestions.map((r, i) => (
              <Pressable
                key={r.key}
                accessibilityRole="button"
                onPress={() => pick(r)}
                style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({
                  paddingHorizontal: space.md,
                  paddingVertical: space.sm + 2,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: c.border,
                  backgroundColor: pressed || hovered ? c.background : 'transparent',
                })}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: c.text }}>{r.name}</Text>
                {!!r.description && <Text style={{ fontSize: 13, color: c.textMuted }}>{r.description}</Text>}
              </Pressable>
            ))
          )}
          <Text style={{ fontSize: 11, color: c.textMuted, paddingHorizontal: space.md, paddingVertical: space.xs, borderTopWidth: 1, borderTopColor: c.border }}>
            {results.source === 'google' ? 'Google Maps' : 'Search by Photon · © OpenStreetMap contributors'}
          </Text>
        </View>
      )}
    </View>
  );
}
