import { Slider } from '@expo/ui';

export interface FontScaleSliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onValueChange: (value: number) => void;
  /** Whether a slide is under way: true as it starts, false as it ends. */
  onSlidingChange?: (sliding: boolean) => void;
}

/**
 * The text size slider itself (FontScaleControl.tsx), on Android: the
 * universal slider, which says nothing of when a slide starts or ends, so
 * the finger on it is all that holds its sheet. iOS gets
 * FontScaleSlider.ios.tsx, which says both.
 */
export default function FontScaleSlider({ value, min, max, step, onValueChange }: FontScaleSliderProps) {
  return <Slider value={value} min={min} max={max} step={step} onValueChange={onValueChange} />;
}
