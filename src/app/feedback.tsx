'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';

import { NowPlayingAwareScrollView } from '@/components/playback/NowPlayingAwareScroll';
import { PageGlow } from '@/components/vine/screens/BookPage';
import BleedPage from '@/components/vine/ui/BleedPage';
import BottomTabBar from '@/components/vine/ui/BottomTabBar';
import Icon, { type IconName } from '@/components/vine/ui/Icon';
import LoadFailure from '@/components/vine/ui/LoadFailure';
import SubPageHeader from '@/components/vine/ui/SubPageHeader';
import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useReadingPreferences } from '@/context/ReadingPreferencesContext';
import { deleteBetaFeedback, listBetaFeedback, setBetaFeedbackStatus, submitBetaFeedback, thisDevice } from '@/services/betaFeedbackService';
import {
  FEEDBACK_KINDS,
  FEEDBACK_LIMITS,
  FEEDBACK_STATUSES,
  filterFeedback,
  isOpenFeedback,
  type FeedbackFilter,
  type FeedbackItem,
  type FeedbackKind,
  type FeedbackStatus,
} from '@/utils/betaFeedback';
import { formatDayMonthDate } from '@/utils/localeFormat';
import { goBack } from '@/utils/navigation';
import { useLayoutMode } from '@/utils/useLayoutMode';

import { tr } from '../utils/appText';

const MAX_FONT_SCALE = 1.3;
const PLACEHOLDER = 'rgba(205, 216, 203, 0.55)';
const ERROR = '#FF8A8A';

function kindLabel(kind: FeedbackKind): string {
  switch (kind) {
    case 'bug': return tr('Something’s wrong', 'Un problème', 'مشكلة');
    case 'idea': return tr('An idea', 'Une idée', 'فكرة');
    case 'text': return tr('A text or translation', 'Un texte ou une traduction', 'نص أو ترجمة');
  }
}

const KIND_ICONS: Record<FeedbackKind, IconName> = { bug: 'construct-outline', idea: 'sunny-outline', text: 'document-text-outline' };

function statusLabel(status: FeedbackStatus): string {
  switch (status) {
    case 'open': return tr('Open', 'Ouvert', 'مفتوح');
    case 'planned': return tr('Planned', 'Prévu', 'مخطط له');
    case 'fixed': return tr('Fixed', 'Corrigé', 'تم الإصلاح');
    case 'not_planned': return tr('Not planned', 'Non prévu', 'غير مخطط له');
    case 'duplicate': return tr('Duplicate', 'Doublon', 'مكرر');
  }
}

/** Each status in its own colour: gold still open, blue planned, green fixed, grey set aside. */
const STATUS_COLORS: Record<FeedbackStatus, string> = {
  open: COLORS.goldBright,
  planned: COLORS.rowBlue,
  fixed: COLORS.link,
  not_planned: COLORS.muted,
  duplicate: COLORS.muted,
};

function confirmDelete(title: string, onConfirm: () => void) {
  const question = tr('Delete this feedback?', 'Supprimer ce retour ?', 'أتحذف هذه الملاحظة؟');
  if (Platform.OS === 'web') {
    if ((globalThis as { confirm?: (message: string) => boolean }).confirm?.(`${question}\n${title}`)) onConfirm();
    return;
  }
  Alert.alert(question, title, [
    { text: tr('Cancel', 'Annuler', 'إلغاء'), style: 'cancel' },
    { text: tr('Delete', 'Supprimer', 'احذف'), style: 'destructive', onPress: onConfirm },
  ]);
}

/**
 * Beta Feedback, from Home and the Account page: for the app's testers, and
 * temporary. A report is filed above -- what kind, a title, what happened,
 * where in the app -- with the device it was seen on, and every report
 * anyone has filed is listed below it, numbered as issues are, with its
 * status, so everyone sees what has been reported and what has been fixed.
 * An admin sets each one's status and a note, or deletes it.
 */
export default function FeedbackScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const fullName = user?.user_metadata?.full_name;
  const accountName = (typeof fullName === 'string' && fullName.trim()) || user?.email || '';
  const { preferences } = useReadingPreferences();
  const arabic = preferences.appLanguage === 'ar';
  const wide = useLayoutMode() !== 'phone';
  const title = tr('Beta Feedback', 'Retours sur la bêta', 'ملاحظات النسخة التجريبية');

  const [items, setItems] = useState<FeedbackItem[] | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FeedbackFilter>('open');

  const [kind, setKind] = useState<FeedbackKind>('bug');
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [area, setArea] = useState('');
  const [name, setName] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sent, setSent] = useState<number | null>(null);
  const [device] = useState(thisDevice);
  const loadToken = useRef(0);

  const load = useCallback(async () => {
    const token = ++loadToken.current;
    try {
      const answer = await listBetaFeedback();
      if (token !== loadToken.current) return;
      setItems(answer.items);
      setCanManage(answer.canManage);
      setLoadError(null);
    } catch (cause) {
      if (token === loadToken.current) setLoadError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);
  // Afresh each time the page is shown, and when another account signs in
  // (what is "yours", and whether the statuses may be set, are the account's).
  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));
  const shownForRef = useRef(userId);
  useEffect(() => {
    if (shownForRef.current === userId) return;
    shownForRef.current = userId;
    void load();
  }, [load, userId]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const send = async () => {
    setSending(true);
    setSendError(null);
    try {
      const filed = await submitBetaFeedback({ kind, title: subject.trim(), details: details.trim(), area: area.trim(), name: name.trim() });
      setSent(filed.number);
      setSubject('');
      setDetails('');
      setFilter('open');
      setItems((current) => [filed, ...(current ?? []).filter((item) => item.id !== filed.id)]);
      void load();
    } catch (cause) {
      setSendError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSending(false);
    }
  };

  const replace = (changed: FeedbackItem) => setItems((current) => current?.map((item) => (item.id === changed.id ? changed : item)) ?? current);
  const remove = (id: string) => setItems((current) => current?.filter((item) => item.id !== id) ?? current);

  const counts = useMemo(() => {
    const all = items ?? [];
    return { open: filterFeedback(all, 'open').length, done: filterFeedback(all, 'done').length, all: all.length };
  }, [items]);
  const shown = items ? filterFeedback(items, filter) : [];
  const canSend = subject.trim().length > 0 && !sending;

  const filters: { key: FeedbackFilter; label: string }[] = [
    { key: 'open', label: tr('Open', 'Ouverts', 'مفتوحة') },
    { key: 'done', label: tr('Closed', 'Fermés', 'مغلقة') },
    { key: 'all', label: tr('All', 'Tous', 'الكل') },
  ];

  return (
    <BleedPage background={<PageGlow kind="green" tall={wide} />} footer={<BottomTabBar active={null} />}>
      <Head>
        <title>{`${title} — Coptic Vine`}</title>
      </Head>
      <SubPageHeader title={title} arabic={arabic} onBack={() => goBack(router, '/')} backLabel={tr('Back', 'Retour', 'رجوع')} />
      <NowPlayingAwareScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={Platform.OS === 'web' ? undefined : <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={COLORS.gold} />}
      >
        <View style={styles.column}>
          <Text style={[styles.intro, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {tr(
              'Coptic Vine is in beta. Tell us anything that’s wrong or could be better. Everything reported is listed below for every tester to see, with where it stands.',
              'Coptic Vine est en bêta. Dites-nous tout ce qui ne va pas ou pourrait être mieux. Tout ce qui est signalé figure ci-dessous, visible par tous les testeurs, avec son état.',
              'تطبيق Coptic Vine في مرحلته التجريبية. أخبرنا بكل ما فيه خطأ أو ما يمكن تحسينه. كل ما يُبلَّغ عنه يظهر أدناه لجميع المختبرين، مع حالته.',
            )}
          </Text>

          <View style={styles.formCard}>
            <LinearGradient colors={[COLORS.surfaceDeep, COLORS.surface]} style={StyleSheet.absoluteFill} pointerEvents="none" />
            <Text style={[styles.cardTitle, arabic && styles.arabic]} accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {tr('Report something', 'Signaler quelque chose', 'أبلغ عن شيء')}
            </Text>
            <View style={styles.kinds} accessibilityRole="radiogroup">
              {FEEDBACK_KINDS.map((option) => {
                const active = option === kind;
                return (
                  <Pressable
                    key={option}
                    accessibilityRole="radio"
                    aria-checked={active}
                    accessibilityLabel={kindLabel(option)}
                    onPress={() => setKind(option)}
                    style={({ pressed }) => [styles.kind, active && styles.kindActive, pressed && styles.pressed]}
                  >
                    <View><Icon name={KIND_ICONS[option]} size={17} color={active ? COLORS.greenDeep : COLORS.gold} /></View>
                    <Text style={[styles.kindText, active && styles.kindTextActive, arabic && styles.arabicInline]} numberOfLines={2} maxFontSizeMultiplier={MAX_FONT_SCALE}>{kindLabel(option)}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Field label={tr('In a few words', 'En quelques mots', 'في كلمات قليلة')} arabic={arabic}>
              <TextInput
                value={subject}
                onChangeText={setSubject}
                maxLength={FEEDBACK_LIMITS.title}
                placeholder={tr('The Psali skips a verse in slideshow mode', 'La Psali saute un verset en diaporama', 'الإبصالية تتخطى ربعًا في العرض التقديمي')}
                placeholderTextColor={PLACEHOLDER}
                style={[styles.input, arabic && styles.inputArabic]}
                returnKeyType="next"
              />
            </Field>
            <Field label={tr('What happened', 'Ce qui s’est passé', 'ماذا حدث')} arabic={arabic}>
              <TextInput
                value={details}
                onChangeText={setDetails}
                maxLength={FEEDBACK_LIMITS.details}
                multiline
                textAlignVertical="top"
                placeholder={tr(
                  'What you did, what you expected, and what you saw instead',
                  'Ce que vous avez fait, ce que vous attendiez, et ce que vous avez vu',
                  'ما الذي فعلته، وما الذي توقعته، وما الذي رأيته بدلًا منه',
                )}
                placeholderTextColor={PLACEHOLDER}
                style={[styles.input, styles.multiline, arabic && styles.inputArabic]}
              />
            </Field>
            <Field label={tr('Where in the app', 'Où dans l’application', 'أين في التطبيق')} arabic={arabic}>
              <TextInput
                value={area}
                onChangeText={setArea}
                maxLength={FEEDBACK_LIMITS.area}
                placeholder={tr('Midnight Praises, the Psali Adam', 'Louanges de minuit, Psali Adam', 'التسبحة، الإبصالية الآدام')}
                placeholderTextColor={PLACEHOLDER}
                style={[styles.input, arabic && styles.inputArabic]}
              />
            </Field>
            {!user ? (
              <Field label={tr('Your name (optional)', 'Votre nom (facultatif)', 'اسمك (اختياري)')} arabic={arabic}>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  maxLength={FEEDBACK_LIMITS.name}
                  autoComplete="name"
                  placeholder={tr('Shown with your report', 'Affiché avec votre retour', 'يظهر مع ملاحظتك')}
                  placeholderTextColor={PLACEHOLDER}
                  style={[styles.input, arabic && styles.inputArabic]}
                />
              </Field>
            ) : null}
            <Text style={[styles.sentWith, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {user
                ? tr(`Sent as ${accountName}, with ${device}.`, `Envoyé au nom de ${accountName}, avec ${device}.`, `يُرسَل باسم ${accountName}، مع ${device}.`)
                : tr(`Sent with ${device}.`, `Envoyé avec ${device}.`, `يُرسَل مع ${device}.`)}
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={!canSend}
              onPress={() => void send()}
              style={({ pressed }) => [styles.sendButton, !canSend && styles.disabled, pressed && styles.pressed]}
            >
              {sending ? <ActivityIndicator color={COLORS.greenDeep} /> : (
                <Text style={[styles.sendText, arabic && styles.arabicInline]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{tr('Send', 'Envoyer', 'أرسل')}</Text>
              )}
            </Pressable>
            {sendError ? <Text style={[styles.errorText, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{sendError}</Text> : null}
            {sent !== null && !sendError ? (
              <Text style={[styles.noticeText, arabic && styles.arabic]} accessibilityLiveRegion="polite" maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {tr(`Thank you. It’s #${sent} on the list below.`, `Merci. C’est le n° ${sent} dans la liste ci-dessous.`, `شكرًا لك. إنها رقم ${sent} في القائمة أدناه.`)}
              </Text>
            ) : null}
          </View>

          <View style={styles.listHead}>
            <Text style={[styles.listTitle, arabic && styles.arabic]} accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {tr('Reported', 'Signalés', 'المُبلَّغ عنه')}
            </Text>
            {Platform.OS === 'web' ? (
              <Pressable accessibilityRole="button" accessibilityLabel={tr('Refresh', 'Actualiser', 'تحديث')} hitSlop={6} onPress={() => void refresh()} style={({ pressed }) => [styles.refresh, pressed && styles.pressed]}>
                {refreshing ? <ActivityIndicator size="small" color={COLORS.gold} /> : <Icon name="refresh" size={18} color={COLORS.gold} />}
              </Pressable>
            ) : null}
          </View>
          <View style={styles.filters} accessibilityRole="tablist">
            {filters.map((option) => {
              const active = option.key === filter;
              return (
                <Pressable
                  key={option.key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  onPress={() => setFilter(option.key)}
                  style={({ pressed }) => [styles.filter, active && styles.filterActive, pressed && styles.pressed]}
                >
                  <Text style={[styles.filterText, active && styles.filterTextActive, arabic && styles.arabicInline]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {`${option.label} · ${counts[option.key]}`}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {loadError && !items ? (
            <LoadFailure error={loadError} onRetry={() => void load()} layout="inline" />
          ) : !items ? (
            <ActivityIndicator style={styles.loader} color={COLORS.gold} />
          ) : !shown.length ? (
            <Text style={[styles.empty, arabic && styles.arabicCentered]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {filter === 'done'
                ? tr('Nothing closed yet.', 'Rien de fermé pour l’instant.', 'لا شيء مغلق بعد.')
                : filter === 'open' && items.length
                  ? tr('Nothing open: everything reported has been dealt with.', 'Rien d’ouvert : tout ce qui a été signalé a été traité.', 'لا شيء مفتوح: تم التعامل مع كل ما أُبلغ عنه.')
                  : tr('Nothing reported yet. Be the first.', 'Rien de signalé pour l’instant. Soyez le premier.', 'لم يُبلَّغ عن شيء بعد. كن الأول.')}
            </Text>
          ) : (
            shown.map((item) => (
              <FeedbackCard key={item.id} item={item} arabic={arabic} canManage={canManage} onChanged={replace} onDeleted={remove} />
            ))
          )}
        </View>
      </NowPlayingAwareScrollView>
    </BleedPage>
  );
}

/** A labelled input, as the Account page sets its own. */
function Field({ label, arabic, children }: { label: string; arabic: boolean; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, arabic && styles.arabicKicker]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{arabic ? label : label.toUpperCase()}</Text>
      {children}
    </View>
  );
}

/** One report: its number, kind and status, what it is, who filed it and when; an admin's controls under it. */
function FeedbackCard({ item, arabic, canManage, onChanged, onDeleted }: {
  item: FeedbackItem;
  arabic: boolean;
  canManage: boolean;
  onChanged: (item: FeedbackItem) => void;
  onDeleted: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [managing, setManaging] = useState(false);
  const [note, setNote] = useState(item.statusNote ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const long = item.details.length > 220 || item.details.split('\n').length > 4;
  const filed = new Date(item.createdAt);
  const when = Number.isNaN(filed.getTime()) ? '' : formatDayMonthDate(new Date(Date.UTC(filed.getFullYear(), filed.getMonth(), filed.getDate())), arabic);
  const who = item.reporterName || tr('Anonymous', 'Anonyme', 'مجهول');
  const meta = [who, when, item.area, item.device].filter(Boolean).join(' · ');

  const act = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };
  const setStatus = (status: FeedbackStatus) => act(async () => onChanged(await setBetaFeedbackStatus(item.id, status, note.trim())));

  return (
    <View style={[styles.card, !isOpenFeedback(item) && styles.cardClosed]}>
      <LinearGradient colors={[COLORS.surfaceDeep, COLORS.surface]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={styles.cardHead}>
        <Text style={styles.number} maxFontSizeMultiplier={MAX_FONT_SCALE}>{`#${item.number}`}</Text>
        <View style={styles.kindChip}>
          <View><Icon name={KIND_ICONS[item.kind]} size={13} color={COLORS.gold} /></View>
          <Text style={[styles.chipText, arabic && styles.arabicInline]} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>{kindLabel(item.kind)}</Text>
        </View>
        <View style={styles.flex} />
        {item.mine ? <Text style={[styles.mine, arabic && styles.arabicInline]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{tr('Yours', 'Le vôtre', 'لك')}</Text> : null}
        <View style={[styles.statusChip, { borderColor: STATUS_COLORS[item.status] }]}>
          <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] }, arabic && styles.arabicInline]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{statusLabel(item.status)}</Text>
        </View>
      </View>
      <Text style={styles.cardTitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>{item.title}</Text>
      {item.details ? (
        <Pressable disabled={!long} onPress={() => setExpanded((value) => !value)} accessibilityRole={long ? 'button' : undefined} accessibilityLabel={long ? (expanded ? tr('Show less', 'Afficher moins', 'عرض أقل') : tr('Show more', 'Afficher plus', 'عرض المزيد')) : undefined}>
          <Text style={styles.details} numberOfLines={long && !expanded ? 4 : undefined} maxFontSizeMultiplier={MAX_FONT_SCALE}>{item.details}</Text>
          {long ? <Text style={[styles.more, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{expanded ? tr('Show less', 'Afficher moins', 'عرض أقل') : tr('Show more', 'Afficher plus', 'عرض المزيد')}</Text> : null}
        </Pressable>
      ) : null}
      {item.statusNote ? (
        <View style={[styles.note, { borderColor: STATUS_COLORS[item.status] }]}>
          <Text style={styles.noteText} maxFontSizeMultiplier={MAX_FONT_SCALE}>{item.statusNote}</Text>
        </View>
      ) : null}
      <Text style={styles.meta} maxFontSizeMultiplier={MAX_FONT_SCALE}>{meta}</Text>

      {canManage ? (
        <View style={styles.manage}>
          <Pressable accessibilityRole="button" aria-expanded={managing} onPress={() => setManaging((value) => !value)} style={({ pressed }) => [styles.manageToggle, pressed && styles.pressed]}>
            <View><Icon name="settings-outline" size={15} color={COLORS.gold} /></View>
            <Text style={[styles.manageText, arabic && styles.arabicInline]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{tr('Manage', 'Gérer', 'إدارة')}</Text>
            <View><Icon name={managing ? 'chevron-down' : 'chevron-forward'} size={14} color={COLORS.gold} /></View>
          </Pressable>
          {managing ? (
            <View style={styles.managePanel}>
              <TextInput
                value={note}
                onChangeText={setNote}
                maxLength={FEEDBACK_LIMITS.note}
                placeholder={tr('A note with the status (optional)', 'Une note avec l’état (facultatif)', 'ملاحظة مع الحالة (اختياري)')}
                placeholderTextColor={PLACEHOLDER}
                style={[styles.input, styles.noteInput, arabic && styles.inputArabic]}
              />
              <View style={styles.statuses}>
                {FEEDBACK_STATUSES.map((status) => (
                  <Pressable
                    key={status}
                    accessibilityRole="button"
                    accessibilityState={{ selected: status === item.status, disabled: busy }}
                    disabled={busy}
                    onPress={() => void setStatus(status)}
                    style={({ pressed }) => [styles.statusButton, { borderColor: STATUS_COLORS[status] }, status === item.status && { backgroundColor: 'rgba(255, 255, 255, 0.08)' }, pressed && styles.pressed]}
                  >
                    <Text style={[styles.statusText, { color: STATUS_COLORS[status] }, arabic && styles.arabicInline]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{statusLabel(status)}</Text>
                  </Pressable>
                ))}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={tr(`Delete #${item.number}`, `Supprimer le n° ${item.number}`, `احذف رقم ${item.number}`)}
                  disabled={busy}
                  onPress={() => confirmDelete(item.title, () => void act(async () => { await deleteBetaFeedback(item.id); onDeleted(item.id); }))}
                  style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
                >
                  <Icon name="trash-outline" size={16} color={ERROR} />
                </Pressable>
              </View>
              {error ? <Text style={[styles.errorText, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{error}</Text> : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 32, paddingHorizontal: 16 },
  column: { alignSelf: 'center', gap: 12, maxWidth: 640, width: '100%' },
  flex: { flex: 1 },
  intro: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 14.5, lineHeight: 21, marginBottom: 2 },
  formCard: { borderRadius: 22, gap: 14, overflow: 'hidden', padding: 16 },
  cardTitle: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 18, fontWeight: '700' },
  kinds: { flexDirection: 'row', gap: 8 },
  kind: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderColor: COLORS.goldLine,
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    gap: 6,
    justifyContent: 'center',
    minHeight: 64,
    paddingHorizontal: 6,
    paddingVertical: 10,
  },
  kindActive: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  kindText: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 12.5, fontWeight: '700', textAlign: 'center' },
  kindTextActive: { color: COLORS.greenDeep },
  field: { gap: 8 },
  fieldLabel: { color: COLORS.goldBright, fontFamily: TYPOGRAPHY.body, fontSize: 11.5, fontWeight: '700', letterSpacing: 1.2 },
  input: { backgroundColor: 'rgba(0, 0, 0, 0.38)', borderRadius: 14, color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 15.5, minHeight: 48, paddingHorizontal: 14, paddingVertical: 12 },
  multiline: { minHeight: 112 },
  inputArabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'right', writingDirection: 'rtl' },
  sentWith: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 12.5, lineHeight: 18 },
  sendButton: { alignItems: 'center', backgroundColor: COLORS.gold, borderRadius: 14, height: 46, justifyContent: 'center' },
  sendText: { color: COLORS.greenDeep, fontFamily: TYPOGRAPHY.body, fontSize: 15.5, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.7 },
  errorText: { color: ERROR, fontFamily: TYPOGRAPHY.body, fontSize: 13, lineHeight: 19 },
  noticeText: { color: COLORS.goldBright, fontFamily: TYPOGRAPHY.body, fontSize: 13.5, fontWeight: '600', lineHeight: 19 },
  listHead: { alignItems: 'center', flexDirection: 'row', marginTop: 12 },
  listTitle: { color: COLORS.white, flex: 1, fontFamily: TYPOGRAPHY.title, fontSize: 22, fontWeight: '700' },
  refresh: { alignItems: 'center', borderColor: COLORS.goldLine, borderRadius: 18, borderWidth: 1, height: 36, justifyContent: 'center', width: 36 },
  filters: { flexDirection: 'row', gap: 8 },
  filter: { borderColor: 'rgba(255, 255, 255, 0.14)', borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  filterActive: { backgroundColor: COLORS.goldSoft, borderColor: COLORS.gold },
  filterText: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13.5, fontWeight: '600' },
  filterTextActive: { color: COLORS.goldBright },
  loader: { marginVertical: 32 },
  empty: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 14.5, lineHeight: 21, paddingVertical: 24, textAlign: 'center' },
  card: { borderRadius: 20, gap: 8, overflow: 'hidden', padding: 16 },
  cardClosed: { opacity: 0.82 },
  cardHead: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  number: { color: COLORS.gold, fontFamily: TYPOGRAPHY.body, fontSize: 14, fontWeight: '800' },
  kindChip: { alignItems: 'center', backgroundColor: COLORS.goldSoft, borderRadius: 10, flexDirection: 'row', flexShrink: 1, gap: 4, paddingHorizontal: 8, paddingVertical: 3 },
  chipText: { color: COLORS.goldBright, flexShrink: 1, fontFamily: TYPOGRAPHY.body, fontSize: 11.5, fontWeight: '700' },
  mine: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 11.5, fontWeight: '700' },
  statusChip: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
  statusText: { fontFamily: TYPOGRAPHY.body, fontSize: 11.5, fontWeight: '800' },
  details: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 14.5, lineHeight: 21 },
  more: { color: COLORS.goldBright, fontFamily: TYPOGRAPHY.body, fontSize: 13, fontWeight: '700', marginTop: 4 },
  note: { borderLeftWidth: 3, paddingLeft: 10, paddingVertical: 2 },
  noteText: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 13.5, fontStyle: 'italic', lineHeight: 19 },
  meta: { color: 'rgba(205, 216, 203, 0.7)', fontFamily: TYPOGRAPHY.body, fontSize: 12, lineHeight: 17 },
  manage: { borderTopColor: 'rgba(255, 255, 255, 0.07)', borderTopWidth: 1, gap: 10, marginTop: 4, paddingTop: 10 },
  manageToggle: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 6 },
  manageText: { color: COLORS.goldBright, fontFamily: TYPOGRAPHY.body, fontSize: 13, fontWeight: '700' },
  managePanel: { gap: 10 },
  noteInput: { fontSize: 14, minHeight: 42, paddingVertical: 9 },
  statuses: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusButton: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  deleteButton: { alignItems: 'center', borderColor: 'rgba(255, 138, 138, 0.5)', borderRadius: 16, borderWidth: 1, height: 32, justifyContent: 'center', marginLeft: 'auto', width: 32 },
  arabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'left', writingDirection: 'rtl' },
  arabicInline: { fontFamily: TYPOGRAPHY.arabic },
  arabicCentered: { fontFamily: TYPOGRAPHY.arabic, writingDirection: 'rtl' },
  arabicKicker: { fontFamily: TYPOGRAPHY.arabic, fontSize: 13, letterSpacing: 0, textAlign: 'left', writingDirection: 'rtl' },
});
