'use no memo'; // Names the days and parts in the planner's language.
import Head from 'expo-router/head';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SERMON_COLORS, SERMON_STATE_NAMES } from '@/constants/sermonPlanner';
import { MOTION, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useCalendar } from '@/context/CalendarContext';
import { useLiturgicalClock } from '@/context/LiturgicalClockContext';
import { useReadingPreferences } from '@/context/ReadingPreferencesContext';
import { useModalOrientations } from '@/hooks/useModalOrientations';
import { useReducedMotion } from '@/utils/useReducedMotion';
import { sermonDayName, useSermonDay, type SermonDay } from '@/hooks/useSermonDay';
import { useSermonPlan, type SermonPlanSyncStatus } from '@/hooks/useSermonPlanner';
import { useSermonPlans } from '@/hooks/useSermonPlans';
import { useSermonReadings, type SermonReading } from '@/hooks/useSermonReadings';
import type { SermonPlan, SermonPlanSummary } from '@/types/sermonPlanner';
import { loadLocalSermonPlan } from '@/services/sermonPlannerService';
import { groupHighlights, highlightGroupId } from '@/utils/highlightGroups';
import { goBack } from '@/utils/navigation';
import type { LectionaryService } from '@/utils/readingsService';
import {
  estimatedSermonMinutes,
  getSermonHighlightVerseReferences,
  isLegacySermonPlanId,
  isSermonHighlightAnchor,
  isSermonHighlightColor,
  isSermonPartWritten,
  newSermonPlanId,
  sermonPlanGroups,
  sermonPlanState,
  unplacedHighlightGroups,
} from '@/utils/sermonPlanner';
import { READING_FONT_BASE_PX } from '@/utils/readingFontSize';
import { useContentWidth, useLayoutMode } from '@/utils/useLayoutMode';
import type { DocumentAction, DocumentWebViewHandle } from '../DocumentWebView';
import BleedPage from '../ui/BleedPage';
import BottomTabBar from '../ui/BottomTabBar';
import CalendarSheet from '../ui/CalendarSheet';
import Icon from '../ui/Icon';
import { NoteEditor, PlacePicker, SermonHighlightList, SermonTray } from './SermonHighlights';
import SermonOutline, { partLabel } from './SermonOutline';
import {
  GoldButton,
  minutesLabel,
  partsLabel,
  pick,
  PillButton,
  RoundButton,
  Segmented,
  SermonDatePill,
  SermonPlanCard,
} from './SermonPieces';
import SermonCarryOver from './SermonCarryOver';
import SermonPreachMode from './SermonPreachMode';
import SermonReadingsPane, { readingOfHighlight } from './SermonReadingsPane';

const PLANS_HREF = '/lectionary/sermon_planner';

function planHref(planId: string, isoDate: string, extra = ''): Href {
  return `${PLANS_HREF}/${encodeURIComponent(planId)}?date=${isoDate}${extra}` as Href;
}

function isoOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Asks before something that can't be undone. */
function confirm(title: string, message: string, action: string, cancel: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: cancel, style: 'cancel' },
    { text: action, style: 'destructive', onPress: onConfirm },
  ]);
}

function syncLabel(status: SermonPlanSyncStatus, signedIn: boolean, arabic: boolean) {
  if (!signedIn || status === 'local' || status === 'error') return pick(arabic, 'Saved on this device', 'محفوظة على هذا الجهاز');
  if (status === 'syncing') return pick(arabic, 'Syncing', 'تتم المزامنة');
  return pick(arabic, 'Synced', 'متزامنة');
}

// ─── The list of plans ──────────────────────────────────────────────────────

function GroupHeading({ title, count, compact, arabic }: { title: string; count?: number; compact: boolean; arabic: boolean }) {
  return (
    <View style={[styles.groupHead, compact && styles.groupHeadCompact, arabic && styles.rtl]}>
      <Text style={[styles.groupTitle, compact && styles.groupTitleCompact]}>{title}</Text>
      {count !== undefined && !compact ? <Text style={styles.groupCount}>{arabic ? String(count).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]) : count}</Text> : null}
    </View>
  );
}

/** A day of the week still to be planned, as a plan card shows it: its untouched plan, or `new:<date>`. */
function dayPlaceholder(isoDate: string, untouched: SermonPlanSummary | null): SermonPlanSummary {
  return untouched ?? {
    id: `new:${isoDate}`, documentKey: '', serviceDate: isoDate, title: '', state: 'notStarted',
    writtenParts: 0, totalParts: 6, preachedSeconds: null, highlightCount: 0, updatedAt: '',
  };
}

function PlanList({
  plans, todayIso, selectedId, arabic, compact, onOpen, onPlanDay, onMenu, onCarryOver,
}: {
  plans: SermonPlanSummary[];
  todayIso: string;
  selectedId?: string | null;
  arabic: boolean;
  compact: boolean;
  /** A plan, or a day of the week to plan (`new:<date>`). */
  onOpen: (plan: SermonPlanSummary) => void;
  onPlanDay: () => void;
  /** A long press on a plan: Carry over, Remove. */
  onMenu: (plan: SermonPlanSummary) => void;
  onCarryOver: (plan: SermonPlanSummary) => void;
}) {
  const { week, later, earlier } = sermonPlanGroups(plans, todayIso);
  const name = (day: SermonDay) => sermonDayName(day, arabic);
  const card = (plan: SermonPlanSummary, carryOver = false) => (
    <SermonPlanCard
      key={plan.id}
      plan={plan}
      arabic={arabic}
      compact={compact}
      selected={plan.id === selectedId}
      fallbackTitle={name}
      onPress={() => onOpen(plan)}
      onLongPress={plan.id.startsWith('new:') ? undefined : () => onMenu(plan)}
      action={carryOver ? { icon: 'repeat', label: pick(arabic, 'Carry over to another day', 'انقلها إلى يوم آخر'), onPress: () => onCarryOver(plan) } : undefined}
    />
  );
  const planDay = (
    <Pressable accessibilityRole="button" onPress={onPlanDay} style={({ pressed }) => [styles.planDay, compact && styles.planDayRail, pressed && styles.pressed]}>
      <Icon name="calendar-outline" size={16} color={SERMON_COLORS.gold} />
      <Text style={styles.planDayText}>{pick(arabic, 'Plan another day', 'خطط ليوم آخر')}</Text>
    </Pressable>
  );
  return (
    <View style={styles.planList}>
      {compact ? planDay : null}
      <GroupHeading title={pick(arabic, 'This week', 'هذا الأسبوع')} compact={compact} arabic={arabic} />
      {week.map((day) => (day.plans.length ? day.plans.map((plan) => card(plan)) : card(dayPlaceholder(day.isoDate, day.untouched))))}
      {compact ? null : planDay}
      {later.length ? (
        <>
          <GroupHeading title={pick(arabic, 'Later', 'لاحقاً')} count={later.length} compact={compact} arabic={arabic} />
          {later.map((plan) => card(plan))}
        </>
      ) : null}
      {earlier.length ? (
        <>
          <GroupHeading title={pick(arabic, 'Earlier', 'السابقة')} count={earlier.length} compact={compact} arabic={arabic} />
          {earlier.map((plan) => card(plan, true))}
        </>
      ) : null}
    </View>
  );
}

// ─── A menu ─────────────────────────────────────────────────────────────────

interface MenuItem { label: string; onPress: () => void; destructive?: boolean }

function Menu({ visible, items, onClose, title, centred = false }: { visible: boolean; items: MenuItem[]; onClose: () => void; title?: string; centred?: boolean }) {
  const insets = useSafeAreaInsets();
  const modalOrientations = useModalOrientations();
  const reduced = useReducedMotion();
  return (
    <Modal visible={visible} transparent animationType={reduced ? 'none' : 'fade'} onRequestClose={onClose} supportedOrientations={modalOrientations} statusBarTranslucent navigationBarTranslucent>
      <Pressable style={[styles.menuBackdrop, centred && styles.menuBackdropCentred]} onPress={onClose}>
        <View style={centred ? [styles.menu, styles.menuCentred] : [styles.menu, { top: insets.top + 58, right: Math.max(12, insets.right + 12) }]}>
          {title ? <Text numberOfLines={1} style={styles.menuTitle}>{title}</Text> : null}
          {items.map((item) => (
            <Pressable
              key={item.label}
              accessibilityRole="menuitem"
              onPress={() => {
                onClose();
                item.onPress();
              }}
              style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
            >
              <Text style={[styles.menuText, item.destructive && styles.menuTextDestructive]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

// ─── The workspace ──────────────────────────────────────────────────────────

type PhoneTab = 'plan' | 'readings' | 'highlights';

interface WorkspaceProps {
  planId: string;
  isoDate: string;
  plans: SermonPlanSummary[];
  /** The plans list beside it (a desktop). */
  rail: boolean;
  /** Opened from "Plan a day": the calendar opens at once to choose the day. */
  pickDay: boolean;
  onPickDayHandled: () => void;
  onRemovePlan: (plan: SermonPlanSummary) => void;
  /** Carry this plan over to another day (SermonCarryOver). */
  onCarryOver: (plan: SermonPlan) => void;
  /** A plan becomes this workspace's: another one, or a new one. */
  onSwitch: (planId: string, isoDate: string) => void;
  /** The plan just started has been kept: its id goes in the address. */
  onKept: (planId: string, isoDate: string) => void;
  newPlanId: string;
  onNewPlan: (isoDate: string) => void;
}

function Workspace({ planId, isoDate, plans, rail, pickDay, onPickDayHandled, onRemovePlan, onCarryOver, onSwitch, onKept, newPlanId, onNewPlan }: WorkspaceProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { preferences, setSermonPlannerLanguage } = useReadingPreferences();
  const { effectiveDate, selectDate } = useCalendar();
  const contentWidth = useContentWidth() - (rail ? RAIL_WIDTH : 0);
  const layout = useLayoutMode();
  const phone = layout === 'phone';
  const twoPane = contentWidth >= 880;
  const arabic = Boolean(preferences.sermonPlannerVisibleLanguages.arabic && !preferences.sermonPlannerVisibleLanguages.english);

  const day = useSermonDay(isoDate);
  const dayName = sermonDayName(day, arabic);
  const controller = useSermonPlan(planId, isoDate, user?.id, dayName);
  const { plan } = controller;
  const readings = useSermonReadings(isoDate);
  const verseReferences = useMemo(() => (readings.sections ? getSermonHighlightVerseReferences(readings.sections) : {}), [readings.sections]);
  const groups = useMemo(() => groupHighlights(plan.highlights), [plan.highlights]);
  const unplaced = useMemo(() => unplacedHighlightGroups(plan), [plan]);
  const state = sermonPlanState(plan);
  const written = plan.parts.filter(isSermonPartWritten).length;
  const estimate = estimatedSermonMinutes(plan);
  const title = plan.title.trim() || dayName;

  // The plan just started goes in the address once there is something in it.
  useEffect(() => {
    if (controller.kept && planId === newPlanId) onKept(planId, isoDate);
  }, [controller.kept, planId, newPlanId, isoDate, onKept]);

  // ── The one calendar ──
  // The app's calendar is put on the plan's day; a day chosen in it after
  // that brings that day's plan (or a new one, or moves a new plan nothing
  // has been written in yet to that day).
  const effectiveIso = isoOf(effectiveDate);
  const alignedRef = useRef<string | null>(null);
  const keptRef = useRef(controller.kept);
  useEffect(() => {
    keptRef.current = controller.kept;
  }, [controller.kept]);
  useEffect(() => {
    if (alignedRef.current !== isoDate) {
      alignedRef.current = isoDate;
      if (effectiveIso !== isoDate) selectDate(new Date(`${isoDate}T00:00:00Z`));
      return;
    }
    if (effectiveIso === isoDate) return;
    alignedRef.current = effectiveIso;
    if (!keptRef.current) {
      // Nothing written in it yet: the new plan moves to the day chosen.
      onSwitch(planId === newPlanId ? 'new' : planId, effectiveIso);
      return;
    }
    const onDay = plans.filter((entry) => entry.serviceDate === effectiveIso).sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
    if (onDay.length) onSwitch(onDay[0].id, effectiveIso);
    else onNewPlan(effectiveIso);
  }, [effectiveIso, isoDate, planId, newPlanId, plans, selectDate, onSwitch, onNewPlan]);

  const [calendarOpen, setCalendarOpen] = useState(pickDay);
  const [pickSeen, setPickSeen] = useState(pickDay);
  if (pickDay !== pickSeen) {
    setPickSeen(pickDay);
    if (pickDay) setCalendarOpen(true);
  }
  // The address forgets it once the calendar is up.
  useEffect(() => {
    if (pickDay) onPickDayHandled();
  }, [pickDay, onPickDayHandled]);

  // ── The readings ──
  const [service, setService] = useState<LectionaryService>('Liturgy');
  const [readingKey, setReadingKey] = useState<string | null>(null);
  const reading: SermonReading | null = useMemo(() => {
    if (!readings.readings) return null;
    const list = readings.readings[service];
    return list.find((entry) => entry.key === readingKey)
      ?? list.find((entry) => entry.kind === 'Gospel')
      ?? list[0]
      ?? null;
  }, [readings.readings, service, readingKey]);
  const surfaceRef = useRef<DocumentWebViewHandle>(null);
  const [phoneTab, setPhoneTab] = useState<PhoneTab>('plan');

  const showHighlight = (groupId: string) => {
    const group = groups.find((entry) => entry.groupId === groupId);
    if (!group) return;
    const target = readingOfHighlight(readings.readings, group.lead);
    if (target) {
      setService(target.service);
      setReadingKey(target.key);
    }
    if (!twoPane) setPhoneTab('readings');
    // The reading is drawn afresh when it changes: the highlight is gone to once it is there.
    [350, 900, 1600].forEach((delay) => setTimeout(() => surfaceRef.current?.scrollToSermonHighlight(group.lead.id), delay));
  };

  // ── The parts ──
  const [openPartId, setOpenPartId] = useState<string | null>(null);
  const [lastPartId, setLastPartId] = useState<string | null>(null);
  const openPart = (id: string | null) => {
    setOpenPartId(id);
    if (id) setLastPartId(id);
  };
  const placeTarget = plan.parts.find((part) => part.id === (openPartId ?? lastPartId)) ?? null;
  const placeLabel = placeTarget ? pick(arabic, `Add to ${partLabel(plan.parts, placeTarget, false)}`, `أضف إلى ${partLabel(plan.parts, placeTarget, true)}`) : null;
  const [dragging, setDragging] = useState(false);

  // ── Highlights from the page ──
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [placeFor, setPlaceFor] = useState<string | null>(null);
  const groupOfSegment = (segmentId: string) => {
    const segment = plan.highlights.find((highlight) => highlight.id === segmentId);
    return segment ? highlightGroupId(segment) : null;
  };
  const handleAction = (action: DocumentAction) => {
    if (action.type === 'createSermonHighlights') {
      const leadId = controller.createHighlightGroup({
        anchors: (action.anchors || []).filter(isSermonHighlightAnchor),
        color: isSermonHighlightColor(action.color) ? action.color : 'gold',
        style: action.style === 'underline' ? 'underline' : undefined,
        replaces: Array.isArray(action.replaces) ? action.replaces.filter((id): id is string => typeof id === 'string') : [],
        placeIn: action.place ? placeTarget?.id ?? null : null,
      });
      if (leadId && action.openNote) setNoteFor(leadId.slice(0, leadId.lastIndexOf('~')));
      return;
    }
    if (action.type === 'recolorSermonHighlight' && action.highlightId) {
      controller.updateHighlight(action.highlightId, {
        color: isSermonHighlightColor(action.color) ? action.color : 'gold',
        style: action.style === 'underline' ? 'underline' : null,
      });
      return;
    }
    if (action.type === 'removeSermonHighlight' && action.highlightId) {
      controller.deleteHighlight(action.highlightId);
      return;
    }
    if (action.type === 'openSermonNote' && action.highlightId) {
      setNoteFor(groupOfSegment(action.highlightId));
      return;
    }
    if (action.type === 'placeSermonHighlight' && action.highlightId) {
      const groupId = groupOfSegment(action.highlightId);
      if (!groupId) return;
      if (placeTarget) controller.placeHighlight(groupId, placeTarget.id);
      else setPlaceFor(groupId);
    }
  };
  const noteGroup = noteFor ? groups.find((group) => group.groupId === noteFor) ?? null : null;
  const placeGroupPart = placeFor ? plan.parts.find((part) => part.highlightIds.includes(placeFor)) ?? null : null;

  // ── Preach, the menu ──
  const [preaching, setPreaching] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const summary = plans.find((entry) => entry.id === planId);
  const menuItems: MenuItem[] = [
    ...(phone ? [{
      label: arabic ? 'Read in English' : 'اقرأ بالعربية',
      onPress: () => setSermonPlannerLanguage(arabic ? 'english' : 'arabic'),
    }] : []),
    state === 'ready'
      ? { label: pick(arabic, 'Back to draft', 'أعدها مسودة'), onPress: () => controller.setStatus('draft') }
      : { label: pick(arabic, 'Mark as ready', 'جاهزة'), onPress: () => controller.setStatus('ready') },
    state === 'preached'
      ? { label: pick(arabic, 'Not preached yet', 'لم تُلقَ بعد'), onPress: () => controller.setStatus('draft') }
      : { label: pick(arabic, 'Mark as preached', 'أُلقيت'), onPress: () => controller.setStatus('preached') },
    { label: pick(arabic, 'Another plan for this day', 'خطة أخرى لهذا اليوم'), onPress: () => onNewPlan(isoDate) },
    ...(controller.kept ? [{ label: pick(arabic, 'Carry over to another day', 'انقلها إلى يوم آخر'), onPress: () => onCarryOver(plan) }] : []),
    ...(controller.kept ? [{
      label: pick(arabic, 'Remove this plan', 'احذف هذه الخطة'),
      destructive: true,
      onPress: () => onRemovePlan(summary ?? {
        id: plan.id, documentKey: plan.documentKey, serviceDate: plan.serviceDate, title, state, writtenParts: written,
        totalParts: plan.parts.length, preachedSeconds: plan.preachedSeconds, highlightCount: groups.length, updatedAt: plan.updatedAt,
      }),
    }] : []),
  ];

  const meta = [
    arabic ? SERMON_STATE_NAMES[state].arabic : SERMON_STATE_NAMES[state].english,
    partsLabel(written, plan.parts.length, arabic),
    pick(arabic, `about ${estimate} min`, `حوالي ${minutesLabel(estimate, true)}`),
  ];
  const metaLine = (withSync: boolean) => (
    <View style={[styles.meta, arabic && styles.rtl]}>
      {meta.map((item, index) => (
        <Text key={item} style={styles.metaText}>{index ? `·  ${item}` : item}</Text>
      ))}
      {withSync ? (
        <Text style={[styles.metaText, controller.syncStatus === 'synced' && user && styles.metaSynced]}>{`·  ${syncLabel(controller.syncStatus, Boolean(user), arabic)}`}</Text>
      ) : null}
    </View>
  );
  const titleInput = (size: number) => (
    <TextInput
      accessibilityLabel={pick(arabic, 'Plan name', 'اسم الخطة')}
      value={plan.title}
      placeholder={dayName}
      placeholderTextColor={SERMON_COLORS.text}
      onChangeText={controller.setTitle}
      style={[styles.titleInput, { fontSize: size, lineHeight: Math.round(size * 1.2) }, arabic && styles.textRight, Platform.OS === 'web' && styles.inputWeb]}
    />
  );
  const progress = (
    <View style={styles.bar}>
      <View style={[styles.barFill, { width: `${plan.parts.length ? Math.round((written / plan.parts.length) * 100) : 0}%` }]} />
    </View>
  );

  const outline = (
    <SermonOutline
      plan={plan}
      arabic={arabic}
      ornament={day.ornament}
      openPartId={openPartId}
      onOpenPart={openPart}
      verseReferences={verseReferences}
      onShowHighlight={showHighlight}
      onBigIdeaChange={controller.setBigIdea}
      onPartChange={controller.updatePart}
      onMovePart={controller.movePart}
      onRemovePart={controller.removePart}
      onAddPart={controller.addPart}
      onUnplace={controller.unplaceHighlight}
      onDragChange={setDragging}
    />
  );
  const readingsPane = (
    <SermonReadingsPane
      ref={surfaceRef}
      readings={readings.readings}
      error={readings.error}
      onRetry={readings.retry}
      service={service}
      onServiceChange={(next) => {
        setService(next);
        setReadingKey(null);
      }}
      reading={reading}
      onReadingChange={(next) => setReadingKey(next.key)}
      highlights={plan.highlights}
      // The readings are set as the planner's own page: black, as Night is,
      // whatever page the reader reads on, and no larger than the design's
      // working size (a smaller choice of the reader's stays smaller).
      preferences={{
        ...preferences,
        slideshowMode: false,
        documentTheme: 'night',
        fontScale: Math.min(preferences.fontScale, (phone ? 18 : 19) / READING_FONT_BASE_PX),
        visibleLanguages: {
          ...preferences.visibleLanguages,
          english: !arabic,
          coptic: false,
          copticRecitedPrayers: false,
          arabic,
        },
      }}
      arabic={arabic}
      ornament={day.ornament}
      season={day.seasonKey}
      placeLabel={placeLabel}
      compact={!twoPane}
      gutter={twoPane ? 28 : 16}
      onAction={handleAction}
    />
  );

  const back = () => goBack(router, PLANS_HREF as Href);
  const languages = (
    <Segmented
      options={[{ key: 'english', label: 'English' }, { key: 'arabic', label: 'العربية' }]}
      value={arabic ? 'arabic' : 'english'}
      onChange={(key) => setSermonPlannerLanguage(key as 'english' | 'arabic')}
    />
  );
  const openCalendar = () => {
    if (effectiveIso !== isoDate) selectDate(new Date(`${isoDate}T00:00:00Z`));
    setCalendarOpen(true);
  };

  const topBar = phone ? (
    <View style={[styles.top, styles.topPhone, { paddingTop: insets.top + 6 }]}>
      <RoundButton icon="chevron-back" label={pick(arabic, 'Back', 'رجوع')} onPress={back} size={34} />
      <View style={styles.topMiddle}>
        <SermonDatePill day={day} arabic={arabic} wide={false} onPress={openCalendar} />
      </View>
      <GoldButton icon="play" label={pick(arabic, 'Preach', 'اعظ')} onPress={() => setPreaching(true)} compact />
      <RoundButton icon="ellipsis-horizontal" label={pick(arabic, 'More', 'المزيد')} onPress={() => setMenuOpen(true)} size={34} />
    </View>
  ) : (
    <View style={[styles.top, { paddingTop: (rail ? 0 : insets.top) + 10 }]}>
      {rail ? null : <RoundButton icon="chevron-back" label={pick(arabic, 'Back', 'رجوع')} onPress={back} />}
      {rail ? null : <PillButton icon="albums-outline" label={pick(arabic, 'Plans', 'الخطط')} onPress={() => router.navigate(PLANS_HREF as Href)} />}
      <View style={styles.topMiddle}>
        <SermonDatePill day={day} arabic={arabic} wide={contentWidth >= 760} onPress={openCalendar} />
      </View>
      {languages}
      <GoldButton icon="play" label={pick(arabic, 'Preach', 'اعظ')} onPress={() => setPreaching(true)} />
      <RoundButton icon="ellipsis-horizontal" label={pick(arabic, 'More', 'المزيد')} onPress={() => setMenuOpen(true)} />
    </View>
  );

  const planBody = (
    <ScrollView
      style={styles.planScroll}
      contentContainerStyle={[styles.planScrollContent, !twoPane && styles.planScrollPhone]}
      scrollEnabled={!dragging}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      {outline}
    </ScrollView>
  );

  const body = twoPane ? (
    <View style={[styles.body, arabic && styles.rtl]}>
      <View style={styles.readingsColumn}>{readingsPane}</View>
      <View style={[styles.planColumn, { width: Math.max(400, Math.min(540, Math.round(contentWidth * 0.44))) }]}>
        <View style={styles.planHead}>
          {titleInput(24)}
          {metaLine(true)}
          {progress}
        </View>
        {planBody}
        <SermonTray
          total={groups.length}
          unplaced={unplaced}
          verseReferences={verseReferences}
          arabic={arabic}
          onShow={showHighlight}
          onPlace={setPlaceFor}
        />
      </View>
    </View>
  ) : (
    <View style={styles.narrow}>
      <View style={styles.narrowHead}>
        {/* The plan's name over the plan; the readings and highlights keep the room for themselves. */}
        {phoneTab === 'plan' ? (
          <>
            {titleInput(22)}
            {metaLine(false)}
          </>
        ) : null}
        <View style={styles.tabs}>
          <Segmented
            stretch
            options={[
              { key: 'plan', label: pick(arabic, 'Plan', 'الخطة') },
              { key: 'readings', label: pick(arabic, 'Readings', 'القراءات') },
              { key: 'highlights', label: pick(arabic, 'Highlights', 'التظليلات'), badge: groups.length ? String(groups.length) : undefined },
            ]}
            value={phoneTab}
            onChange={(key) => setPhoneTab(key as PhoneTab)}
          />
        </View>
      </View>
      {phoneTab === 'plan' ? planBody : null}
      {phoneTab === 'readings' ? <View style={styles.narrowReadings}>{readingsPane}</View> : null}
      {phoneTab === 'highlights' ? (
        <ScrollView style={styles.planScroll} contentContainerStyle={styles.planScrollPhone}>
          <SermonHighlightList
            groups={groups}
            parts={plan.parts}
            verseReferences={verseReferences}
            arabic={arabic}
            onShow={showHighlight}
            onPlace={setPlaceFor}
          />
        </ScrollView>
      ) : null}
    </View>
  );

  return (
    <View style={styles.workspace}>
      <Head>
        <title>{`${title} — Coptic Vine`}</title>
      </Head>
      {topBar}
      {body}
      <CalendarSheet visible={calendarOpen} onClose={() => setCalendarOpen(false)} onOpenSeasons={() => router.push('/season-selector')} />
      <Menu visible={menuOpen} items={menuItems} onClose={() => setMenuOpen(false)} />
      <PlacePicker
        visible={Boolean(placeFor)}
        parts={plan.parts}
        currentPartId={placeGroupPart?.id ?? null}
        arabic={arabic}
        onChoose={(partId) => {
          if (placeFor) controller.placeHighlight(placeFor, partId);
          setPlaceFor(null);
        }}
        onUnplace={() => {
          if (placeFor) controller.unplaceHighlight(placeFor);
          setPlaceFor(null);
        }}
        onClose={() => setPlaceFor(null)}
      />
      <NoteEditor
        key={noteGroup?.groupId ?? 'none'}
        visible={Boolean(noteGroup)}
        group={noteGroup}
        verseReferences={verseReferences}
        arabic={arabic}
        onSave={(note) => {
          if (noteGroup && note !== noteGroup.lead.note) controller.updateHighlight(noteGroup.lead.id, { note });
        }}
        onRemove={() => {
          if (noteGroup) controller.deleteHighlight(noteGroup.lead.id);
        }}
        onClose={() => setNoteFor(null)}
      />
      <SermonPreachMode
        visible={preaching}
        plan={plan}
        arabic={arabic}
        verseReferences={verseReferences}
        estimateMinutes={estimate}
        onClose={() => setPreaching(false)}
        onFinish={(seconds) => {
          controller.markPreached(seconds);
          setPreaching(false);
        }}
      />
    </View>
  );
}

// ─── The screen ─────────────────────────────────────────────────────────────

const RAIL_WIDTH = 278;

/**
 * The Sermon Planner (Claude Design, "Sermon Planner"): the plans, by day,
 * and a plan's workspace -- the day's readings beside the plan, one date for
 * both, highlights that mean something and land in the plan, an outline in
 * parts, and Preach mode. A phone shows the plans and a plan as pages of
 * their own, a plan as tabs (Plan, Readings, Highlights); a desktop keeps the
 * plans beside the plan.
 */
export default function SermonPlannerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ planId?: string; date?: string; pick?: string }>();
  const routePlanId = typeof params.planId === 'string' ? params.planId : null;
  const routeDate = typeof params.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : null;
  const layout = useLayoutMode();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { preferences } = useReadingPreferences();
  const clock = useLiturgicalClock();
  const { effectiveDate } = useCalendar();
  const arabic = Boolean(preferences.sermonPlannerVisibleLanguages.arabic && !preferences.sermonPlannerVisibleLanguages.english);
  const { plans, removePlan } = useSermonPlans(user?.id);
  const todayIso = isoOf(clock.today);
  const rail = layout === 'desktop' && width >= 1100;

  // A new plan's id, chosen once; the address takes it once the plan is kept.
  const [newPlanId, setNewPlanId] = useState(newSermonPlanId);
  const planId = routePlanId === 'new' ? newPlanId : routePlanId;
  const planDate = routeDate
    ?? (planId ? plans.find((plan) => plan.id === planId)?.serviceDate : null)
    ?? (planId && isLegacySermonPlanId(planId) ? planId.slice(4) : null)
    ?? isoOf(effectiveDate);

  const switchTo = useCallback((id: string, isoDate: string) => {
    router.setParams({ planId: id, date: isoDate });
  }, [router]);
  const newPlan = useCallback((isoDate: string, pickDay = false) => {
    setNewPlanId(newSermonPlanId());
    router.setParams({ planId: 'new', date: isoDate, ...(pickDay ? { pick: '1' } : {}) });
  }, [router]);
  const kept = useCallback((id: string, isoDate: string) => {
    router.setParams({ planId: id, date: isoDate });
  }, [router]);
  const pickHandled = useCallback(() => router.setParams({ pick: undefined }), [router]);

  const remove = (plan: SermonPlanSummary) => {
    confirm(
      pick(arabic, 'Remove this plan?', 'حذف هذه الخطة؟'),
      pick(arabic, 'Its outline and highlights go too, on every device.', 'ستُحذف خطوطها وتظليلاتها على كل الأجهزة.'),
      pick(arabic, 'Remove', 'احذف'),
      pick(arabic, 'Cancel', 'إلغاء'),
      () => {
        void removePlan(plan);
        if (plan.id === planId) {
          if (rail) newPlan(plan.serviceDate);
          else router.navigate(PLANS_HREF as Href);
        }
      },
    );
  };

  // A desktop opens the list on a plan: the next one this week, else the next started, else today's.
  const defaultPlan = useMemo(() => {
    const { week, later } = sermonPlanGroups(plans, todayIso);
    return week.flatMap((day) => day.plans)[0] ?? later[0] ?? null;
  }, [plans, todayIso]);
  useEffect(() => {
    if (routePlanId || !rail) return;
    router.replace(defaultPlan ? planHref(defaultPlan.id, defaultPlan.serviceDate) : planHref('new', todayIso));
  }, [routePlanId, rail, defaultPlan, router, todayIso]);

  // A day of the week opens its plan, or a new one for it (`new:<date>`).
  const isDay = (plan: SermonPlanSummary) => plan.id.startsWith('new:');
  const openFromPage = (plan: SermonPlanSummary) => router.push(planHref(isDay(plan) ? 'new' : plan.id, plan.serviceDate));
  const openBeside = (plan: SermonPlanSummary) => (isDay(plan) ? newPlan(plan.serviceDate) : switchTo(plan.id, plan.serviceDate));
  const selectedId = routePlanId === 'new' ? `new:${planDate}` : planId;

  // Carrying a sermon over: from the list (its card's button or a long press) or from the plan's menu.
  const [carrySource, setCarrySource] = useState<SermonPlan | null>(null);
  const [menuFor, setMenuFor] = useState<SermonPlanSummary | null>(null);
  const carryFromList = (plan: SermonPlanSummary) => {
    void loadLocalSermonPlan(plan.id, plan.serviceDate).then((full) => { if (full) setCarrySource(full); });
  };
  const carried = (plan: SermonPlan) => {
    setCarrySource(null);
    if (routePlanId) switchTo(plan.id, plan.serviceDate);
    else router.push(planHref(plan.id, plan.serviceDate));
  };
  const sheets = (
    <>
      <SermonCarryOver source={carrySource} arabic={arabic} onClose={() => setCarrySource(null)} onCarried={carried} />
      <Menu
        visible={Boolean(menuFor)}
        centred
        title={menuFor?.title}
        onClose={() => setMenuFor(null)}
        items={menuFor ? [
          { label: pick(arabic, 'Carry over to another day', 'انقلها إلى يوم آخر'), onPress: () => carryFromList(menuFor) },
          { label: pick(arabic, 'Remove this plan', 'احذف هذه الخطة'), destructive: true, onPress: () => remove(menuFor) },
        ] : []}
      />
    </>
  );

  // A new plan, for the calendar's day until another is chosen: the calendar opens on it.
  const planDay = () => {
    if (routePlanId) newPlan(isoOf(effectiveDate), true);
    else router.push(planHref('new', isoOf(effectiveDate), '&pick=1'));
  };

  if (!planId || (!routePlanId && rail)) {
    // The plans, as a page of their own.
    return (
      <BleedPage footer={<BottomTabBar active="books" />}>
        <Head>
          <title>{`${pick(arabic, 'Sermon Planner', 'مخطط العظة')} — Coptic Vine`}</title>
        </Head>
        <View style={[styles.listTop, { paddingTop: insets.top + 6 }]}>
          <RoundButton icon="chevron-back" label={pick(arabic, 'Back', 'رجوع')} onPress={() => goBack(router, '/lectionary' as Href)} size={34} />
        </View>
        <ScrollView contentContainerStyle={styles.listPage}>
          <View style={styles.listColumn}>
            <Text style={[styles.listTitle, arabic && styles.textRight]}>{pick(arabic, 'Sermon Planner', 'مخطط العظة')}</Text>
            <Text style={[styles.listSubtitle, arabic && styles.textRight]}>{pick(arabic, 'A plan for any day you preach', 'خطة لأي يوم تعظ فيه')}</Text>
            <PlanList
              plans={plans}
              todayIso={todayIso}
              arabic={arabic}
              compact={false}
              onOpen={openFromPage}
              onPlanDay={planDay}
              onMenu={setMenuFor}
              onCarryOver={carryFromList}
            />
          </View>
        </ScrollView>
        {sheets}
      </BleedPage>
    );
  }

  const workspace = (
    <Workspace
      planId={planId}
      isoDate={planDate}
      plans={plans}
      rail={rail}
      pickDay={params.pick === '1'}
      onPickDayHandled={pickHandled}
      onRemovePlan={remove}
      onCarryOver={setCarrySource}
      onSwitch={switchTo}
      onKept={kept}
      newPlanId={newPlanId}
      onNewPlan={newPlan}
    />
  );

  if (rail) {
    return (
      <View style={styles.desk}>
        <ScrollView style={styles.rail} contentContainerStyle={styles.railContent}>
          <Text style={styles.railTitle}>{pick(arabic, 'Sermon Planner', 'مخطط العظة')}</Text>
          <PlanList
            plans={plans}
            todayIso={todayIso}
            selectedId={selectedId}
            arabic={arabic}
            compact
            onOpen={openBeside}
            onPlanDay={planDay}
            onMenu={setMenuFor}
            onCarryOver={carryFromList}
          />
        </ScrollView>
        <View style={styles.deskMain}>{workspace}</View>
        {sheets}
      </View>
    );
  }

  return (
    <BleedPage footer={layout === 'phone' ? <BottomTabBar active="books" /> : undefined} edges={layout === 'phone' ? [] : ['bottom']}>
      {workspace}
      {sheets}
    </BleedPage>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: MOTION.pressOpacity },
  rtl: { flexDirection: 'row-reverse' },
  textRight: { textAlign: 'right', writingDirection: 'rtl' },
  inputWeb: { outlineStyle: 'none' } as never,
  // The list
  listTop: { flexDirection: 'row', paddingBottom: 8, paddingHorizontal: 14 },
  listPage: { paddingBottom: 32, paddingHorizontal: 16 },
  listColumn: { alignSelf: 'center', maxWidth: 680, width: '100%' },
  listTitle: { color: SERMON_COLORS.text, fontFamily: TYPOGRAPHY.title, fontSize: 30, fontWeight: '700', lineHeight: 34, marginBottom: 2, marginTop: 6 },
  listSubtitle: { color: SERMON_COLORS.muted, fontSize: 14, marginBottom: 14 },
  planList: {},
  groupHead: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, marginTop: 6 },
  groupHeadCompact: { marginBottom: 8, marginHorizontal: 4, marginTop: 8 },
  groupTitle: { color: SERMON_COLORS.text, fontFamily: TYPOGRAPHY.title, fontSize: 19, fontWeight: '700' },
  groupTitleCompact: { fontSize: 15 },
  groupCount: { color: SERMON_COLORS.muted, fontSize: 13, fontWeight: '600' },
  emptyText: { color: SERMON_COLORS.muted, fontSize: 14, lineHeight: 20, marginBottom: 12 },
  planDay: { alignItems: 'center', backgroundColor: 'rgba(227, 181, 59, 0.10)', borderRadius: 14, flexDirection: 'row', gap: 6, height: 40, justifyContent: 'center', marginBottom: 14, marginTop: 4 },
  planDayRail: { marginBottom: 14, marginTop: 12 },
  planDayText: { color: SERMON_COLORS.gold, fontSize: 14, fontWeight: '700' },
  // The desktop
  desk: { backgroundColor: '#000', flex: 1, flexDirection: 'row' },
  rail: { backgroundColor: '#060D08', flexGrow: 0, width: RAIL_WIDTH },
  railContent: { paddingHorizontal: 14, paddingVertical: 18 },
  railTitle: { color: SERMON_COLORS.text, fontFamily: TYPOGRAPHY.title, fontSize: 22, fontWeight: '700', marginHorizontal: 4 },
  deskMain: { flex: 1, minWidth: 0 },
  // The workspace
  workspace: { backgroundColor: '#000', flex: 1 },
  top: { alignItems: 'center', borderBottomColor: SERMON_COLORS.line, borderBottomWidth: 1, flexDirection: 'row', gap: 10, paddingBottom: 10, paddingHorizontal: 18 },
  topPhone: { gap: 8, paddingBottom: 8, paddingHorizontal: 14 },
  topMiddle: { alignItems: 'center', flex: 1, minWidth: 0 },
  body: { flex: 1, flexDirection: 'row', minHeight: 0 },
  readingsColumn: { flex: 1, minWidth: 0, paddingTop: 14 },
  planColumn: { backgroundColor: SERMON_COLORS.surface, minHeight: 0 },
  planHead: { paddingBottom: 10, paddingHorizontal: 22, paddingTop: 18 },
  titleInput: { color: SERMON_COLORS.text, fontFamily: TYPOGRAPHY.title, fontWeight: '700', margin: 0, padding: 0 },
  meta: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 5 },
  metaText: { color: SERMON_COLORS.muted, fontSize: 13 },
  metaSynced: { color: SERMON_COLORS.written },
  bar: { backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: 999, height: 4, marginTop: 10, overflow: 'hidden' },
  barFill: { backgroundColor: SERMON_COLORS.gold, borderRadius: 999, height: '100%' },
  planScroll: { flex: 1, minHeight: 0 },
  planScrollContent: { paddingBottom: 18, paddingHorizontal: 22, paddingTop: 4 },
  planScrollPhone: { paddingBottom: 24, paddingHorizontal: 16 },
  narrow: { flex: 1, minHeight: 0 },
  narrowHead: { paddingHorizontal: 16, paddingTop: 6 },
  tabs: { marginBottom: 12, marginTop: 10 },
  narrowReadings: { flex: 1, minHeight: 0 },
  // The menu
  menuBackdrop: { flex: 1 },
  menuBackdropCentred: { alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', padding: 24 },
  menuCentred: { maxWidth: 360, position: 'relative', width: '100%' },
  menuTitle: { color: SERMON_COLORS.muted, fontSize: 12.5, fontWeight: '700', paddingBottom: 6, paddingHorizontal: 16, paddingTop: 8 },
  menu: { backgroundColor: '#1A2A1E', borderRadius: 14, minWidth: 220, paddingVertical: 6, position: 'absolute', shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.55, shadowRadius: 30 },
  menuItem: { paddingHorizontal: 16, paddingVertical: 11 },
  menuItemPressed: { backgroundColor: 'rgba(255, 255, 255, 0.06)' },
  menuText: { color: SERMON_COLORS.text, fontSize: 15 },
  menuTextDestructive: { color: '#E88484' },
});
