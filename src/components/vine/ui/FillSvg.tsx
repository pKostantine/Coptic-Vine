import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg from 'react-native-svg';

/**
 * An Svg filling its parent, drawn at the parent's real size and drawn again
 * whenever that size changes. An Svg sized "100%" is laid out again when the
 * phone turns, but on the phone its drawing is not: a glow drawn upright
 * stayed upright-wide on its side, the rest of the page black. Measured and
 * keyed by its size, it is redrawn to fill the page whichever way up.
 */
export default function FillSvg({ children }: { children: ReactNode }) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(event) => {
        const width = Math.round(event.nativeEvent.layout.width);
        const height = Math.round(event.nativeEvent.layout.height);
        setSize((current) => (current?.width === width && current.height === height ? current : { width, height }));
      }}
    >
      {/* Until measured, "100%": right for the first drawing, which is all it is needed for. */}
      <Svg key={size ? `${size.width}x${size.height}` : 'fill'} width={size?.width ?? '100%'} height={size?.height ?? '100%'}>
        {children}
      </Svg>
    </View>
  );
}
