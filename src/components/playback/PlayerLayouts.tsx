import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, ViewStyle } from 'react-native';

import { PlayerTitleBlock, type PlayerLayout } from '@/components/playback/PlayerParts';
import { PLAYER_VOLUME_HEIGHT } from '@/components/playback/PlayerVolume';
import { fitVideo } from '@/utils/lessonPlayback';

/**
 * The player's compositions (Coptic Vine Player design) with the design's
 * spacing, filled from the slots each player passes: its artwork, its words,
 * its seek bar, its transport and its row of round buttons. The Music and
 * the Learn & Study player differ only in what fills them.
 */
export interface PlayerSlots {
  /** The cover at the size the composition gives it. */
  artwork: (size: number) => ReactNode;
  title: string;
  subtitle: string;
  meta?: string | null;
  seek: (dense: boolean) => ReactNode;
  transport: (size: 'regular' | 'small', maxWidth: number, align: 'center' | 'left') => ReactNode;
  /** The round buttons along the foot, at the size given. */
  bar: (size: number) => ReactNode;
  /** The volume bar under the transport (PlayerVolume), where the volume can be set. */
  volume?: () => ReactNode;
  /** A lesson: a smaller cover (the speed chip and the ±10 need the room). */
  lesson?: boolean;
  /**
   * A lesson with a picture: in place of the square cover, a frame of the
   * video's shape (its video, or as sound alone its cover), sized here to
   * the room there is, with what goes above it (the Video | Audio switch).
   */
  media?: PlayerMedia;
}

export interface PlayerMedia {
  /** Width over height. */
  aspect: number;
  render: (width: number, height: number) => ReactNode;
  above?: ReactNode;
  /** The height of what goes above. */
  aboveHeight?: number;
}

/** The video's frame at its size, with what goes above it. */
function MediaBlock({ media, width, height, gap }: { media: PlayerMedia; width: number; height: number; gap: number }) {
  return (
    <View style={styles.media}>
      {media.above ? <View style={{ marginBottom: gap }}>{media.above}</View> : null}
      {media.render(width, height)}
    </View>
  );
}

function aboveRoom(media: PlayerMedia, gap: number): number {
  return media.above ? (media.aboveHeight ?? 0) + gap : 0;
}

// The phone's cover is 300 wide for a lesson where a song's is 322.
const LESSON_ART = 300 / 322;
const TITLE_LINE = 1.18;

function titleBlockHeight(titleSize: number): number {
  // Two lines of title, then the subtitle and the meta line under it.
  return titleSize * TITLE_LINE * 2 + 6 + 18 + 3 + 15;
}

/** The padding around everything, the backdrop running edge to edge beyond it. */
export function playerFrame({ kind, insets }: PlayerLayout): ViewStyle {
  switch (kind) {
    case 'phone':
      return { paddingTop: insets.top, paddingLeft: 24 + insets.left, paddingRight: 24 + insets.right };
    case 'tabletPortrait':
      return { paddingTop: 18 + insets.top, paddingLeft: 70 + insets.left, paddingRight: 70 + insets.right, paddingBottom: 34 + insets.bottom };
    case 'phoneLandscape': {
      // Clear of the notch on both sides, so the composition stays centred.
      const side = Math.max(insets.left, insets.right, 24);
      return { paddingTop: Math.max(insets.top, 6), paddingLeft: side, paddingRight: side, paddingBottom: Math.max(insets.bottom, 12) };
    }
    default:
      return { paddingTop: 18 + insets.top, paddingLeft: 40 + insets.left, paddingRight: 40 + insets.right, paddingBottom: 30 + insets.bottom };
  }
}

/** Where the queue sheet's top edge stops: 22pt under the "Playing from" bar. */
export function playerSheetTop({ kind, insets }: PlayerLayout): number {
  return (kind === 'tabletPortrait' ? 18 : 0) + insets.top + 52 + 22;
}

/** The cover with the design's deep drop shadow. */
export function PlayerArtworkFrame({ size, radius = 18, children }: { size: number; radius?: number; children: ReactNode }) {
  return <View style={[styles.artShadow, { width: size, height: size, borderRadius: radius }]}>{children}</View>;
}

/**
 * The phone's player, and the upright iPad's, scaled up: cover, words, seek
 * bar, transport and the round buttons down the screen, the room left over
 * shared evenly between them.
 */
export function PlayerStacked({ layout, slots }: { layout: PlayerLayout; slots: PlayerSlots }) {
  const { kind, width, height, insets } = layout;
  const tablet = kind === 'tabletPortrait';
  const frame = playerFrame(layout);
  const contentWidth = width - Number(frame.paddingLeft) - Number(frame.paddingRight);
  const titleSize = tablet ? 32 : 26;
  const minGap = tablet ? 16 : 12;
  const barHeight = tablet ? 44 + 10 : 12 + 44 + Math.max(28, insets.bottom);
  const seekHeight = slots.lesson ? 37 : 28;
  const volumeHeight = slots.volume ? PLAYER_VOLUME_HEIGHT + minGap : 0;
  const fixed = Number(frame.paddingTop) + Number(frame.paddingBottom ?? 0) + 52 + 18
    + titleBlockHeight(titleSize) + seekHeight + 74 + volumeHeight + barHeight + minGap * 4;
  const widest = Math.min(tablet ? 520 : contentWidth, contentWidth) * (slots.lesson ? LESSON_ART : 1);
  const art = Math.floor(Math.max(120, Math.min(widest, height - fixed)));
  const { media } = slots;
  // The video takes the width the cover would and, being wider than tall, less of the height.
  const box = media ? fitVideo(contentWidth, Math.max(90, height - fixed - aboveRoom(media, minGap)), media.aspect) : null;

  return (
    <View style={styles.stack}>
      {media && box
        ? <View style={styles.stackArt}><MediaBlock media={media} width={box.width} height={box.height} gap={minGap} /></View>
        : <View style={styles.stackArt}>{slots.artwork(art)}</View>}
      <View style={[styles.spring, { minHeight: minGap }]} />
      <PlayerTitleBlock title={slots.title} subtitle={slots.subtitle} meta={slots.meta} titleSize={titleSize} />
      <View style={[styles.spring, { minHeight: minGap }]} />
      <View style={styles.liftSeek}>{slots.seek(false)}</View>
      <View style={[styles.spring, { minHeight: minGap }]} />
      {/* A lesson's five controls keep their spacing and may reach 10pt into
          the margins, as drawn, before they close up. */}
      {slots.transport('regular', contentWidth + 20, 'center')}
      {slots.volume ? (
        <>
          <View style={[styles.spring, { minHeight: minGap }]} />
          {slots.volume()}
        </>
      ) : null}
      <View style={[styles.spring, { minHeight: minGap }]} />
      <View style={[styles.bar, tablet ? styles.barTablet : [styles.barPhone, { paddingBottom: Math.max(28, insets.bottom) }]]}>
        {slots.bar(44)}
      </View>
    </View>
  );
}

/** A phone on its side: the cover left, everything else beside it. */
export function PlayerLandscape({ layout, slots }: { layout: PlayerLayout; slots: PlayerSlots }) {
  const frame = playerFrame(layout);
  const main = layout.height - Number(frame.paddingTop) - Number(frame.paddingBottom) - 42;
  const across = layout.width - Number(frame.paddingLeft) - Number(frame.paddingRight);
  const art = Math.floor(Math.max(120, Math.min(236, main - 12, across * 0.36)));
  const { media } = slots;
  // A wide picture takes more of the width than the cover, the controls the rest.
  const box = media ? fitVideo(across * 0.56, Math.max(90, main - 12 - aboveRoom(media, 8)), media.aspect) : null;

  return (
    <View style={styles.landscape}>
      {media && box ? <MediaBlock media={media} width={box.width} height={box.height} gap={8} /> : slots.artwork(art)}
      <View style={styles.landscapeInfo}>
        <PlayerTitleBlock title={slots.title} subtitle={slots.subtitle} meta={slots.meta} titleSize={21} lines={1} align="left" />
        {/* The bar sits 10pt under the words; its touch band takes those 10pt. */}
        <View>{slots.seek(true)}</View>
        <View style={styles.landscapeRow}>{slots.transport('small', across - art - 30, 'left')}</View>
        {slots.volume ? <View style={styles.landscapeVolume}>{slots.volume()}</View> : null}
        <View style={[styles.bar, styles.barLandscape]}>{slots.bar(40)}</View>
      </View>
    </View>
  );
}

/** The columns beside the player: which panels show, how wide, and the player's own width. */
export interface PlayerColumns {
  gap: number;
  /** Fixed width of a lone panel, or null where the panels share the room. */
  panelWidth: number | null;
  playerWidth: number | null;
  /** The player's content width inside its column. */
  inner: number;
  artMax: number;
}

export function playerColumns(layout: PlayerLayout, panels: { lyrics: boolean; queue: boolean }, video = false): PlayerColumns {
  const frame = playerFrame(layout);
  const across = layout.width - Number(frame.paddingLeft) - Number(frame.paddingRight);
  const desktop = layout.kind === 'desktop';
  const shown = Number(panels.lyrics) + Number(panels.queue);
  if (shown === 2) {
    // Lyrics | player | queue: the player 400 wide, the panels sharing the rest.
    // A video takes what the panels can spare at 340 each, up to 720.
    const playerWidth = video ? Math.round(Math.max(400, Math.min(720, across - 2 * 340 - 80))) : 400;
    return { gap: 40, panelWidth: null, playerWidth, inner: playerWidth, artMax: 380 };
  }
  if (shown === 1) {
    const panelWidth = desktop ? 460 : 440;
    const gap = desktop ? 56 : 48;
    const column = across - panelWidth - gap;
    return { gap, panelWidth, playerWidth: null, inner: Math.min(video ? 760 : desktop ? 420 : 380, column), artMax: desktop ? 360 : 320 };
  }
  return { gap: 0, panelWidth: null, playerWidth: null, inner: Math.min(video ? 900 : 420, across), artMax: desktop ? 380 : 320 };
}

/** The player in its column beside the panels: cover, words, seek, transport, buttons. */
export function PlayerColumn({ layout, slots, columns }: { layout: PlayerLayout; slots: PlayerSlots; columns: PlayerColumns }) {
  const frame = playerFrame(layout);
  const tall = layout.height - Number(frame.paddingTop) - Number(frame.paddingBottom) - 52 - 16;
  const below = 20 + titleBlockHeight(25) + 22 + (slots.lesson ? 37 : 28) + 12 + 74
    + (slots.volume ? 14 + PLAYER_VOLUME_HEIGHT : 0) + 20 + 44;
  const art = Math.floor(Math.max(140, Math.min(columns.artMax, columns.inner, tall - below)));
  const { media } = slots;
  const box = media ? fitVideo(columns.inner, Math.max(120, tall - below - aboveRoom(media, 14)), media.aspect) : null;

  return (
    <View style={[styles.column, { width: columns.inner }]}>
      {media && box
        ? <View style={styles.columnArt}><MediaBlock media={media} width={box.width} height={box.height} gap={14} /></View>
        : <View style={styles.columnArt}>{slots.artwork(art)}</View>}
      <PlayerTitleBlock title={slots.title} subtitle={slots.subtitle} meta={slots.meta} titleSize={25} style={styles.columnTitle} />
      <View style={styles.columnSeek}>{slots.seek(false)}</View>
      <View style={styles.columnTransport}>{slots.transport('regular', columns.inner, 'center')}</View>
      {slots.volume ? <View style={styles.columnVolume}>{slots.volume()}</View> : null}
      <View style={[styles.bar, styles.barCentred]}>{slots.bar(44)}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  artShadow: {
    overflow: 'visible',
    ...Platform.select({
      web: { boxShadow: '0 24px 50px rgba(0, 0, 0, 0.55)' } as object,
      default: { shadowColor: '#000000', shadowOpacity: 0.55, shadowRadius: 25, shadowOffset: { width: 0, height: 24 }, elevation: 16 },
    }),
  },
  stack: { flex: 1, minHeight: 0 },
  media: { alignItems: 'center' },
  stackArt: { alignItems: 'center', marginTop: 18 },
  spring: { flex: 1 },
  // The seek bar's touch band reaches 10pt above the bar; drawn where the
  // design puts the bar itself.
  liftSeek: { marginTop: -10 },
  bar: { flexDirection: 'row', alignItems: 'center' },
  barPhone: { justifyContent: 'space-between', paddingTop: 12, paddingHorizontal: 2 },
  barTablet: { justifyContent: 'space-between', paddingHorizontal: 40, paddingBottom: 10 },
  barLandscape: { justifyContent: 'flex-start', gap: 14, marginTop: 8 },
  barCentred: { justifyContent: 'center', gap: 40, marginTop: 20 },
  landscape: { flex: 1, minHeight: 0, flexDirection: 'row', alignItems: 'center', gap: 30 },
  landscapeInfo: { flex: 1, minWidth: 0 },
  landscapeRow: { marginTop: 8 },
  landscapeVolume: { marginTop: 6 },
  column: { alignSelf: 'center' },
  columnArt: { alignItems: 'center' },
  columnTitle: { marginTop: 20 },
  columnSeek: { marginTop: 12 },
  columnTransport: { marginTop: 12 },
  columnVolume: { marginTop: 14 },
});
