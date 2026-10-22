import { Slider } from '@expo/ui/swift-ui';

import type { FontScaleSliderProps } from './FontScaleSlider';

/**
 * The text size slider on iOS: SwiftUI's own, which the universal slider
 * wraps without passing on when a slide starts and ends. Its sheet is held
 * for the whole slide, even past the moment React Native's touch on it ends.
 */
export default function FontScaleSlider({ value, min, max, step, onValueChange, onSlidingChange }: FontScaleSliderProps) {
  return <Slider value={value} min={min} max={max} step={step} onValueChange={onValueChange} onEditingChanged={onSlidingChange} />;
}
