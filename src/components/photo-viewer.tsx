import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { photoUrl } from '@/lib/photos';
import type { ReviewPhoto } from '@/lib/types';
import { radius, space, useColors } from '@/lib/theme';

/** Row of thumbnails; tap one to open the full-size viewer. */
export function PhotoStrip({ photos, size = 72 }: { photos: ReviewPhoto[]; size?: number }) {
  const c = useColors();
  const [open, setOpen] = useState<number | null>(null);
  if (!photos.length) return null;
  return (
    <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {photos.map((p, i) => (
          <Pressable key={p.id} accessibilityRole="imagebutton" accessibilityLabel={`Photo ${i + 1} of ${photos.length}`} onPress={() => setOpen(i)}>
            <Image
              source={{ uri: photoUrl(p.thumb_path) }}
              style={{ width: size, height: size, borderRadius: radius.sm, backgroundColor: c.surfaceAlt }}
              contentFit="cover"
              transition={150}
            />
          </Pressable>
        ))}
      </View>
      {open !== null && <PhotoViewer photos={photos} start={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function PhotoViewer({ photos, start, onClose }: { photos: ReviewPhoto[]; start: number; onClose: () => void }) {
  const [index, setIndex] = useState(start);
  const insets = useSafeAreaInsets();
  const photo = photos[index];
  const navButton = (label: string, target: number) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label === '‹' ? 'Previous photo' : 'Next photo'}
      onPress={() => setIndex(target)}
      hitSlop={12}
      style={{ padding: space.md }}>
      <Text style={{ color: '#fff', fontSize: 36 }}>{label}</Text>
    </Pressable>
  );

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: space.md }}>
          <Text style={{ color: '#fff', fontSize: 14 }}>
            {index + 1} / {photos.length}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={12}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Close ✕</Text>
          </Pressable>
        </View>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 56 }}>{index > 0 && navButton('‹', index - 1)}</View>
          <Image source={{ uri: photoUrl(photo.path) }} style={{ flex: 1, height: '100%' }} contentFit="contain" transition={150} />
          <View style={{ width: 56 }}>{index < photos.length - 1 && navButton('›', index + 1)}</View>
        </View>
      </View>
    </Modal>
  );
}
