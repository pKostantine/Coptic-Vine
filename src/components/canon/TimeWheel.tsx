'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import { tr } from '@/utils/appText';
import { toEasternArabicDigits } from '@/utils/localeFormat';
import { getCurrentAppLanguage } from '@/utils/preferencesStorage';
import { canonTime, parseCanonTime } from '@/utils/spiritualCanon';

/** One row of a wheel, and the five rows it shows (the chosen one in the middle). */
const ROW = 42;
const VISIBLE = 5;
const PAD = ROW * Math.floor(VISIBLE / 2);

export interface TimeWheelProps {
  /** "HH:MM", 24-hour. */
  time: string;
  onChange: (time: string) => void;
  arabic: boolean;
}

/**
 * The time of day on wheels, as the iPhone's Alarm sets it: the hour, the
 * minute and (on the twelve-hour clock) AM or PM, each a column that scrolls
 * and settles on the row in the band across the middle, the hours and
 * minutes going round and round. This is the Android and web picker; the
 * iPhone and iPad use the system's own (TimeWheel.ios.tsx).
 */
export default function TimeWheel({ time, onChange, arabic }: TimeWheelProps) {
  const { hour, minute } = parseCanonTime(time);
  const twentyFour = getCurrentAppLanguage() === 'fr';
  const digits = (value: number, pad: boolean) => {
    const text = pad ? String(value).padStart(2, '0') : String(value);
    return arabic ? toEasternArabicDigits(text) : text;
  };
  const hours = twentyFour
    ? Array.from({ length: 24 }, (_, value) => digits(value, true))
    : [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((value) => digits(value, false));
  const minutes = Array.from({ length: 60 }, (_, value) => digits(value, true));
  const evening = hour >= 12;

  return (
    <View style={styles.wheel} accessibilityLabel={tr('Time of day', 'Heure', 'الوقت')}>
      <View style={styles.band} />
      <View style={styles.columns}>
        <WheelColumn
          values={hours}
          selected={twentyFour ? hour : hour % 12}
          loop
          width={76}
          label={tr('Hour', 'Heure', 'الساعة')}
          onSelect={(index) => onChange(canonTime(twentyFour ? index : index + (evening ? 12 : 0), minute))}
        />
        <WheelColumn
          values={minutes}
          selected={minute}
          loop
          width={76}
          label={tr('Minutes', 'Minutes', 'الدقائق')}
          onSelect={(index) => onChange(canonTime(hour, index))}
        />
        {twentyFour ? null : (
          <WheelColumn
            values={[tr('AM', 'AM', 'ص'), tr('PM', 'PM', 'م')]}
            selected={evening ? 1 : 0}
            loop={false}
            width={66}
            label={tr('Morning or evening', 'Matin ou soir', 'صباحًا أو مساءً')}
            onSelect={(index) => onChange(canonTime((hour % 12) + (index === 1 ? 12 : 0), minute))}
          />
        )}
      </View>
      {/* The rows fade as they turn away, top and bottom. */}
      <LinearGradient colors={[COLORS.surface, 'rgba(11, 28, 16, 0)']} style={[styles.fade, styles.fadeTop]} pointerEvents="none" />
      <LinearGradient colors={['rgba(11, 28, 16, 0)', COLORS.surface]} style={[styles.fade, styles.fadeBottom]} pointerEvents="none" />
    </View>
  );
}

/** How many times a looping column's values are laid end to end: enough to spin through, an odd number so the start is the middle. */
function cyclesFor(count: number, loop: boolean): number {
  if (!loop) return 1;
  const cycles = Math.max(5, Math.ceil(240 / count));
  return cycles % 2 ? cycles : cycles + 1;
}

function WheelColumn({ values, selected, loop, width, label, onSelect }: {
  values: string[];
  selected: number;
  loop: boolean;
  width: number;
  label: string;
  onSelect: (index: number) => void;
}) {
  const count = values.length;
  const cycles = cyclesFor(count, loop);
  const middle = Math.floor(cycles / 2) * count;
  const total = count * cycles;
  const scrollRef = useRef<ScrollView>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Placed on the chosen row once, when first laid out (Android and the web do not take contentOffset).
  const placed = useRef(false);
  const [startRow] = useState(() => middle + selected);
  // The row in the band right now, for its brighter type.
  const [centerRow, setCenterRow] = useState(startRow);
  // The choice as it stands, for handlers that outlive a render: a settle
  // timer, and the rows, which are memoized and keep their first handler.
  const latest = useRef({ selected, onSelect });
  useEffect(() => {
    latest.current = { selected, onSelect };
  });
  const choose = useCallback((index: number) => {
    if (index !== latest.current.selected) latest.current.onSelect(index);
  }, []);

  const rowAt = (y: number) => Math.max(0, Math.min(total - 1, Math.round(y / ROW)));
  const scrollToRow = (row: number, animated: boolean) => scrollRef.current?.scrollTo({ x: 0, y: row * ROW, animated });

  // The column has come to rest: what is in the band is chosen. A looping
  // column that has drifted towards either end goes back to the middle
  // unseen, so it never runs out.
  const settle = (y: number) => {
    const row = rowAt(y);
    const index = row % count;
    if (loop && (row < count || row >= total - count)) {
      scrollToRow(middle + index, false);
      setCenterRow(middle + index);
    }
    choose(index);
  };

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y;
    const row = rowAt(y);
    if (row !== centerRow) setCenterRow(row);
    // The web sends no end of momentum: rest is a pause in the scrolling.
    if (Platform.OS === 'web') {
      if (settleTimer.current) clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(() => settle(y), 140);
    }
  };
  const onScrollEndDrag = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    // Released without a fling: no momentum follows to settle it.
    settleTimer.current = setTimeout(() => settle(y), 80);
  };
  const onMomentumScrollBegin = () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
  };
  const onMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => settle(event.nativeEvent.contentOffset.y);

  // A screen reader's swipe up or down: the next row or the one before.
  const step = (by: number) => {
    const row = centerRow + by;
    if (row < 0 || row >= total) return;
    scrollToRow(row, true);
    setCenterRow(row);
    choose(row % count);
  };

  // A row tapped turns to the band. One handler for every row, so a memoized row never holds an old one.
  const pressRow = useCallback((row: number) => {
    scrollRef.current?.scrollTo({ x: 0, y: row * ROW, animated: true });
    setCenterRow(row);
    choose(row % count);
  }, [choose, count]);

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: values[selected] }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => step(event.nativeEvent.actionName === 'increment' ? 1 : -1)}
      style={{ height: ROW * VISIBLE, width }}
    >
      <ScrollView
        ref={scrollRef}
        contentOffset={{ x: 0, y: startRow * ROW }}
        onLayout={() => {
          if (placed.current) return;
          placed.current = true;
          scrollToRow(startRow, false);
        }}
        showsVerticalScrollIndicator={false}
        snapToInterval={ROW}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={onScroll}
        onScrollEndDrag={onScrollEndDrag}
        onMomentumScrollBegin={onMomentumScrollBegin}
        onMomentumScrollEnd={onMomentumScrollEnd}
        nestedScrollEnabled
        style={WEB_SNAP_CONTAINER}
        contentContainerStyle={{ paddingVertical: PAD }}
      >
        {Array.from({ length: total }, (_, row) => (
          <WheelRow
            key={row}
            row={row}
            label={values[row % count]}
            emphasis={Math.min(3, Math.abs(row - centerRow))}
            onPress={pressRow}
          />
        ))}
      </ScrollView>
    </View>
  );
}

// The web snaps the rows into the band with CSS scroll snapping.
const WEB_SNAP_CONTAINER = Platform.OS === 'web' ? ({ scrollSnapType: 'y mandatory' } as object) : undefined;
const WEB_SNAP_ROW = Platform.OS === 'web' ? ({ scrollSnapAlign: 'center' } as object) : undefined;

/** A row: bright in the band, dimmer the further it turns away. Only the rows whose place changes render again. */
const WheelRow = memo(function WheelRow({ row, label, emphasis, onPress }: { row: number; label: string; emphasis: number; onPress: (row: number) => void }) {
  return (
    <Pressable accessible={false} focusable={false} onPress={() => onPress(row)} style={[styles.row, WEB_SNAP_ROW]}>
      <Text
        style={[styles.rowText, emphasis === 0 && styles.rowTextCenter, { opacity: EMPHASIS_OPACITY[emphasis] }]}
        maxFontSizeMultiplier={1.2}
      >
        {label}
      </Text>
    </Pressable>
  );
});

const EMPHASIS_OPACITY = [1, 0.62, 0.38, 0.22];

const styles = StyleSheet.create({
  wheel: { alignSelf: 'center', height: ROW * VISIBLE, justifyContent: 'center', overflow: 'hidden', width: '100%' },
  columns: { flexDirection: 'row', gap: 6, justifyContent: 'center' },
  band: { backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: 12, height: ROW, left: 12, pointerEvents: 'none', position: 'absolute', right: 12, top: PAD },
  row: { alignItems: 'center', height: ROW, justifyContent: 'center' },
  rowText: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 21, fontVariant: ['tabular-nums'], fontWeight: '500' },
  rowTextCenter: { color: COLORS.white, fontSize: 23, fontWeight: '600' },
  fade: { height: PAD, left: 0, position: 'absolute', right: 0 },
  fadeTop: { top: 0 },
  fadeBottom: { bottom: 0 },
});
