import { Link } from 'expo-router';

import { AppText, Card, Screen } from '@/components/ui';

export default function AboutScreen() {
  return (
    <Screen>
      <AppText variant="title">About Dish Diary</AppText>
      <Card>
        <AppText variant="heading">What it’s for</AppText>
        <AppText>
          Before you go to a restaurant, see which dishes people liked and which to skip. After you go, add your own
          thumbs up or down so the next person orders well.
        </AppText>
      </Card>
      <Card>
        <AppText variant="heading">Privacy</AppText>
        <AppText>
          You don’t need an account. The first time you post, the app creates an anonymous ID stored on this device so
          you can edit or delete your own posts. If you clear your browser data or switch devices, that ID is lost and
          your posts stay up but can no longer be edited by you.
        </AppText>
        <AppText>
          Anything you post — including the name you choose to show — is public. Don’t post personal information. We
          use Cloudflare Turnstile to block spam bots and Supabase to store data.
        </AppText>
        <AppText>
          To count visits, the app keeps a random ID on your device and records when you open the app and whether it’s
          the website or the iPhone app. It doesn’t record your IP address, location or what you look at, and nothing
          is shared with advertisers or analytics companies.
        </AppText>
      </Card>
      <Card>
        <AppText variant="heading">Community rules</AppText>
        <AppText>
          Review food honestly. No spam, ads, hate, harassment, or personal attacks on staff. Use “Report” on anything
          that breaks these rules; posts reported by several people are hidden automatically and reviewed.
        </AppText>
      </Card>
      <Link href="/admin">
        <AppText variant="small" style={{ textDecorationLine: 'underline' }}>Admin sign-in</AppText>
      </Link>
    </Screen>
  );
}
