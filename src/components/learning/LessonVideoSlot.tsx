import { useFocusEffect } from 'expo-router';
import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from 'react';
import { InteractionManager, type StyleProp, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';

import { useVideoStage } from '@/context/VideoStageContext';
import { sameSurfaceRect, type SurfaceRect } from '@/utils/lessonPlayback';

/**
 * The place on a lesson page where its video goes. The page draws the slot
 * (and whatever shows beneath the picture: the cover, a Play button); the one
 * video surface (LessonVideoStage) is laid over it while this page shows the
 * lesson that is playing. The slot measures itself in window coordinates and
 * claims the surface for its lesson while the page is focused.
 */
export default function LessonVideoSlot({
  itemId,
  aspectRatio = 16 / 9,
  style,
  children,
}: {
  /** The lesson this page shows. */
  itemId: string;
  aspectRatio?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const id = useId();
  const ref = useRef<View>(null);
  const { claimHero, releaseHero } = useVideoStage();
  const [focused, setFocused] = useState(false);
  const rectRef = useRef<SurfaceRect | null>(null);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const measure = useCallback(() => {
    const view = ref.current;
    if (!view || typeof view.measureInWindow !== 'function') return;
    view.measureInWindow((x, y, width, height) => {
      if (!(width > 0) || !(height > 0)) return;
      const rect: SurfaceRect = { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
      if (sameSurfaceRect(rectRef.current, rect)) return;
      rectRef.current = rect;
      claimHero(id, itemId, rect);
    });
  }, [claimHero, id, itemId]);

  // Claimed while the page is the one showing, and only once its arrival has
  // settled: measured mid-slide, the slot would be reported where it was
  // passing, not where it stops.
  useFocusEffect(useCallback(() => {
    setFocused(true);
    rectRef.current = null;
    claimHero(id, itemId, null);
    const interaction = InteractionManager.runAfterInteractions(() => measure());
    const settle = setTimeout(measure, 420);
    return () => {
      interaction.cancel();
      clearTimeout(settle);
      setFocused(false);
      rectRef.current = null;
      releaseHero(id);
    };
  }, [claimHero, id, itemId, measure, releaseHero]));

  // A turn of the device, a resized window: measured again once laid out.
  useEffect(() => {
    if (!focused) return;
    const timer = setTimeout(measure, 60);
    return () => clearTimeout(timer);
  }, [focused, measure, windowHeight, windowWidth]);

  return (
    <View
      ref={ref}
      collapsable={false}
      onLayout={focused ? measure : undefined}
      style={[styles.slot, { aspectRatio }, style]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { width: '100%', overflow: 'hidden' },
});
