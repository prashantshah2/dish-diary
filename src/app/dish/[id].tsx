import { router, useLocalSearchParams } from 'expo-router';

import { DishReviews } from '@/components/dish-reviews';
import { Screen } from '@/components/ui';

/** Phone-sized view of one dish. Wider screens show this beside the dish list instead. */
export default function DishScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Screen>
      <DishReviews key={id} dishId={id} onDeleted={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
    </Screen>
  );
}
