import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { ThemeColors } from '../../../theme/colors';
import type { BusyBlock } from './calendarUtils';
import {
  addDays,
  addMonths,
  blocksForDay,
  dayHasBusy,
  daysInMonth,
  isSameDay,
  startOfDay,
  startOfWeekMonday,
} from './calendarUtils';

export type CalendarViewMode = 'year' | 'month' | 'week' | 'day';

export type TogetherSlot = { startMs: number; endMs: number; title: string };

const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

type Props = {
  colors: ThemeColors;
  view: CalendarViewMode;
  onViewChange: (v: CalendarViewMode) => void;
  focusedDate: Date;
  onFocusedDateChange: (d: Date) => void;
  myBusy: BusyBlock[];
  partnerBusy: BusyBlock[];
  partnerEnabled: boolean;
  /** Pending / accepted time-together blocks from Firestore — shown on the calendar. */
  togetherSlots?: TogetherSlot[];
};

export function CoupleCalendarView({
  colors,
  view,
  onViewChange,
  focusedDate,
  onFocusedDateChange,
  myBusy,
  partnerBusy,
  partnerEnabled,
  togetherSlots = [],
}: Props) {
  const y = focusedDate.getFullYear();
  const m = focusedDate.getMonth();

  const togetherBusy = React.useMemo(
    () => togetherSlots.map((s) => ({ startMs: s.startMs, endMs: s.endMs })),
    [togetherSlots]
  );

  const renderViewTabs = () => (
    <View style={styles.viewTabs}>
      {(['year', 'month', 'week', 'day'] as const).map((mode) => {
        const on = view === mode;
        return (
          <Pressable
            key={mode}
            onPress={() => onViewChange(mode)}
            style={[
              styles.viewTab,
              {
                borderColor: on ? colors.gold : colors.border,
                backgroundColor: on ? 'rgba(231,199,125,0.15)' : 'transparent',
              },
            ]}
          >
            <Text style={[styles.viewTabText, { color: on ? colors.text : colors.muted }]}>
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const renderYear = () => {
    return (
      <View style={styles.yearWrap}>
        <View style={styles.yearNav}>
          <Pressable onPress={() => onFocusedDateChange(addMonths(focusedDate, -12))} hitSlop={10}>
            <Ionicons name="chevron-back" size={22} color={colors.gold} />
          </Pressable>
          <Text style={[styles.yearTitle, { color: colors.text }]}>{y}</Text>
          <Pressable onPress={() => onFocusedDateChange(addMonths(focusedDate, 12))} hitSlop={10}>
            <Ionicons name="chevron-forward" size={22} color={colors.gold} />
          </Pressable>
        </View>
        <View style={styles.yearGrid}>
          {MONTH_LABELS.map((label, idx) => {
            const busyMine = dayHasBusy(new Date(y, idx, 15), myBusy);
            const busyP = partnerEnabled && dayHasBusy(new Date(y, idx, 15), partnerBusy);
            const busyT = dayHasBusy(new Date(y, idx, 15), togetherBusy);
            return (
              <Pressable
                key={label}
                onPress={() => {
                  onFocusedDateChange(new Date(y, idx, 1));
                  onViewChange('month');
                }}
                style={[
                  styles.yearCell,
                  { borderColor: colors.border, backgroundColor: colors.surface },
                ]}
              >
                <Text style={[styles.yearCellLabel, { color: colors.text }]}>{label.slice(0, 3)}</Text>
                <View style={styles.yearDots}>
                  {busyMine ? <View style={[styles.dot, { backgroundColor: colors.gold }]} /> : null}
                  {busyP ? <View style={[styles.dot, { backgroundColor: '#EC4899' }]} /> : null}
                  {busyT ? <View style={[styles.dot, { backgroundColor: '#22c55e' }]} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  };

  const renderMonth = () => {
    const first = new Date(y, m, 1);
    const startPad = first.getDay();
    const dim = daysInMonth(y, m);
    const cells: (number | null)[] = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= dim; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    while (cells.length < 42) cells.push(null);

    const today = new Date();

    return (
      <View>
        <View style={styles.monthNav}>
          <Pressable onPress={() => onFocusedDateChange(addMonths(focusedDate, -1))} hitSlop={10}>
            <Ionicons name="chevron-back" size={24} color={colors.gold} />
          </Pressable>
          <Text style={[styles.monthTitle, { color: colors.text }]}>
            {MONTH_LABELS[m]} {y}
          </Text>
          <Pressable onPress={() => onFocusedDateChange(addMonths(focusedDate, 1))} hitSlop={10}>
            <Ionicons name="chevron-forward" size={24} color={colors.gold} />
          </Pressable>
        </View>
        <View style={styles.weekHeader}>
          {WEEKDAY_LETTERS.map((d, i) => (
            <Text key={i} style={[styles.weekHeaderCell, { color: colors.muted }]}>
              {d}
            </Text>
          ))}
        </View>
        <View style={styles.monthGrid}>
          {cells.map((d, i) => {
            if (d == null) return <View key={`e-${i}`} style={styles.monthCell} />;
            const cellDate = new Date(y, m, d);
            const isToday = isSameDay(cellDate, today);
            const bMine = dayHasBusy(cellDate, myBusy);
            const bP = partnerEnabled && dayHasBusy(cellDate, partnerBusy);
            const bT = dayHasBusy(cellDate, togetherBusy);
            return (
              <Pressable
                key={d}
                onPress={() => {
                  onFocusedDateChange(cellDate);
                  onViewChange('day');
                }}
                style={[
                  styles.monthCell,
                  {
                    borderColor: isToday ? colors.gold : 'transparent',
                    backgroundColor: isToday ? 'rgba(231,199,125,0.12)' : 'transparent',
                  },
                ]}
              >
                <Text style={[styles.monthCellNum, { color: colors.text }]}>{d}</Text>
                <View style={styles.monthDots}>
                  {bMine ? <View style={[styles.dotSm, { backgroundColor: colors.gold }]} /> : null}
                  {bP ? <View style={[styles.dotSm, { backgroundColor: '#EC4899' }]} /> : null}
                  {bT ? <View style={[styles.dotSm, { backgroundColor: '#22c55e' }]} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  };

  const renderWeek = () => {
    const start = startOfWeekMonday(focusedDate);
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    return (
      <View>
        <View style={styles.monthNav}>
          <Pressable onPress={() => onFocusedDateChange(addDays(focusedDate, -7))} hitSlop={10}>
            <Ionicons name="chevron-back" size={24} color={colors.gold} />
          </Pressable>
          <Text style={[styles.monthTitle, { color: colors.text }]} numberOfLines={1}>
            Week of {start.toLocaleDateString([], { month: 'short', day: 'numeric' })} –{' '}
            {addDays(start, 6).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
          </Text>
          <Pressable onPress={() => onFocusedDateChange(addDays(focusedDate, 7))} hitSlop={10}>
            <Ionicons name="chevron-forward" size={24} color={colors.gold} />
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.weekRow}>
            {days.map((day) => {
              const mine = blocksForDay(day, myBusy);
              const p = partnerEnabled ? blocksForDay(day, partnerBusy) : [];
              const dayLo = startOfDay(day).getTime();
              const dayHi = dayLo + 86400000;
              const togetherDay = togetherSlots.filter((s) => s.startMs < dayHi && s.endMs > dayLo);
              const isSel = isSameDay(day, focusedDate);
              return (
                <Pressable
                  key={day.toISOString()}
                  onPress={() => {
                    onFocusedDateChange(day);
                    onViewChange('day');
                  }}
                  style={[
                    styles.weekCol,
                    { borderColor: colors.border, backgroundColor: colors.surface },
                    isSel && { borderColor: colors.gold, borderWidth: 2 },
                  ]}
                >
                  <Text style={[styles.weekColHead, { color: colors.muted }]}>
                    {day.toLocaleDateString([], { weekday: 'short' })}
                  </Text>
                  <Text style={[styles.weekColDate, { color: colors.text }]}>
                    {day.getDate()}
                  </Text>
                  {mine.map((b) => (
                    <View
                      key={`m-${b.startMs}`}
                      style={[styles.busyPill, { backgroundColor: 'rgba(231,199,125,0.35)' }]}
                    >
                      <Text style={styles.busyPillText} numberOfLines={1}>
                        Busy
                      </Text>
                    </View>
                  ))}
                  {p.map((b) => (
                    <View
                      key={`p-${b.startMs}`}
                      style={[styles.busyPill, { backgroundColor: 'rgba(236,72,153,0.28)' }]}
                    >
                      <Text style={styles.busyPillText} numberOfLines={1}>
                        Busy
                      </Text>
                    </View>
                  ))}
                  {togetherDay.map((s, ti) => (
                    <View
                      key={`t-${s.startMs}-${ti}`}
                      style={[styles.busyPill, { backgroundColor: 'rgba(34,197,94,0.32)' }]}
                    >
                      <Text style={styles.busyPillText} numberOfLines={2}>
                        {s.title}
                      </Text>
                    </View>
                  ))}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>
    );
  };

  const renderDay = () => {
    const dayStart = startOfDay(focusedDate);
    const dayLo = dayStart.getTime();
    const dayHi = dayLo + 86400000;
    const mine = blocksForDay(dayStart, myBusy);
    const p = partnerEnabled ? blocksForDay(dayStart, partnerBusy) : [];
    const hours = Array.from({ length: 18 }, (_, i) => i + 5);
    const FIRST_H = hours[0]!;
    const ROW_H = 44;
    const MS_PER_H = 3600000;
    const timelineStartMs = dayLo + FIRST_H * MS_PER_H;
    const timelineEndMs = dayLo + (FIRST_H + hours.length) * MS_PER_H;

    const togetherForDay = togetherSlots.filter((s) => s.startMs < dayHi && s.endMs > dayLo);

    return (
      <View>
        <View style={styles.monthNav}>
          <Pressable onPress={() => onFocusedDateChange(addDays(focusedDate, -1))} hitSlop={10}>
            <Ionicons name="chevron-back" size={24} color={colors.gold} />
          </Pressable>
          <Text style={[styles.monthTitle, { color: colors.text }]}>
            {focusedDate.toLocaleDateString([], {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
          <Pressable onPress={() => onFocusedDateChange(addDays(focusedDate, 1))} hitSlop={10}>
            <Ionicons name="chevron-forward" size={24} color={colors.gold} />
          </Pressable>
        </View>
        <View style={[styles.dayGrid, { borderColor: colors.border }]}>
          <View style={styles.dayTimelineWrap}>
            <View style={styles.dayHourCol}>
              {hours.map((h) => {
                const label = new Date(dayStart);
                label.setHours(h, 0, 0, 0);
                return (
                  <View key={h} style={[styles.dayHourCell, { height: ROW_H }]}>
                    <Text style={[styles.dayHour, { color: colors.muted }]}>
                      {label.toLocaleTimeString([], { hour: 'numeric' })}
                    </Text>
                  </View>
                );
              })}
            </View>
            <View
              style={[
                styles.dayTimelineBody,
                { height: hours.length * ROW_H, backgroundColor: colors.cardGlow },
              ]}
            >
              {hours.map((h, i) => {
                const label = new Date(dayStart);
                label.setHours(h, 0, 0, 0);
                const slotStart = label.getTime();
                const slotEnd = slotStart + MS_PER_H;
                const busyMine = mine.some((b) => b.startMs < slotEnd && b.endMs > slotStart);
                const busyP = p.some((b) => b.startMs < slotEnd && b.endMs > slotStart);
                return (
                  <View
                    key={h}
                    style={[
                      styles.dayTimelineRow,
                      {
                        top: i * ROW_H,
                        height: ROW_H,
                        borderBottomColor: colors.border,
                      },
                    ]}
                  >
                    {busyMine ? (
                      <View style={[styles.dayBusy, { backgroundColor: 'rgba(231,199,125,0.45)' }]}>
                        <Text style={styles.dayBusyText}>Busy (you)</Text>
                      </View>
                    ) : null}
                    {busyP ? (
                      <View style={[styles.dayBusy, { backgroundColor: 'rgba(236,72,153,0.35)' }]}>
                        <Text style={styles.dayBusyText}>Busy (partner)</Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
              {togetherForDay.map((s, ti) => {
                const visStart = Math.max(s.startMs, timelineStartMs);
                const visEnd = Math.min(s.endMs, timelineEndMs);
                if (visEnd <= visStart) return null;
                const top = ((visStart - timelineStartMs) / MS_PER_H) * ROW_H;
                const blockH = Math.max(((visEnd - visStart) / MS_PER_H) * ROW_H, 22);
                const lines = blockH >= ROW_H + 18 ? 4 : blockH >= ROW_H - 4 ? 2 : 1;
                return (
                  <View
                    key={`tg-${s.startMs}-${ti}`}
                    style={[
                      styles.dayTogetherBlock,
                      {
                        top,
                        height: blockH,
                        backgroundColor: 'rgba(34,197,94,0.42)',
                      },
                    ]}
                  >
                    <Text style={styles.dayBusyText} numberOfLines={lines}>
                      Together · {s.title}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      {renderViewTabs()}
      <View style={styles.body}>
        {view === 'year' ? renderYear() : null}
        {view === 'month' ? renderMonth() : null}
        {view === 'week' ? renderWeek() : null}
        {view === 'day' ? renderDay() : null}
      </View>
      <View style={styles.legend}>
        <View style={styles.legendRow}>
          <View style={[styles.dot, { backgroundColor: colors.gold }]} />
          <Text style={[styles.legendText, { color: colors.muted }]}>Your busy</Text>
        </View>
        {partnerEnabled ? (
          <View style={styles.legendRow}>
            <View style={[styles.dot, { backgroundColor: '#EC4899' }]} />
            <Text style={[styles.legendText, { color: colors.muted }]}>Partner busy</Text>
          </View>
        ) : null}
        <View style={styles.legendRow}>
          <View style={[styles.dot, { backgroundColor: '#22c55e' }]} />
          <Text style={[styles.legendText, { color: colors.muted }]}>Time together (CoupliX)</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  viewTabs: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingTop: 10,
    paddingBottom: 6,
    gap: 6,
    flexWrap: 'wrap',
  },
  viewTab: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  viewTabText: { fontSize: 13, fontWeight: '800' },
  body: { paddingHorizontal: 10, paddingBottom: 12 },
  yearWrap: { paddingTop: 4 },
  yearNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  yearTitle: { fontSize: 20, fontWeight: '900' },
  yearGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  yearCell: {
    width: '30%',
    minWidth: 96,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  yearCellLabel: { fontSize: 14, fontWeight: '900' },
  yearDots: { flexDirection: 'row', gap: 4, marginTop: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotSm: { width: 6, height: 6, borderRadius: 3 },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  monthTitle: { fontSize: 17, fontWeight: '900', flex: 1, textAlign: 'center' },
  weekHeader: { flexDirection: 'row', marginBottom: 4 },
  weekHeaderCell: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '800' },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  monthCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 4,
  },
  monthCellNum: { fontSize: 15, fontWeight: '800' },
  monthDots: { flexDirection: 'row', gap: 3, marginTop: 2 },
  weekRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  weekCol: {
    width: 112,
    borderRadius: 12,
    borderWidth: 1,
    padding: 8,
    minHeight: 160,
  },
  weekColHead: { fontSize: 12, fontWeight: '800', textAlign: 'center' },
  weekColDate: { fontSize: 20, fontWeight: '900', textAlign: 'center', marginBottom: 8 },
  busyPill: {
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginBottom: 4,
  },
  busyPillText: { fontSize: 11, fontWeight: '900', color: '#17131A' },
  dayGrid: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  dayTimelineWrap: { flexDirection: 'row' },
  dayHourCol: { width: 56 },
  dayHourCell: { paddingLeft: 8, justifyContent: 'flex-start', paddingTop: 10 },
  dayHour: { fontSize: 12, fontWeight: '800' },
  dayTimelineBody: { flex: 1, position: 'relative' },
  dayTimelineRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    padding: 4,
    justifyContent: 'center',
    zIndex: 0,
  },
  dayTogetherBlock: {
    position: 'absolute',
    left: 4,
    right: 4,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    zIndex: 2,
    overflow: 'hidden',
    justifyContent: 'flex-start',
  },
  dayBusy: { borderRadius: 8, paddingVertical: 6, paddingHorizontal: 8, marginVertical: 2 },
  dayBusyText: { fontSize: 12, fontWeight: '900', color: '#17131A' },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { fontSize: 12, fontWeight: '700' },
});
