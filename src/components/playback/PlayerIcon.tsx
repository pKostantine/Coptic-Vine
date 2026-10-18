import { StyleProp, ViewStyle } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import Icon, { type IconName } from '@/components/vine/ui/Icon';

/**
 * The glyphs the player draws that the app's shared icon set does not have
 * (Coptic Vine Player design): the lyrics page, the plain list, the outlined
 * shuffle, the ±10 arrow, the speedometer, the filled school cap, the
 * expand/collapse corners and the queue's six-dot grip. Anything else is
 * passed through to the shared set, so the player asks one component for
 * every icon.
 */
export type PlayerIconName =
  | IconName
  | 'reader-outline'
  | 'ellipsis-sharp'
  | 'list'
  | 'shuffle-outline'
  | 'repeat-outline'
  | 'speedometer-outline'
  | 'replay-arrow'
  | 'school'
  | 'lyrics-expand'
  | 'lyrics-collapse'
  | 'drag-dots'
  | 'videocam-outline';

interface PlayerIconProps {
  name: PlayerIconName;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

export default function PlayerIcon({ name, size = 24, color = '#FFFFFF', style }: PlayerIconProps) {
  switch (name) {
    case 'videocam-outline':
      // Ionicons' outlined camera: the lesson's picture, from the sound-only player.
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path d="M374.79 308.78L457.5 367a16 16 0 0022.5-14.62V159.62A16 16 0 00457.5 145l-82.71 58.22A16 16 0 00368 216.3v79.4a16 16 0 006.79 13.08z" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={32} />
          <Path d="M268 384H84a52.15 52.15 0 01-52-52V180a52.15 52.15 0 0152-52h184.48A51.68 51.68 0 01320 179.52V332a52.15 52.15 0 01-52 52z" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={32} />
        </Svg>
      );
    case 'reader-outline':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Rect x="96" y="48" width="320" height="416" rx="48" ry="48" fill="none" stroke={color} strokeLinejoin="round" strokeWidth={32} />
          <Path d="M176 128h160M176 208h160M176 288h80" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={32} />
        </Svg>
      );
    case 'ellipsis-sharp':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Circle cx="256" cy="256" r="48" fill={color} />
          <Circle cx="416" cy="256" r="48" fill={color} />
          <Circle cx="96" cy="256" r="48" fill={color} />
        </Svg>
      );
    case 'list':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path d="M160 144h288M160 256h288M160 368h288" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={48} />
          <Circle cx="80" cy="144" r="16" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={32} />
          <Circle cx="80" cy="256" r="16" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={32} />
          <Circle cx="80" cy="368" r="16" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={32} />
        </Svg>
      );
    case 'shuffle-outline':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path d="M400 304l48 48-48 48M400 112l48 48-48 48M64 352h85.19a80 80 0 0066.56-35.62L256 256" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={32} />
          <Path d="M64 160h85.19a80 80 0 0166.56 35.62l80.5 120.76A80 80 0 00362.81 352H416M416 160h-53.19a80 80 0 00-66.56 35.62L288 208" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={32} />
        </Svg>
      );
    case 'repeat-outline':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path d="M320 120l48 48-48 48" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={32} />
          <Path d="M352 168H144a80.24 80.24 0 00-80 80v16M192 392l-48-48 48-48" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={32} />
          <Path d="M160 344h208a80.24 80.24 0 0080-80v-16" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={32} />
        </Svg>
      );
    case 'speedometer-outline':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path d="M326.1 231.9l-47.5 75.5a31 31 0 01-7 7 30.11 30.11 0 01-35-49l75.5-47.5a10.23 10.23 0 0111.7 0 10.06 10.06 0 012.3 14z" fill={color} />
          <Path d="M256 64C132.3 64 32 164.2 32 287.9a223.18 223.18 0 0056.3 148.5c1.1 1.2 2.1 2.4 3.2 3.5a25.19 25.19 0 0037.1-.1 173.13 173.13 0 01254.8 0 25.19 25.19 0 0037.1.1l3.2-3.5A223.18 223.18 0 00480 287.9C480 164.2 379.7 64 256 64z" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={32} />
          <Path d="M256 128v32M416 288h-32M128 288H96M165.49 197.49l-22.63-22.63M346.51 197.49l22.63-22.63" fill="none" stroke={color} strokeLinecap="round" strokeMiterlimit={10} strokeWidth={32} />
        </Svg>
      );
    case 'replay-arrow':
      // Ionicons' "refresh": the forward-ten arrow as drawn, mirrored by the
      // caller for the step back.
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path d="M320 146s24.36-12-64-12a160 160 0 10160 160" fill="none" stroke={color} strokeLinecap="round" strokeMiterlimit={10} strokeWidth={32} />
          <Path d="M256 58l80 80-80 80" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={32} />
        </Svg>
      );
    case 'school':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path d="M256 368a16 16 0 01-7.94-2.11L108 285.84a8 8 0 00-12 6.94V368a16 16 0 008.23 14l144 80a16 16 0 0015.54 0l144-80a16 16 0 008.23-14v-75.22a8 8 0 00-12-6.94l-140.06 80.05A16 16 0 01256 368z" fill={color} />
          <Path d="M495.92 190.5v-.11a16 16 0 00-8-12.28l-224-128a16 16 0 00-15.88 0l-224 128a16 16 0 000 27.78l224 128a16 16 0 0015.88 0L461 221.28a2 2 0 013 1.74v144.53c0 8.61 6.62 16 15.23 16.43A16 16 0 00496 368V192a14.76 14.76 0 00-.08-1.5z" fill={color} />
        </Svg>
      );
    case 'lyrics-expand':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
          <Path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'lyrics-collapse':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
          <Path d="M20 4l-6 6M14 4.5V10h5.5M4 20l6-6M10 19.5V14H4.5" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'drag-dots':
      // Drawn at the design's 9×15 inside whatever box it is given.
      return (
        <Svg width={size * 0.6} height={size} viewBox="0 0 10 16" style={style}>
          <Circle cx="2.5" cy="2.5" r="1.5" fill={color} />
          <Circle cx="7.5" cy="2.5" r="1.5" fill={color} />
          <Circle cx="2.5" cy="8" r="1.5" fill={color} />
          <Circle cx="7.5" cy="8" r="1.5" fill={color} />
          <Circle cx="2.5" cy="13.5" r="1.5" fill={color} />
          <Circle cx="7.5" cy="13.5" r="1.5" fill={color} />
        </Svg>
      );
    default:
      return <Icon name={name} size={size} color={color} style={style} />;
  }
}
