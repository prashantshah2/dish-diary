import { useState } from 'react';

import { friendlyError, supabase } from '@/lib/supabase';
import type { ReportTarget } from '@/lib/types';

import { ContributorGate } from './contributor-gate';
import { AppText, Button, Card, Field, Notice, Row } from './ui';

export function ReportButton({ type, id }: { type: ReportTarget; id: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) return <AppText variant="small">Thanks — reported.</AppText>;

  if (!open) {
    return (
      <AppText variant="small" accessibilityRole="button" onPress={() => setOpen(true)} style={{ textDecorationLine: 'underline' }}>
        Report
      </AppText>
    );
  }

  const submit = async () => {
    setBusy(true);
    const { error: err } = await supabase
      .from('reports')
      .insert({ target_type: type, target_id: id, reason: reason.trim() || null });
    setBusy(false);
    // Reporting the same thing twice is fine — treat it as done.
    if (err && err.code !== '23505') setError(friendlyError(err));
    else setDone(true);
  };

  return (
    <ContributorGate>
      <Card>
        <Field
          label={`Report this ${type}`}
          value={reason}
          onChangeText={setReason}
          placeholder="What's wrong? (spam, offensive, wrong info…)"
          maxLength={500}
        />
        <Notice message={error} />
        <Row>
          <Button title="Send report" onPress={submit} loading={busy} compact />
          <Button title="Cancel" variant="ghost" onPress={() => setOpen(false)} compact />
        </Row>
      </Card>
    </ContributorGate>
  );
}
