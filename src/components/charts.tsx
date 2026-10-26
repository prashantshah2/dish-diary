import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { radius, space, useColors } from '@/lib/theme';

import { AppText, Row } from './ui';

/**
 * Small chart kit built from plain views, so it renders the same on the website
 * and in the iPhone app. Bars are rounded at the data end, separated by 2px gaps;
 * text always uses text colors, never the series color.
 */

export type Series = { name: string; color: string };
export type ColumnDatum = { label: string; values: number[] };

/** Rounds an axis maximum up to 1/2/5 × 10ⁿ so gridline labels are friendly. */
function niceMax(n: number): number {
  if (n <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(n));
  const step = [1, 2, 5, 10].find((s) => s * pow >= n) ?? 10;
  return step * pow;
}

function LegendKey({ color }: { color: string }) {
  return <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color }} />;
}

export function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null;
  return (
    <Row wrap style={{ gap: space.md }}>
      {series.map((s) => (
        <Row key={s.name} style={{ gap: 6 }}>
          <LegendKey color={s.color} />
          <AppText variant="small">{s.name}</AppText>
        </Row>
      ))}
    </Row>
  );
}

/**
 * Vertical bars per bucket (day/week). `stacked` stacks the series; otherwise they sit side
 * by side. Hover (web) or tap (phone) a column to read every series for that bucket.
 */
export function ColumnChart({
  data,
  series,
  stacked = false,
  height = 160,
  emptyText = 'Nothing in this range yet.',
}: {
  data: ColumnDatum[];
  series: Series[];
  stacked?: boolean;
  height?: number;
  emptyText?: string;
}) {
  const c = useColors();
  const [active, setActive] = useState<number | null>(null);
  const totals = data.map((d) => (stacked ? d.values.reduce((a, b) => a + b, 0) : Math.max(0, ...d.values)));
  const max = niceMax(Math.max(0, ...totals));
  const allZero = totals.every((t) => t === 0);
  const shown = active ?? data.length - 1;
  const ticks = [max, max / 2, 0];
  const many = data.length > 40;

  return (
    <View style={{ gap: space.sm }}>
      {/* Readout: the hovered/tapped bucket, or the latest one. Values lead, names follow. */}
      <Row wrap style={{ gap: space.md, minHeight: 22 }}>
        <AppText variant="label">{data[shown]?.label ?? ''}</AppText>
        {data[shown] &&
          series.map((s, i) => (
            <Row key={s.name} style={{ gap: 6 }}>
              <View style={{ width: 12, height: 2, backgroundColor: s.color }} />
              <Text style={{ color: c.text, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{data[shown].values[i]}</Text>
              <AppText variant="small">{s.name}</AppText>
            </Row>
          ))}
      </Row>

      <View style={{ flexDirection: 'row', height }}>
        {/* Y axis labels */}
        <View style={{ width: 32, justifyContent: 'space-between', paddingRight: 6 }}>
          {ticks.map((t) => (
            <Text key={t} style={{ color: c.textMuted, fontSize: 11, textAlign: 'right', fontVariant: ['tabular-nums'] }}>
              {Math.round(t)}
            </Text>
          ))}
        </View>
        <View style={{ flex: 1 }}>
          {/* Recessive gridlines at the tick positions */}
          {ticks.map((t, i) => (
            <View
              key={t}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: `${(i / (ticks.length - 1)) * 100}%`,
                height: 1,
                backgroundColor: i === ticks.length - 1 ? c.border : c.chartGrid,
              }}
            />
          ))}
          {allZero ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <AppText variant="small">{emptyText}</AppText>
            </View>
          ) : (
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end' }}>
              {data.map((d, i) => (
                <Pressable
                  key={d.label + i}
                  accessibilityRole="button"
                  accessibilityLabel={`${d.label}: ${series.map((s, k) => `${d.values[k]} ${s.name}`).join(', ')}`}
                  onPress={() => setActive(i)}
                  onHoverIn={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  style={{
                    flex: 1,
                    height: '100%',
                    justifyContent: 'flex-end',
                    paddingHorizontal: many ? 0.5 : 2,
                    backgroundColor: active === i ? c.surfaceAlt : 'transparent',
                    borderRadius: 4,
                  }}>
                  {stacked ? (
                    <View style={{ gap: 2 }}>
                      {[...series.keys()].reverse().map((k) =>
                        d.values[k] > 0 ? (
                          <View
                            key={k}
                            style={{
                              height: Math.max(2, (d.values[k] / max) * height - 2), // 2px gap between segments
                              backgroundColor: series[k].color,
                              borderTopLeftRadius: k === lastNonZero(d.values) ? 4 : 0,
                              borderTopRightRadius: k === lastNonZero(d.values) ? 4 : 0,
                            }}
                          />
                        ) : null
                      )}
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: '100%' }}>
                      {series.map((s, k) => (
                        <View
                          key={s.name}
                          style={{
                            flex: 1,
                            height: d.values[k] > 0 ? Math.max(2, (d.values[k] / max) * height) : 0,
                            backgroundColor: s.color,
                            borderTopLeftRadius: 4,
                            borderTopRightRadius: 4,
                          }}
                        />
                      ))}
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* X labels: first, middle and last bucket only, so they never collide. */}
      {data.length > 0 && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 32 }}>
          <AppText variant="small">{data[0].label}</AppText>
          {data.length > 2 && <AppText variant="small">{data[Math.floor((data.length - 1) / 2)].label}</AppText>}
          {data.length > 1 && <AppText variant="small">{data[data.length - 1].label}</AppText>}
        </View>
      )}
      <Legend series={series} />
    </View>
  );
}

/** Index of the topmost (last) non-zero segment, which gets the rounded data end. */
function lastNonZero(values: number[]): number {
  for (let i = values.length - 1; i >= 0; i--) if (values[i] > 0) return i;
  return -1;
}

/** Horizontal bars, largest first. Names and numbers stay in text colors. */
export function HBarList({
  items,
  color,
  unit,
  limit = 10,
}: {
  items: { name: string; value: number }[];
  color: string;
  unit?: (n: number) => string;
  limit?: number;
}) {
  const c = useColors();
  if (!items.length) return <AppText variant="small">Nothing in this range yet.</AppText>;
  const shown = items.slice(0, limit);
  const max = Math.max(...shown.map((i) => i.value), 1);
  return (
    <View style={{ gap: space.sm }}>
      {shown.map((it) => (
        <View key={it.name} style={{ gap: 4 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <AppText variant="small" style={{ color: c.text, flexShrink: 1 }} numberOfLines={1}>
              {it.name}
            </AppText>
            <Text style={{ color: c.text, fontWeight: '600', fontSize: 13, fontVariant: ['tabular-nums'] }}>
              {unit ? unit(it.value) : it.value}
            </Text>
          </Row>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: c.chartGrid }}>
            <View style={{ width: `${(it.value / max) * 100}%`, height: '100%', borderRadius: 4, backgroundColor: color }} />
          </View>
        </View>
      ))}
      {items.length > limit && <AppText variant="small">+ {items.length - limit} more</AppText>}
    </View>
  );
}

/** One 100% bar split into Must try / Mixed / Skip, each segment labeled with its count. */
export function VerdictBar({ mustTry, mixed, skip }: { mustTry: number; mixed: number; skip: number }) {
  const c = useColors();
  const total = mustTry + mixed + skip;
  if (!total) return <AppText variant="small">No dish verdicts in this range yet.</AppText>;
  const parts = [
    { label: 'Must try', n: mustTry, fill: c.liked },
    { label: 'Mixed', n: mixed, fill: c.star },
    { label: 'Skip', n: skip, fill: c.disliked },
  ];
  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', height: 14, gap: 2 }}>
        {parts
          .filter((p) => p.n > 0)
          .map((p, i, arr) => (
            <View
              key={p.label}
              style={{
                flex: p.n,
                backgroundColor: p.fill,
                borderTopLeftRadius: i === 0 ? 4 : 0,
                borderBottomLeftRadius: i === 0 ? 4 : 0,
                borderTopRightRadius: i === arr.length - 1 ? 4 : 0,
                borderBottomRightRadius: i === arr.length - 1 ? 4 : 0,
              }}
            />
          ))}
      </View>
      <Row wrap style={{ gap: space.md }}>
        {parts.map((p) => (
          <Row key={p.label} style={{ gap: 6 }}>
            <LegendKey color={p.fill} />
            <Text style={{ color: c.text, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{p.n}</Text>
            <AppText variant="small">
              {p.label} ({Math.round((p.n / total) * 100)}%)
            </AppText>
          </Row>
        ))}
      </Row>
    </View>
  );
}

/** Usage meter with status: OK below 70%, warning to 90%, critical above — always with a label. */
export function Meter({ label, used, total, format }: { label: string; used: number; total: number; format: (n: number) => string }) {
  const c = useColors();
  const pct = total > 0 ? used / total : 0;
  const status = pct >= 0.9 ? { text: 'Critical', fg: c.danger, bar: c.danger } : pct >= 0.7 ? { text: 'Getting full', fg: c.warning, bar: c.warning } : { text: 'OK', fg: c.liked, bar: c.liked };
  return (
    <View style={{ gap: 6 }}>
      <Row style={{ justifyContent: 'space-between' }} wrap>
        <AppText variant="label">{label}</AppText>
        <Text style={{ color: c.text, fontVariant: ['tabular-nums'] }}>
          {format(used)} of {format(total)} · {(pct * 100).toFixed(pct < 0.1 ? 1 : 0)}%
        </Text>
      </Row>
      <View style={{ height: 10, borderRadius: radius.pill, backgroundColor: c.chartGrid }}>
        <View style={{ width: `${Math.min(100, Math.max(pct * 100, pct > 0 ? 1 : 0))}%`, height: '100%', borderRadius: radius.pill, backgroundColor: status.bar }} />
      </View>
      <Text style={{ color: status.fg, fontSize: 12, fontWeight: '700' }}>● {status.text}</Text>
    </View>
  );
}

/** Headline number with change versus the previous period of the same length. */
export function StatTile({ label, value, previous }: { label: string; value: number; previous: number }) {
  const c = useColors();
  const diff = value - previous;
  const change = diff === 0 ? 'Same as previous period' : `${diff > 0 ? '▲ +' : '▼ '}${diff} vs previous period`;
  return (
    <View style={{ gap: 2, borderTopWidth: 3, borderTopColor: c.chart1, paddingTop: space.sm }}>
      <Text style={{ color: c.text, fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{value}</Text>
      <AppText variant="small" style={{ color: c.text }}>{label}</AppText>
      <AppText variant="small">{change}</AppText>
    </View>
  );
}
