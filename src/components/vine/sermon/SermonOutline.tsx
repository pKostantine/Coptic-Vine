'use no memo'; // Names the parts in the planner's language.
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextStyle,
} from 'react-native';

import { withAlpha } from '@/constants/documentThemes';
import {
  SERMON_COLORS,
  SERMON_HIGHLIGHT_LABELS,
  SERMON_PART_NAMES,
  SERMON_PART_PLACEHOLDERS,
} from '@/constants/sermonPlanner';
import { MOTION, TYPOGRAPHY } from '@/constants/theme';
import type { SermonHighlight, SermonPart, SermonPartKind, SermonPlan } from '@/types/sermonPlanner';
import { groupHighlights, type HighlightGroup } from '@/utils/highlightGroups';
import { toEasternArabicDigits } from '@/utils/localeFormat';
import { abbreviateReference, isSermonPartWritten, sermonPointNumber } from '@/utils/sermonPlanner';
import Icon from '../ui/Icon';
import { pick, sermonStyles } from './SermonPieces';

export type SermonGroup = HighlightGroup<SermonHighlight>;

/** "Point 2", "Opening", "النقطة ٢". */
export function partLabel(parts: readonly SermonPart[], part: SermonPart, arabic: boolean): string {
  const name = SERMON_PART_NAMES[part.kind];
  const number = part.kind === 'point' ? sermonPointNumber(parts, part.id) : null;
  if (arabic) return number ? `${name.arabic} ${toEasternArabicDigits(number)}` : name.arabic;
  return number ? `${name.english} ${number}` : name.english;
}

/** A part's title, or what an empty one says. */
export function partTitle(part: SermonPart, arabic: boolean): string {
  if (part.title.trim()) return part.title.trim();
  const placeholder = SERMON_PART_PLACEHOLDERS[part.kind];
  return arabic ? placeholder.arabic : placeholder.english;
}

/** Where a highlight is in the readings, short: "Lk 1:35". */
export function groupReference(group: SermonGroup, verseReferences: Record<string, string>, short = true): string {
  const reference = verseReferences[group.lead.verseId];
  if (reference) return short ? abbreviateReference(reference) : reference;
  return group.lead.quote.split(/\s+/).slice(0, 3).join(' ');
}

/** A text field that grows with what is written in it. */
function GrowingInput({
  value,
  onChangeText,
  placeholder,
  style,
  minHeight,
  arabic,
  autoFocus,
  accessibilityLabel,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  style: TextStyle | TextStyle[];
  minHeight: number;
  arabic: boolean;
  autoFocus?: boolean;
  accessibilityLabel: string;
}) {
  const [height, setHeight] = useState(minHeight);
  return (
    <TextInput
      accessibilityLabel={accessibilityLabel}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="rgba(255, 255, 255, 0.32)"
      multiline
      autoFocus={autoFocus}
      scrollEnabled={false}
      onContentSizeChange={(event) => setHeight(Math.max(minHeight, Math.ceil(event.nativeEvent.contentSize.height)))}
      style={[styles.input, style, { height }, arabic && styles.inputArabic, Platform.OS === 'web' && styles.inputWeb]}
      textAlignVertical="top"
    />
  );
}

/** A highlight placed in a part: its colour and where it is ("Lk 1:35"). */
function HighlightChip({ group, verseReferences, onPress, onRemove, arabic }: {
  group: SermonGroup;
  verseReferences: Record<string, string>;
  onPress: () => void;
  onRemove?: () => void;
  arabic: boolean;
}) {
  const label = SERMON_HIGHLIGHT_LABELS[group.lead.color];
  return (
    <View style={styles.chip}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${groupReference(group, verseReferences, false)}, ${arabic ? label.arabic : label.english}`}
        onPress={onPress}
        style={({ pressed }) => [styles.chipMain, pressed && styles.pressed]}
      >
        <View style={[styles.dot, { backgroundColor: label.swatch }]} />
        <Text style={styles.chipText}>{groupReference(group, verseReferences)}</Text>
      </Pressable>
      {onRemove ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={pick(arabic, 'Take it out of this part', 'أخرجها من هذا الجزء')}
          hitSlop={6}
          onPress={onRemove}
          style={({ pressed }) => [styles.chipRemove, pressed && styles.pressed]}
        >
          <Icon name="close" size={11} color={SERMON_COLORS.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** The six dots a part is dragged by. */
function Grip({ onDragStart, onDrag, onDragEnd, label }: {
  onDragStart: () => void;
  onDrag: (dy: number) => void;
  onDragEnd: (dy: number, cancelled: boolean) => void;
  label: string;
}) {
  const handlers = useRef({ onDragStart, onDrag, onDragEnd });
  useEffect(() => {
    handlers.current = { onDragStart, onDrag, onDragEnd };
  });
  // Made once, so a drag isn't cut off by a fresh responder as the part
  // re-renders under it; it calls whatever handlers the part has now. The
  // refs are read only when the gesture fires, never while rendering.
  // eslint-disable-next-line react-hooks/refs
  const [responder] = useState(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => handlers.current.onDragStart(),
    onPanResponderMove: (_event, gesture) => handlers.current.onDrag(gesture.dy),
    onPanResponderRelease: (_event, gesture) => handlers.current.onDragEnd(gesture.dy, false),
    onPanResponderTerminate: (_event, gesture) => handlers.current.onDragEnd(gesture.dy, true),
  }));
  return (
    <View
      accessibilityLabel={label}
      {...responder.panHandlers}
      style={[styles.grip, Platform.OS === 'web' && styles.gripWeb]}
    >
      {[0, 1, 2].map((row) => (
        <View key={row} style={styles.gripRow}>
          <View style={styles.gripDot} />
          <View style={styles.gripDot} />
        </View>
      ))}
    </View>
  );
}

interface PartCardProps {
  part: SermonPart;
  parts: SermonPart[];
  index: number;
  groups: Map<string, SermonGroup>;
  verseReferences: Record<string, string>;
  arabic: boolean;
  open: boolean;
  dragging: boolean;
  dragY: number;
  onOpen: () => void;
  onClose: () => void;
  onChange: (patch: Partial<Pick<SermonPart, 'title' | 'body'>>) => void;
  onMove: (toIndex: number) => void;
  onRemove: () => void;
  onShowHighlight: (groupId: string) => void;
  onUnplace: (groupId: string) => void;
  onDragStart: () => void;
  onDrag: (dy: number) => void;
  onDragEnd: (dy: number, cancelled: boolean) => void;
}

function PartCard({
  part, parts, index, groups, verseReferences, arabic, open, dragging, dragY,
  onOpen, onClose, onChange, onMove, onRemove, onShowHighlight, onUnplace, onDragStart, onDrag, onDragEnd,
}: PartCardProps) {
  const written = isSermonPartWritten(part);
  const placed = part.highlightIds.map((id) => groups.get(id)).filter((group): group is SermonGroup => Boolean(group));
  const label = partLabel(parts, part, arabic);
  const empty = !written && !part.title.trim();
  const status = (
    <View style={[styles.status, arabic && styles.rtl]}>
      {written ? <Icon name="checkmark-circle" size={14} color={SERMON_COLORS.written} /> : null}
      <Text style={styles.statusText}>{written ? pick(arabic, 'Written', 'مكتوب') : pick(arabic, 'Empty', 'فارغ')}</Text>
    </View>
  );
  return (
    <View
      style={[
        styles.card,
        arabic && styles.rtl,
        dragging && styles.cardDragging,
        dragging && { transform: [{ translateY: dragY }] },
      ]}
    >
      <Grip
        label={pick(arabic, `Move ${label}`, `انقل ${label}`)}
        onDragStart={onDragStart}
        onDrag={onDrag}
        onDragEnd={onDragEnd}
      />
      {open ? (
        <View style={styles.cardBody}>
          <View style={[styles.cardHead, arabic && styles.rtl]}>
            <Text style={sermonStyles.eyebrow}>{label}</Text>
            <View style={[styles.cardTools, arabic && styles.rtl]}>
              <Pressable accessibilityRole="button" accessibilityLabel={pick(arabic, 'Move up', 'إلى أعلى')} disabled={index === 0} onPress={() => onMove(index - 1)} style={({ pressed }) => [styles.tool, index === 0 && styles.toolOff, pressed && styles.pressed]}>
                <Icon name="chevron-back" size={14} color={SERMON_COLORS.muted} style={styles.up} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={pick(arabic, 'Move down', 'إلى أسفل')} disabled={index === parts.length - 1} onPress={() => onMove(index + 1)} style={({ pressed }) => [styles.tool, index === parts.length - 1 && styles.toolOff, pressed && styles.pressed]}>
                <Icon name="chevron-forward" size={14} color={SERMON_COLORS.muted} style={styles.up} />
              </Pressable>
              {parts.length > 1 ? (
                <Pressable accessibilityRole="button" accessibilityLabel={pick(arabic, `Remove ${label}`, `احذف ${label}`)} onPress={onRemove} style={({ pressed }) => [styles.tool, pressed && styles.pressed]}>
                  <Icon name="trash-outline" size={14} color={SERMON_COLORS.muted} />
                </Pressable>
              ) : null}
              <Pressable accessibilityRole="button" accessibilityLabel={pick(arabic, 'Done', 'تم')} onPress={onClose} style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]}>
                <Text style={styles.doneText}>{pick(arabic, 'Done', 'تم')}</Text>
              </Pressable>
            </View>
          </View>
          <GrowingInput
            accessibilityLabel={pick(arabic, `${label} title`, `عنوان ${label}`)}
            value={part.title}
            onChangeText={(title) => onChange({ title })}
            placeholder={partTitle({ ...part, title: '' }, arabic)}
            style={styles.titleInput}
            minHeight={26}
            arabic={arabic}
          />
          <GrowingInput
            accessibilityLabel={pick(arabic, `${label} text`, `نص ${label}`)}
            value={part.body}
            onChangeText={(body) => onChange({ body })}
            placeholder={pick(arabic, 'Write what this part says', 'اكتب ما يقوله هذا الجزء')}
            style={styles.bodyInput}
            minHeight={60}
            arabic={arabic}
            autoFocus={!part.body}
          />
          {placed.length ? (
            <View style={[styles.chips, arabic && styles.rtl]}>
              {placed.map((group) => (
                <HighlightChip key={group.groupId} group={group} verseReferences={verseReferences} arabic={arabic} onPress={() => onShowHighlight(group.groupId)} onRemove={() => onUnplace(group.groupId)} />
              ))}
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.cardBody}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${partTitle(part, arabic)}`}
            onPress={onOpen}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <View style={[styles.cardHead, arabic && styles.rtl]}>
              <Text style={sermonStyles.eyebrow}>{label}</Text>
              {status}
            </View>
            <Text style={[styles.cardTitle, empty && styles.cardTitleEmpty, arabic && styles.textRight]}>{partTitle(part, arabic)}</Text>
            <Text numberOfLines={2} style={[styles.cardText, !written && styles.cardTextEmpty, arabic && styles.textRight]}>
              {written ? part.body.trim() : pick(arabic, 'Tap to write', 'انقر للكتابة')}
            </Text>
          </Pressable>
          {placed.length ? (
            <View style={[styles.chips, arabic && styles.rtl]}>
              {placed.map((group) => (
                <HighlightChip key={group.groupId} group={group} verseReferences={verseReferences} arabic={arabic} onPress={() => onShowHighlight(group.groupId)} />
              ))}
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

const ADDABLE: SermonPartKind[] = ['point', 'opening', 'application', 'closing'];

interface SermonOutlineProps {
  plan: SermonPlan;
  arabic: boolean;
  /** The season's ornament colour: the one sentence's card is washed in it. */
  ornament: string;
  openPartId: string | null;
  onOpenPart: (id: string | null) => void;
  verseReferences: Record<string, string>;
  onShowHighlight: (groupId: string) => void;
  onBigIdeaChange: (value: string) => void;
  onPartChange: (partId: string, patch: Partial<Pick<SermonPart, 'title' | 'body'>>) => void;
  onMovePart: (partId: string, toIndex: number) => void;
  onRemovePart: (partId: string) => void;
  onAddPart: (kind: SermonPartKind) => string;
  onUnplace: (groupId: string) => void;
  /** A part being dragged: the scroll it sits in holds still. */
  onDragChange: (dragging: boolean) => void;
}

/**
 * The plan itself: the one sentence, then the parts as cards -- written or
 * still empty, each with the highlights placed in it -- reordered by their
 * grips, opened to be written in place.
 */
export default function SermonOutline({
  plan, arabic, ornament, openPartId, onOpenPart, verseReferences, onShowHighlight,
  onBigIdeaChange, onPartChange, onMovePart, onRemovePart, onAddPart, onUnplace, onDragChange,
}: SermonOutlineProps) {
  const groups = useMemo(() => new Map(groupHighlights(plan.highlights).map((group) => [group.groupId, group])), [plan.highlights]);
  const layouts = useRef<Record<string, { y: number; height: number }>>({});
  // The part being dragged, how far, and where it would land.
  const [drag, setDrag] = useState<{ id: string; dy: number; to: number } | null>(null);
  const [adding, setAdding] = useState(false);
  const [bigIdeaOpen, setBigIdeaOpen] = useState(false);

  const targetIndex = (id: string, dy: number) => {
    const own = layouts.current[id];
    if (!own) return plan.parts.findIndex((part) => part.id === id);
    const centre = own.y + own.height / 2 + dy;
    return plan.parts.filter((part) => {
      if (part.id === id) return false;
      const layout = layouts.current[part.id];
      return layout ? layout.y + layout.height / 2 < centre : false;
    }).length;
  };

  const from = drag ? plan.parts.findIndex((part) => part.id === drag.id) : -1;
  const to = drag ? drag.to : -1;

  return (
    <View style={[styles.outline, drag && Platform.OS === 'web' && styles.noSelect]}>
      <View style={styles.bigWrap}>
        <LinearGradient
          colors={[withAlpha(ornament, 0.24), withAlpha(ornament, 0.07)]}
          start={{ x: 0.33, y: 0 }}
          end={{ x: 0.67, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={styles.bigInner}>
          <Text style={[sermonStyles.eyebrow, arabic && styles.textRight]}>{pick(arabic, 'The one sentence', 'الجملة الواحدة')}</Text>
          {bigIdeaOpen ? (
            <GrowingInput
              accessibilityLabel={pick(arabic, 'The one sentence text', 'نص الجملة الواحدة')}
              value={plan.bigIdea}
              onChangeText={onBigIdeaChange}
              placeholder={pick(arabic, 'The whole sermon in one sentence', 'العظة كلها في جملة واحدة')}
              style={styles.bigInput}
              minHeight={28}
              arabic={arabic}
              autoFocus
            />
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={pick(arabic, 'The one sentence', 'الجملة الواحدة')}
              onPress={() => setBigIdeaOpen(true)}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Text style={[styles.bigText, !plan.bigIdea.trim() && styles.bigTextEmpty, arabic && styles.textRight]}>
                {plan.bigIdea.trim() || pick(arabic, 'The whole sermon in one sentence', 'العظة كلها في جملة واحدة')}
              </Text>
            </Pressable>
          )}
          {bigIdeaOpen ? (
            <Pressable accessibilityRole="button" onPress={() => setBigIdeaOpen(false)} style={({ pressed }) => [styles.bigDone, pressed && styles.pressed]}>
              <Text style={styles.doneText}>{pick(arabic, 'Done', 'تم')}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {plan.parts.map((part, index) => (
        <View
          key={part.id}
          // Where each part sits in the outline, for where a dragged one lands.
          onLayout={(event) => {
            const { y, height } = event.nativeEvent.layout;
            layouts.current[part.id] = { y, height };
          }}
          style={drag?.id === part.id ? styles.dragRow : undefined}
        >
          {drag && to !== from && to === index && to < from ? <View style={styles.dropLine} /> : null}
          <PartCard
            part={part}
            parts={plan.parts}
            index={index}
            groups={groups}
            verseReferences={verseReferences}
            arabic={arabic}
            open={openPartId === part.id && !drag}
            dragging={drag?.id === part.id}
            dragY={drag?.id === part.id ? drag.dy : 0}
            onOpen={() => onOpenPart(part.id)}
            onClose={() => onOpenPart(null)}
            onChange={(patch) => onPartChange(part.id, patch)}
            onMove={(toIndex) => onMovePart(part.id, toIndex)}
            onRemove={() => {
              onRemovePart(part.id);
              onOpenPart(null);
            }}
            onShowHighlight={onShowHighlight}
            onUnplace={onUnplace}
            onDragStart={() => {
              onDragChange(true);
              setDrag({ id: part.id, dy: 0, to: index });
            }}
            onDrag={(dy) => setDrag({ id: part.id, dy, to: targetIndex(part.id, dy) })}
            onDragEnd={(dy, cancelled) => {
              const target = targetIndex(part.id, dy);
              setDrag(null);
              onDragChange(false);
              if (!cancelled && target !== index) onMovePart(part.id, target);
            }}
          />
          {drag && to !== from && to === index && to > from ? <View style={styles.dropLine} /> : null}
        </View>
      ))}

      {adding ? (
        <View style={[styles.addKinds, arabic && styles.rtl]}>
          {ADDABLE.map((kind) => (
            <Pressable
              key={kind}
              accessibilityRole="button"
              onPress={() => {
                setAdding(false);
                onOpenPart(onAddPart(kind));
              }}
              style={({ pressed }) => [styles.addKind, pressed && styles.pressed]}
            >
              <Text style={styles.addKindText}>{arabic ? SERMON_PART_NAMES[kind].arabic : SERMON_PART_NAMES[kind].english}</Text>
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" accessibilityLabel={pick(arabic, 'Cancel', 'إلغاء')} onPress={() => setAdding(false)} style={({ pressed }) => [styles.addCancel, pressed && styles.pressed]}>
            <Icon name="close" size={14} color={SERMON_COLORS.muted} />
          </Pressable>
        </View>
      ) : (
        <Pressable accessibilityRole="button" onPress={() => setAdding(true)} style={({ pressed }) => [styles.add, pressed && styles.pressed]}>
          <Icon name="add" size={16} color={SERMON_COLORS.gold} />
          <Text style={styles.addText}>{pick(arabic, 'Add a part', 'أضف جزءاً')}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: MOTION.pressOpacity },
  rtl: { flexDirection: 'row-reverse' },
  textRight: { textAlign: 'right', writingDirection: 'rtl' },
  outline: { gap: 8 },
  bigWrap: { borderRadius: 16, marginBottom: 4, overflow: 'hidden' },
  bigInner: { paddingHorizontal: 16, paddingVertical: 14 },
  bigText: { color: SERMON_COLORS.text, fontFamily: TYPOGRAPHY.title, fontSize: 18, lineHeight: 26, marginTop: 6 },
  bigTextEmpty: { color: 'rgba(255, 255, 255, 0.4)', fontStyle: 'italic' },
  bigInput: { color: SERMON_COLORS.text, fontFamily: TYPOGRAPHY.title, fontSize: 18, lineHeight: 26, marginTop: 6 },
  bigDone: { alignSelf: 'flex-end', marginTop: 6, paddingHorizontal: 4, paddingVertical: 4 },
  card: { backgroundColor: SERMON_COLORS.raised, borderRadius: 16, flexDirection: 'row', gap: 12, paddingBottom: 13, paddingLeft: 12, paddingRight: 14, paddingTop: 12 },
  cardDragging: { elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 18, zIndex: 10 },
  grip: { gap: 1.5, paddingBottom: 6, paddingTop: 4, width: 12 },
  // A mouse drag on the web moves the part, never selects the page; a finger on it never scrolls.
  gripWeb: { cursor: 'grab', touchAction: 'none', userSelect: 'none' } as never,
  noSelect: { userSelect: 'none' } as never,
  gripRow: { flexDirection: 'row', gap: 2 },
  gripDot: { backgroundColor: '#5F6E61', borderRadius: 2, height: 3.2, width: 3.2 },
  cardBody: { flex: 1, minWidth: 0 },
  cardHead: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  cardTools: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  tool: { alignItems: 'center', backgroundColor: SERMON_COLORS.fill, borderRadius: 999, height: 26, justifyContent: 'center', width: 26 },
  toolOff: { opacity: 0.35 },
  up: { transform: [{ rotate: '90deg' }] },
  doneButton: { paddingHorizontal: 8, paddingVertical: 4 },
  doneText: { color: SERMON_COLORS.gold, fontSize: 13, fontWeight: '700' },
  status: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  statusText: { color: SERMON_COLORS.muted, fontSize: 11, fontWeight: '600' },
  cardTitle: { color: SERMON_COLORS.text, fontFamily: TYPOGRAPHY.title, fontSize: 17, fontWeight: '700', lineHeight: 22, marginBottom: 2, marginTop: 3 },
  cardTitleEmpty: { color: 'rgba(255, 255, 255, 0.55)' },
  cardText: { color: SERMON_COLORS.muted, fontSize: 13.5, lineHeight: 19.5 },
  cardTextEmpty: { color: 'rgba(255, 255, 255, 0.32)', fontStyle: 'italic' },
  input: { color: SERMON_COLORS.text, margin: 0, padding: 0 },
  inputArabic: { textAlign: 'right', writingDirection: 'rtl' },
  inputWeb: { outlineStyle: 'none' } as never,
  titleInput: { fontFamily: TYPOGRAPHY.title, fontSize: 17, fontWeight: '700', lineHeight: 22, marginBottom: 6, marginTop: 6 },
  bodyInput: { fontSize: 14.5, lineHeight: 21 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: { alignItems: 'center', backgroundColor: SERMON_COLORS.fill, borderRadius: 999, flexDirection: 'row', height: 24 },
  chipMain: { alignItems: 'center', flexDirection: 'row', gap: 6, height: 24, paddingHorizontal: 9 },
  chipRemove: { alignItems: 'center', height: 24, justifyContent: 'center', marginLeft: -4, paddingLeft: 2, paddingRight: 8 },
  dot: { borderRadius: 999, height: 8, width: 8 },
  chipText: { color: SERMON_COLORS.text, fontSize: 12, fontWeight: '600' },
  dragRow: { zIndex: 10 },
  dropLine: { backgroundColor: SERMON_COLORS.gold, borderRadius: 2, height: 2, marginVertical: 2 },
  add: { alignItems: 'center', backgroundColor: 'rgba(227, 181, 59, 0.10)', borderRadius: 14, flexDirection: 'row', gap: 6, height: 40, justifyContent: 'center' },
  addText: { color: SERMON_COLORS.gold, fontSize: 14, fontWeight: '700' },
  addKinds: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  addKind: { alignItems: 'center', backgroundColor: 'rgba(227, 181, 59, 0.10)', borderRadius: 999, height: 36, justifyContent: 'center', paddingHorizontal: 14 },
  addKindText: { color: SERMON_COLORS.gold, fontSize: 13.5, fontWeight: '700' },
  addCancel: { alignItems: 'center', backgroundColor: SERMON_COLORS.fill, borderRadius: 999, height: 36, justifyContent: 'center', width: 36 },
});
