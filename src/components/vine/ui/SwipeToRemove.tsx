import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, PanResponder, Platform, Pressable, StyleSheet, Text, View, type PanResponderGestureState, type StyleProp, type ViewStyle } from 'react-native';

import { TYPOGRAPHY } from '../../../constants/theme';
import { motionDuration, useReducedMotion } from '../../../utils/useReducedMotion';
import Icon from './Icon';

const NATIVE_DRIVER = Platform.OS !== 'web';
/** How far a row stays open to show its Remove button. */
const ACTION_WIDTH = 96;
const DESTRUCTIVE = '#FF8A7A';

interface SwipeToRemoveProps {
  /** The Remove button's name, and what it says. */
  label: string;
  onRemove: () => void;
  style?: StyleProp<ViewStyle>;
  /**
   * The row, given `guard` to wrap its press in: a press that ends a drag
   * (the web's click after a mouse drag), or lands on an open row, only
   * closes the row.
   */
  children: (guard: (press: () => void) => () => void) => ReactNode;
}

/**
 * A row swiped left to remove it (Coptic Vine design, "Bookmarks"): a short
 * swipe opens it on its Remove button, one past half its width removes it at
 * once. A mouse drags it the same way on the web. A tap on an open row
 * closes it. The row underneath gives screen readers its own way to
 * remove it (an accessibility action), as a swipe isn't one of theirs.
 */
export default function SwipeToRemove({ label, onRemove, style, children }: SwipeToRemoveProps) {
  const reduced = useReducedMotion();
  const [offset] = useState(() => new Animated.Value(0));
  const lane = useRef({ width: 0, rest: 0, dragFrom: 0, draggedAt: 0 });
  // The gesture below is made once: it reads the latest of these when it ends.
  const latest = useRef({ onRemove, reduced });
  useLayoutEffect(() => {
    latest.current = { onRemove, reduced };
  });

  const settle = (toValue: number, then?: () => void) => {
    lane.current.rest = toValue;
    Animated.timing(offset, { toValue, duration: motionDuration(180, latest.current.reduced), easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE_DRIVER }).start(({ finished }) => {
      if (finished) then?.();
    });
  };
  const remove = () => settle(-(lane.current.width || 320), () => latest.current.onRemove());

  // eslint-disable-next-line react-hooks/refs -- refs are read in gesture callbacks, not during render
  const [swipe] = useState(() => {
    const sideways = (gesture: PanResponderGestureState) => Math.abs(gesture.dx) > 10 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5;
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => sideways(gesture),
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        offset.stopAnimation();
        lane.current.dragFrom = lane.current.rest;
        lane.current.draggedAt = Date.now();
      },
      onPanResponderMove: (_, gesture) => {
        offset.setValue(Math.min(0, lane.current.dragFrom + gesture.dx));
      },
      onPanResponderRelease: (_, gesture) => {
        lane.current.draggedAt = Date.now();
        const width = lane.current.width || 320;
        const at = Math.min(0, lane.current.dragFrom + gesture.dx);
        if (at < -width / 2 || gesture.vx < -1.2) remove();
        else if (at < -ACTION_WIDTH / 2 && gesture.vx < 0.4) settle(-ACTION_WIDTH);
        else settle(0);
      },
      onPanResponderTerminate: () => settle(lane.current.rest),
    });
  });

  const guard = (press: () => void) => () => {
    if (Date.now() - lane.current.draggedAt < 400) return;
    if (lane.current.rest < 0) settle(0);
    else press();
  };

  // The button slides in from the right edge as the row slides away from it.
  const actionShift = offset.interpolate({ inputRange: [-ACTION_WIDTH, 0], outputRange: [0, ACTION_WIDTH], extrapolate: 'clamp' });

  return (
    <View style={[styles.frame, style]} onLayout={(event) => { lane.current.width = event.nativeEvent.layout.width; }}>
      <Animated.View style={[styles.action, { transform: [{ translateX: actionShift }] }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={remove} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <Icon name="trash-outline" size={19} color={DESTRUCTIVE} />
          <Text style={styles.buttonText} numberOfLines={1}>{label}</Text>
        </Pressable>
      </Animated.View>
      <Animated.View {...swipe.panHandlers} style={{ transform: [{ translateX: offset }] }}>
        {children(guard)}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  action: { bottom: 0, justifyContent: 'center', position: 'absolute', right: 0, top: 0, width: ACTION_WIDTH },
  button: { alignItems: 'center', backgroundColor: 'rgba(255, 138, 122, 0.12)', borderRadius: 14, gap: 3, justifyContent: 'center', marginBottom: 6, marginLeft: 8, marginRight: 12, marginTop: 6, flex: 1 },
  buttonText: { color: DESTRUCTIVE, fontFamily: TYPOGRAPHY.body, fontSize: 12, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});
