'use no memo'; // Names the parts in the planner's language.
import { useKeepAwake } from 'expo-keep-awake';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SERMON_COLORS, SERMON_HIGHLIGHT_LABELS, SERMON_LABEL_TEXT } from '@/constants/sermonPlanner';
import { MOTION, TYPOGRAPHY } from '@/constants/theme';
import { useModalOrientations } from '@/hooks/useModalOrientations';
import { useReducedMotion } from '@/utils/useReducedMotion';
import type { SermonPlan } from '@/types/sermonPlanner';
import { groupHighlights } from '@/utils/highlightGroups';
import { toEasternArabicDigits } from '@/utils/localeFormat';
import Icon from '../ui/Icon';
import { groupReference, partLabel, partTitle } from './SermonOutline';
import { PillButton, pick, sermonStyles } from './SermonPieces';

/** The text sizes Aa steps through. */
const TEXT_SCALES = [1, 1.2, 0.85];

function clock(seconds: number, arabic: boolean) {
  const minutes = Math.floor(seconds / 60);
  const text = `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  return arabic ? toEasternArabicDigits(text) : text;
}

interface SermonPreachModeProps {
  visible: boolean;
  plan: SermonPlan;
  arabic: boolean;
  verseReferences: Record<string, string>;
  estimateMinutes: number;
  onClose: () => void;
  /** Reached the end and finished: the plan is preached, in this long. */
  onFinish: (seconds: number) => void;
}

function PreachScreen({ plan, arabic, verseReferences, estimateMinutes, onClose, onFinish }: Omit<SermonPreachModeProps, 'visible'>) {
  // The screen stays on while preaching.
  useKeepAwake();
  const { width } = useWindowDimensions();
  const wide = width >= 760;
  const [index, setIndex] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(true);
  const [scaleIndex, setScaleIndex] = useState(0);
  const scale = TEXT_SCALES[scaleIndex];
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [running]);

  const parts = plan.parts;
  const part = parts[Math.min(index, parts.length - 1)];
  const last = index >= parts.length - 1;
  const groups = useMemo(() => new Map(groupHighlights(plan.highlights).map((group) => [group.groupId, group])), [plan.highlights]);
  const points = parts.filter((entry) => entry.kind === 'point');
  const go = (next: number) => {
    setIndex(Math.max(0, Math.min(parts.length - 1, next)));
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  // A keyboard's arrows turn the parts; Escape leaves.
  const goRef = useRef(go);
  const indexRef = useRef(index);
  useEffect(() => {
    goRef.current = go;
    indexRef.current = index;
  });
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown' || event.key === ' ') goRef.current(indexRef.current + 1);
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') goRef.current(indexRef.current - 1);
      else if (event.key === 'Escape') onClose();
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!part) return null;
  const pointNumber = part.kind === 'point' ? points.findIndex((entry) => entry.id === part.id) + 1 : 0;
  const eyebrow = part.kind === 'point'
    ? pick(arabic, `Point ${pointNumber} of ${points.length}`, `النقطة ${toEasternArabicDigits(pointNumber)} من ${toEasternArabicDigits(points.length)}`)
    : partLabel(parts, part, arabic);
  const next = parts[index + 1];
  const quotes = part.highlightIds.map((id) => groups.get(id)).filter((group): group is NonNullable<typeof group> => Boolean(group));
  const size = (base: number) => Math.round(base * scale * (wide ? 1 : 0.68));

  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={styles.screen}>
      <View style={[styles.top, arabic && styles.rtl]}>
        <PillButton icon="close" label={pick(arabic, 'Done', 'تم')} onPress={onClose} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={running ? pick(arabic, 'Pause the timer', 'أوقف المؤقت') : pick(arabic, 'Start the timer', 'شغّل المؤقت')}
          onPress={() => setRunning((value) => !value)}
          style={({ pressed }) => [styles.timer, pressed && styles.pressed]}
        >
          <Icon name={running ? 'time-outline' : 'pause'} size={17} color={SERMON_COLORS.gold} />
          <Text style={styles.timerText}>{clock(seconds, arabic)}</Text>
          <Text style={styles.timerOf}>{pick(arabic, `of about ${estimateMinutes} min`, `من حوالي ${toEasternArabicDigits(estimateMinutes)} دقيقة`)}</Text>
        </Pressable>
        <PillButton label="Aa" accessibilityLabel={pick(arabic, 'Text size', 'حجم النص')} onPress={() => setScaleIndex((value) => (value + 1) % TEXT_SCALES.length)} />
      </View>
      <View style={[styles.body, arabic && styles.rtl]}>
        {wide ? (
          <ScrollView style={styles.nav} contentContainerStyle={styles.navContent}>
            {parts.map((entry, entryIndex) => {
              const on = entryIndex === index;
              const done = entryIndex < index;
              return (
                <Pressable
                  key={entry.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => go(entryIndex)}
                  style={({ pressed }) => [styles.navItem, on && styles.navItemOn, pressed && styles.pressed]}
                >
                  <Text style={[styles.navLabel, on && styles.navLabelOn, arabic && styles.textRight]}>{partLabel(parts, entry, arabic)}</Text>
                  <Text numberOfLines={2} style={[styles.navTitle, done && styles.navTitleDone, on && styles.navTitleOn, arabic && styles.textRight]}>{partTitle(entry, arabic)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
        <View style={[styles.main, !wide && styles.mainNarrow]}>
          <ScrollView ref={scrollRef} style={styles.mainScroll} contentContainerStyle={styles.mainContent}>
            <Text style={[sermonStyles.eyebrow, arabic && styles.textRight]}>{eyebrow}</Text>
            <Text style={[styles.title, { fontSize: size(46), lineHeight: size(51) }, arabic && styles.textRight]}>{partTitle(part, arabic)}</Text>
            {part.body.trim() ? (
              <Text style={[styles.lead, { fontSize: size(27), lineHeight: size(40) }, arabic && styles.textRight]}>{part.body.trim()}</Text>
            ) : null}
            {quotes.map((group) => {
              const label = SERMON_HIGHLIGHT_LABELS[group.lead.color];
              return (
                <View key={group.groupId} style={[styles.quote, { borderLeftColor: label.swatch }]}>
                  <Text style={[styles.quoteLabel, { color: SERMON_LABEL_TEXT[group.lead.color] }, arabic && styles.textRight]}>
                    {`${groupReference(group, verseReferences, false)} · ${arabic ? label.arabic : label.english}`.toLocaleUpperCase()}
                  </Text>
                  <Text style={[styles.quoteText, { fontSize: size(26), lineHeight: size(38) }, arabic && styles.textRight]}>
                    {group.segments.map((segment) => segment.quote).join(' ').trim()}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
          <View style={[styles.next, arabic && styles.rtl]}>
            {next ? (
              <View style={[styles.nextText, arabic && styles.rtl]}>
                <Text style={styles.nextLabel}>{pick(arabic, 'Next', 'التالي')}</Text>
                <Text numberOfLines={1} style={styles.nextTitle}>{`${partLabel(parts, next, arabic)} · ${partTitle(next, arabic)}`}</Text>
              </View>
            ) : (
              <Text style={[styles.nextLabel, styles.nextText]}>{pick(arabic, 'The last part', 'الجزء الأخير')}</Text>
            )}
            <View style={[styles.nextButtons, arabic && styles.rtl]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={pick(arabic, 'Previous part', 'الجزء السابق')}
                disabled={index === 0}
                onPress={() => go(index - 1)}
                style={({ pressed }) => [styles.step, index === 0 && styles.stepOff, pressed && styles.pressed]}
              >
                <Icon name={arabic ? 'chevron-forward' : 'chevron-back'} size={26} color={SERMON_COLORS.gold} />
              </Pressable>
              {last ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={pick(arabic, 'Finish: mark it preached', 'انتهِ: سجّلها كعظة أُلقيت')}
                  onPress={() => onFinish(seconds)}
                  style={({ pressed }) => [styles.step, styles.stepOn, styles.finish, pressed && styles.pressed]}
                >
                  <Icon name="checkmark" size={22} color={SERMON_COLORS.onGold} />
                  <Text style={styles.finishText}>{pick(arabic, 'Finish', 'انتهِ')}</Text>
                </Pressable>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={pick(arabic, 'Next part', 'الجزء التالي')}
                  onPress={() => go(index + 1)}
                  style={({ pressed }) => [styles.step, styles.stepOn, pressed && styles.pressed]}
                >
                  <Icon name={arabic ? 'chevron-back' : 'chevron-forward'} size={26} color={SERMON_COLORS.onGold} />
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

/** Preach mode, over everything: the parts one at a time, large. */
export default function SermonPreachMode({ visible, ...props }: SermonPreachModeProps) {
  const modalOrientations = useModalOrientations();
  const reduced = useReducedMotion();
  return (
    <Modal visible={visible} animationType={reduced ? 'none' : 'fade'} onRequestClose={props.onClose} supportedOrientations={modalOrientations} statusBarTranslucent navigationBarTranslucent>
      {visible ? <PreachScreen {...props} /> : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: MOTION.pressOpacity },
  rtl: { flexDirection: 'row-reverse' },
  textRight: { textAlign: 'right', writingDirection: 'rtl' },
  screen: { backgroundColor: '#000', flex: 1 },
  top: { alignItems: 'center', borderBottomColor: SERMON_COLORS.line, borderBottomWidth: 1, flexDirection: 'row', gap: 10, justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 10 },
  timer: { alignItems: 'center', backgroundColor: SERMON_COLORS.fill, borderRadius: 999, flexDirection: 'row', gap: 8, height: 38, paddingHorizontal: 16 },
  timerText: { color: SERMON_COLORS.text, fontSize: 15, fontVariant: ['tabular-nums'], fontWeight: '700' },
  timerOf: { color: SERMON_COLORS.muted, fontSize: 15, fontWeight: '500' },
  body: { flex: 1, flexDirection: 'row', minHeight: 0 },
  nav: { backgroundColor: SERMON_COLORS.rail, flexGrow: 0, width: 270 },
  navContent: { gap: 4, paddingHorizontal: 14, paddingVertical: 18 },
  navItem: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  navItemOn: { backgroundColor: SERMON_COLORS.raised, borderLeftColor: SERMON_COLORS.gold, borderLeftWidth: 3, paddingLeft: 9 },
  navLabel: { color: 'rgba(227, 181, 59, 0.6)', fontSize: 10.5, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' },
  navLabelOn: { color: SERMON_COLORS.gold },
  navTitle: { color: SERMON_COLORS.muted, fontFamily: TYPOGRAPHY.title, fontSize: 15, fontWeight: '600', lineHeight: 19.5, marginTop: 2 },
  navTitleDone: { color: 'rgba(255, 255, 255, 0.45)' },
  navTitleOn: { color: SERMON_COLORS.text },
  main: { flex: 1, minWidth: 0, paddingBottom: 26, paddingHorizontal: 54, paddingTop: 34 },
  mainNarrow: { paddingHorizontal: 20, paddingTop: 20 },
  mainScroll: { flex: 1 },
  mainContent: { paddingBottom: 20 },
  title: { color: SERMON_COLORS.text, fontFamily: TYPOGRAPHY.title, fontWeight: '700', marginBottom: 14, marginTop: 8 },
  lead: { color: '#F2F2EE', fontFamily: TYPOGRAPHY.title },
  quote: { backgroundColor: SERMON_COLORS.raised, borderLeftWidth: 4, borderRadius: 20, marginTop: 26, paddingHorizontal: 24, paddingVertical: 20 },
  quoteLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 1.6 },
  quoteText: { color: SERMON_COLORS.text, fontFamily: TYPOGRAPHY.title, fontStyle: 'italic', marginTop: 8 },
  next: { alignItems: 'center', flexDirection: 'row', gap: 14, paddingTop: 14 },
  nextText: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 14, minWidth: 0 },
  nextLabel: { color: SERMON_COLORS.muted, fontSize: 15 },
  nextTitle: { color: SERMON_COLORS.text, flexShrink: 1, fontFamily: TYPOGRAPHY.title, fontSize: 17, fontWeight: '600' },
  nextButtons: { flexDirection: 'row', gap: 10 },
  step: { alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.07)', borderRadius: 999, height: 58, justifyContent: 'center', width: 58 },
  stepOff: { opacity: 0.35 },
  stepOn: { backgroundColor: SERMON_COLORS.gold },
  finish: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, width: 'auto' },
  finishText: { color: SERMON_COLORS.onGold, fontSize: 16, fontWeight: '700' },
});
