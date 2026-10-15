import { StyleProp, ViewStyle } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconName =
  | 'search'
  | 'close-circle'
  | 'disc-outline'
  | 'people-outline'
  | 'arrow-down-circle-outline'
  | 'add-circle-outline'
  | 'checkmark-done'
  | 'chevron-back'
  | 'chevron-forward'
  | 'chevron-down'
  | 'home-outline'
  | 'bookmark'
  | 'bookmark-outline'
  | 'calendar-outline'
  | 'settings-outline'
  | 'person-circle-outline'
  | 'time-outline'
  | 'add'
  | 'remove'
  | 'book'
  | 'library-outline'
  | 'school-outline'
  | 'list-outline'
  | 'document-text-outline'
  | 'playlist-add'
  | 'ellipsis-horizontal'
  | 'ellipsis-vertical'
  | 'download-outline'
  | 'trash-outline'
  | 'sunny'
  | 'sunrise'
  | 'sunset'
  | 'moon'
  | 'close-fullscreen'
  | 'open-in-full'
  | 'search-outline'
  | 'eye-outline'
  | 'checkmark'
  | 'play'
  | 'pause'
  | 'play-skip-forward'
  | 'play-skip-back'
  | 'reorder'
  | 'close'
  | 'shuffle'
  | 'repeat'
  | 'heart'
  | 'heart-outline'
  | 'share-outline'
  | 'musical-notes'
  | 'musical-notes-outline'
  | 'cloudy-night-outline'
  | 'moon-outline'
  | 'sunny-outline'
  | 'create-outline'
  | 'checkmark-circle'
  | 'arrow-down'
  | 'refresh'
  | 'cloud-download-outline'
  | 'shield-checkmark-outline'
  | 'construct-outline'
  | 'book-outline'
  | 'camera-outline'
  | 'cloud-done-outline'
  | 'mail-outline'
  | 'key-outline'
  | 'log-out-outline';

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Coptic Vine's local icon set — every glyph the app uses, vendored as inline SVG
 * path data (sourced from the Ionicons and Material Symbols projects) and
 * rendered via react-native-svg. Deliberately not @expo/vector-icons: no
 * icon-font package or glyph lookup at runtime, just local vector data
 * bundled directly into the app, the same way the category PNGs are.
 */
export default function Icon({ name, size = 24, color = '#FFFFFF', style }: IconProps) {
  switch (name) {
    case 'chevron-back':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path d="M328 112 184 256l144 144" fill="none" stroke={color} strokeWidth={48} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'chevron-forward':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path d="m184 112 144 144-144 144" fill="none" stroke={color} strokeWidth={48} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'eye-outline':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path
            d="M255.66 112c-77.94 0-157.89 45.11-220.83 135.33a16 16 0 0 0-.27 17.77C82.92 340.8 161.8 400 255.66 400c92.84 0 173.34-59.38 221.79-135.25a16.14 16.14 0 0 0 0-17.47C429.18 172.28 348.68 112 255.66 112Z"
            fill="none"
            stroke={color}
            strokeWidth={32}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle cx="256" cy="256" r="80" fill="none" stroke={color} strokeWidth={32} strokeMiterlimit={10} />
        </Svg>
      );
    case 'search-outline':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path d="M221 400a179 179 0 1 0 0-358 179 179 0 0 0 0 358Z" fill="none" stroke={color} strokeWidth={32} strokeMiterlimit={10} />
          <Path d="M338 338 471 471" fill="none" stroke={color} strokeWidth={32} strokeLinecap="round" strokeMiterlimit={10} />
        </Svg>
      );
    case 'checkmark':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path d="M416 128 176 384l-80-80" fill="none" stroke={color} strokeWidth={44} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'chevron-down':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path d="m112 184 144 144 144-144" fill="none" stroke={color} strokeWidth={48} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'home-outline':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path d="M80 232 256 88l176 144v200a32 32 0 0 1-32 32H112a32 32 0 0 1-32-32Z" fill="none" stroke={color} strokeWidth={32} strokeLinejoin="round" />
          <Path d="M208 464V320h96v144" fill="none" stroke={color} strokeWidth={32} strokeLinejoin="round" />
        </Svg>
      );
    case 'bookmark-outline':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path
            d="M352 48H160a48 48 0 0 0-48 48v368l144-128 144 128V96a48 48 0 0 0-48-48"
            fill="none"
            stroke={color}
            strokeWidth={32}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'bookmark':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path
            d="M400 480a16 16 0 0 1-10.63-4L256 357.41 122.63 476A16 16 0 0 1 96 464V96a64.07 64.07 0 0 1 64-64h192a64.07 64.07 0 0 1 64 64v368a16 16 0 0 1-16 16"
            fill={color}
          />
        </Svg>
      );
    case 'calendar-outline':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Rect x={48} y={80} width={416} height={384} rx={48} fill="none" stroke={color} strokeWidth={32} strokeLinejoin="round" />
          <Circle cx={296} cy={232} r={24} fill={color} />
          <Circle cx={376} cy={232} r={24} fill={color} />
          <Circle cx={296} cy={312} r={24} fill={color} />
          <Circle cx={376} cy={312} r={24} fill={color} />
          <Circle cx={136} cy={312} r={24} fill={color} />
          <Circle cx={216} cy={312} r={24} fill={color} />
          <Circle cx={136} cy={392} r={24} fill={color} />
          <Circle cx={216} cy={392} r={24} fill={color} />
          <Circle cx={296} cy={392} r={24} fill={color} />
          <Path d="M128 48v32M384 48v32" fill="none" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M464 160H48" fill="none" stroke={color} strokeWidth={32} strokeLinejoin="round" />
        </Svg>
      );
    case 'settings-outline':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path
            d="M262.29 192.31a64 64 0 1 0 57.4 57.4 64.13 64.13 0 0 0-57.4-57.4M416.39 256a154 154 0 0 1-1.53 20.79l45.21 35.46a10.81 10.81 0 0 1 2.45 13.75l-42.77 74a10.81 10.81 0 0 1-13.14 4.59l-44.9-18.08a16.11 16.11 0 0 0-15.17 1.75A164.5 164.5 0 0 1 325 400.8a15.94 15.94 0 0 0-8.82 12.14l-6.73 47.89a11.08 11.08 0 0 1-10.68 9.17h-85.54a11.11 11.11 0 0 1-10.69-8.87l-6.72-47.82a16.07 16.07 0 0 0-9-12.22 155 155 0 0 1-21.46-12.57 16 16 0 0 0-15.11-1.71l-44.89 18.07a10.81 10.81 0 0 1-13.14-4.58l-42.77-74a10.8 10.8 0 0 1 2.45-13.75l38.21-30a16.05 16.05 0 0 0 6-14.08c-.36-4.17-.58-8.33-.58-12.5s.21-8.27.58-12.35a16 16 0 0 0-6.07-13.94l-38.19-30A10.81 10.81 0 0 1 49.48 186l42.77-74a10.81 10.81 0 0 1 13.14-4.59l44.9 18.08a16.11 16.11 0 0 0 15.17-1.75A164.5 164.5 0 0 1 187 111.2a15.94 15.94 0 0 0 8.82-12.14l6.73-47.89A11.08 11.08 0 0 1 213.23 42h85.54a11.11 11.11 0 0 1 10.69 8.87l6.72 47.82a16.07 16.07 0 0 0 9 12.22 155 155 0 0 1 21.46 12.57 16 16 0 0 0 15.11 1.71l44.89-18.07a10.81 10.81 0 0 1 13.14 4.58l42.77 74a10.8 10.8 0 0 1-2.45 13.75l-38.21 30a16.05 16.05 0 0 0-6.05 14.08c.33 4.14.55 8.3.55 12.47"
            fill="none"
            stroke={color}
            strokeWidth={32}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'person-circle-outline':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Circle cx="256" cy="256" r="208" fill="none" stroke={color} strokeWidth={32} strokeLinejoin="round" />
          <Circle cx="256" cy="176" r="72" fill="none" stroke={color} strokeWidth={32} strokeLinejoin="round" />
          <Path d="M112 420c18-76 72-116 144-116s126 40 144 116" fill="none" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'time-outline':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path
            d="M256 64C150 64 64 150 64 256s86 192 192 192 192-86 192-192S362 64 256 64Z"
            fill="none"
            stroke={color}
            strokeWidth={32}
            strokeMiterlimit={10}
          />
          <Path d="M256 128v144h96" fill="none" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'add':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path d="M256 112v288M400 256H112" fill="none" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'remove':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path d="M400 256H112" fill="none" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'book':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path
            d="M256 112c-39.21-31.36-86.4-48-136-48H80a32 32 0 0 0-32 32v272a32 32 0 0 0 32 32h40c49.6 0 96.79 16.64 136 48 39.21-31.36 86.4-48 136-48h40a32 32 0 0 0 32-32V96a32 32 0 0 0-32-32h-40c-49.6 0-96.79 16.64-136 48Z"
            fill={color}
          />
          <Path d="M256 112v336" fill="none" stroke="#0B1C10" strokeWidth={28} strokeLinecap="round" />
        </Svg>
      );
    case 'library-outline':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Rect x={32} y={96} width={64} height={368} rx={16} ry={16} fill="none" stroke={color} strokeWidth={32} strokeLinejoin="round" />
          <Path d="M112 224h128M112 400h128" fill="none" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round" />
          <Rect x={112} y={160} width={128} height={304} rx={16} ry={16} fill="none" stroke={color} strokeWidth={32} strokeLinejoin="round" />
          <Rect x={256} y={48} width={96} height={416} rx={16} ry={16} fill="none" stroke={color} strokeWidth={32} strokeLinejoin="round" />
          <Path
            d="m422.46 96.11-40.4 4.25c-11.12 1.17-19.18 11.57-17.93 23.1l34.92 321.59c1.26 11.53 11.37 20 22.49 18.84l40.4-4.25c11.12-1.17 19.18-11.57 17.93-23.1L445 115c-1.31-11.58-11.42-20.06-22.54-18.89Z"
            fill="none"
            stroke={color}
            strokeWidth={32}
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'school-outline':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path
            d="M32 176 256 64l224 112-224 112L32 176Z"
            fill="none"
            stroke={color}
            strokeWidth={30}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M112 224v112c0 42 65 80 144 80s144-38 144-80V224M480 176v144"
            fill="none"
            stroke={color}
            strokeWidth={30}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'list-outline':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path d="M160 144h288M160 256h288M160 368h288" fill="none" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx={80} cy={144} r={16} fill="none" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx={80} cy={256} r={16} fill="none" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx={80} cy={368} r={16} fill="none" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'playlist-add':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path d="M64 144h240M64 256h240M64 368h176" fill="none" stroke={color} strokeWidth={32} strokeLinecap="round" />
          <Path d="M384 272v160M304 352h160" fill="none" stroke={color} strokeWidth={34} strokeLinecap="round" />
        </Svg>
      );
    case 'ellipsis-horizontal':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Circle cx={112} cy={256} r={34} fill={color} />
          <Circle cx={256} cy={256} r={34} fill={color} />
          <Circle cx={400} cy={256} r={34} fill={color} />
        </Svg>
      );
    case 'document-text-outline':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path d="M160 48h176l96 96v288a32 32 0 0 1-32 32H160a32 32 0 0 1-32-32V80a32 32 0 0 1 32-32Z" fill="none" stroke={color} strokeWidth={30} strokeLinejoin="round" />
          <Path d="M336 48v96h96M192 240h160M192 304h160M192 368h112" fill="none" stroke={color} strokeWidth={28} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'ellipsis-vertical':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Circle cx={256} cy={112} r={34} fill={color} />
          <Circle cx={256} cy={256} r={34} fill={color} />
          <Circle cx={256} cy={400} r={34} fill={color} />
        </Svg>
      );
    case 'download-outline':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path d="M256 48v272M144 224l112 112 112-112M80 400v48h352v-48" fill="none" stroke={color} strokeWidth={34} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'checkmark-circle':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path d="M256 48C141.31 48 48 141.31 48 256s93.31 208 208 208 208-93.31 208-208S370.69 48 256 48zm108.25 138.29-134.4 160a16 16 0 0 1-12 5.71h-.27a16 16 0 0 1-11.89-5.3l-57.6-64a16 16 0 1 1 23.78-21.4l45.29 50.32 122.59-145.91a16 16 0 0 1 24.5 20.58z" fill={color} />
        </Svg>
      );
    case 'arrow-down':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path d="m112 268 144 144 144-144M256 392V100" fill="none" stroke={color} strokeWidth={48} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'refresh':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path d="M320 146s24.36-12-64-12a160 160 0 1 0 160 160" fill="none" stroke={color} strokeWidth={32} strokeLinecap="round" strokeMiterlimit={10} />
          <Path d="m256 58 80 80-80 80" fill="none" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'cloud-download-outline':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path d="M320 336h76c55 0 100-21.21 100-75.6s-53-73.47-96-75.6C391.11 99.74 329 48 256 48c-69 0-113.44 45.79-128 91.2-60 5.7-112 35.88-112 98.4S70 336 136 336h56M192 400.1l64 63.9 64-63.9M256 224v224.03" fill="none" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'shield-checkmark-outline':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path d="M336 176 225.2 304 176 255.8" fill="none" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M463.1 112.37C373.68 96.33 336.71 84.45 256 48c-80.71 36.45-117.68 48.33-207.1 64.37C32.7 369.13 240.58 457.79 256 464c15.42-6.21 223.3-94.87 207.1-351.63z" fill="none" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'construct-outline':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path d="M436.67 184.11a27.17 27.17 0 0 1-38.3 0l-22.48-22.49a27.15 27.15 0 0 1 0-38.29l50.89-50.89a.85.85 0 0 0-.26-1.38C393.68 57 351.09 64.15 324.05 91c-25.88 25.69-27.35 64.27-17.87 98a27 27 0 0 1-7.67 27.14l-173 160.76a40.76 40.76 0 1 0 57.57 57.54l162.15-173.3a27 27 0 0 1 26.77-7.7c33.46 8.94 71.49 7.26 97.07-17.94 27.49-27.08 33.42-74.94 20.1-102.33a.85.85 0 0 0-1.36-.22z" fill="none" stroke={color} strokeWidth={32} strokeLinecap="round" strokeMiterlimit={10} />
          <Path d="M224 284c-17.48-17-25.49-24.91-31-30.29a18.24 18.24 0 0 1-3.33-21.35 20.76 20.76 0 0 1 3.5-4.62l15.68-15.29a18.66 18.66 0 0 1 5.63-3.87 18.11 18.11 0 0 1 20 3.62c5.45 5.29 15.43 15 33.41 32.52M317.07 291.3c40.95 38.1 90.62 83.27 110 99.41a13.46 13.46 0 0 1 .94 19.92L394.63 444a14 14 0 0 1-20.29-.76c-16.53-19.18-61.09-67.11-99.27-107" fill="none" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="m17.34 193.5 29.41-28.74a4.71 4.71 0 0 1 3.41-1.35 4.85 4.85 0 0 1 3.41 1.35 9.86 9.86 0 0 0 8.19 2.77c3.83-.42 7.92-1.6 10.57-4.12 6-5.8-.94-17.23 4.34-24.54a207 207 0 0 1 19.78-22.6c6-5.88 29.84-28.32 69.9-44.45A107.31 107.31 0 0 1 206.67 64c22.59 0 40 10 46.26 15.67a89.54 89.54 0 0 1 10.28 11.64 78.92 78.92 0 0 0-9.21-2.77 68.82 68.82 0 0 0-20-1.26c-13.33 1.09-29.41 7.26-38 14-13.9 11-19.87 25.72-20.81 44.71-.68 14.12 2.72 22.1 36.1 55.49a6.6 6.6 0 0 1-.34 9.16l-18.22 18a6.88 6.88 0 0 1-9.54.09c-21.94-21.94-36.65-33.09-45-38.16s-15.07-6.5-18.3-6.85a30.85 30.85 0 0 0-18.27 3.87 11.39 11.39 0 0 0-2.64 2 14.14 14.14 0 0 0 .42 20.08l1.71 1.6a4.63 4.63 0 0 1 0 6.64L71.73 246.6a4.71 4.71 0 0 1-3.41 1.4 4.86 4.86 0 0 1-3.41-1.35l-47.57-46.43a4.88 4.88 0 0 1 0-6.72z" fill="none" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'trash-outline':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path d="M112 112h288M208 112V72h96v40M144 112l24 336h176l24-336M224 192v176M288 192v176" fill="none" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'sunny':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path
            d="M256 118a22 22 0 0 1-22-22V48a22 22 0 0 1 44 0v48a22 22 0 0 1-22 22M256 486a22 22 0 0 1-22-22v-48a22 22 0 0 1 44 0v48a22 22 0 0 1-22 22M369.14 164.86a22 22 0 0 1-15.56-37.55l33.94-33.94a22 22 0 0 1 31.11 31.11l-33.94 33.94a21.93 21.93 0 0 1-15.55 6.44M108.92 425.08a22 22 0 0 1-15.55-37.56l33.94-33.94a22 22 0 1 1 31.11 31.11l-33.94 33.94a21.94 21.94 0 0 1-15.56 6.45M464 278h-48a22 22 0 0 1 0-44h48a22 22 0 0 1 0 44M96 278H48a22 22 0 0 1 0-44h48a22 22 0 0 1 0 44M403.08 425.08a21.94 21.94 0 0 1-15.56-6.45l-33.94-33.94a22 22 0 0 1 31.11-31.11l33.94 33.94a22 22 0 0 1-15.55 37.56M142.86 164.86a21.9 21.9 0 0 1-15.55-6.44l-33.94-33.94a22 22 0 0 1 31.11-31.11l33.94 33.94a22 22 0 0 1-15.56 37.55M256 358a102 102 0 1 1 102-102 102.12 102.12 0 0 1-102 102"
            fill={color}
          />
        </Svg>
      );
    case 'sunrise':
    case 'sunset':
      // A sun half over the horizon, the arrow above it rising or setting.
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
          <Path
            d={`M2.5 19h19M6.5 19a5.5 5.5 0 0 1 11 0M3.8 12.8l1.5 1.5M20.2 12.8l-1.5 1.5M12 2.8v6${name === 'sunrise' ? 'M9.2 5.4 12 2.6l2.8 2.8' : 'M9.2 6.4 12 9.2l2.8-2.8'}`}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'moon':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path
            d="M264 480A232 232 0 0 1 32 248c0-94 54-178.28 137.61-214.67a16 16 0 0 1 21.06 21.06C181.07 76.43 176 104.66 176 136c0 110.28 89.72 200 200 200 31.34 0 59.57-5.07 81.61-14.67a16 16 0 0 1 21.06 21.06C442.28 426 358 480 264 480"
            fill={color}
          />
        </Svg>
      );
    case 'close-fullscreen':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
          <Path
            d="M22 3.41L16.71 8.7L20 12h-8V4l3.29 3.29L20.59 2L22 3.41zM3.41 22l5.29-5.29L12 20v-8H4l3.29 3.29L2 20.59L3.41 22z"
            fill={color}
          />
        </Svg>
      );
    case 'open-in-full':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
          <Path d="M21 11V3h-8l3.29 3.29l-10 10L3 13v8h8l-3.29-3.29l10-10z" fill={color} />
        </Svg>
      );
    case 'play':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path
            d="M133 440a35.37 35.37 0 0 1-17.5-4.67c-12-6.8-19.46-20-19.46-34.33V111c0-14.37 7.46-27.53 19.46-34.33a35.13 35.13 0 0 1 35.77.45l247.85 148.36a36 36 0 0 1 0 61l-247.89 148.4A35.5 35.5 0 0 1 133 440z"
            fill={color}
          />
        </Svg>
      );
    case 'pause':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Rect x={136} y={80} width={80} height={352} rx={22} fill={color} />
          <Rect x={296} y={80} width={80} height={352} rx={22} fill={color} />
        </Svg>
      );
    case 'play-skip-forward':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path
            d="M96 111v290c0 17.44 17 28.52 31 20.16l247.9-148.37c12.12-7.25 12.12-26.33 0-33.58L127 90.84c-14-8.36-31 2.72-31 20.16z"
            fill={color}
          />
          <Rect x={376} y={80} width={48} height={352} rx={24} fill={color} />
        </Svg>
      );
    case 'play-skip-back':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path
            d="M416 111v290c0 17.44-17 28.52-31 20.16L137.1 272.79c-12.12-7.25-12.12-26.33 0-33.58L385 90.84c14-8.36 31 2.72 31 20.16z"
            fill={color}
          />
          <Rect x={88} y={80} width={48} height={352} rx={24} fill={color} />
        </Svg>
      );
    case 'reorder':
      // Six-dot grip, the conventional "drag me" affordance.
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
          <Circle cx={9} cy={6} r={1.6} fill={color} />
          <Circle cx={15} cy={6} r={1.6} fill={color} />
          <Circle cx={9} cy={12} r={1.6} fill={color} />
          <Circle cx={15} cy={12} r={1.6} fill={color} />
          <Circle cx={9} cy={18} r={1.6} fill={color} />
          <Circle cx={15} cy={18} r={1.6} fill={color} />
        </Svg>
      );
    case 'close':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path d="M368 368 144 144M368 144 144 368" fill="none" stroke={color} strokeWidth={40} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'musical-notes':
      // Beamed pair of quavers: the Music tab's mark.
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
          <Path d="M8.9 4.6 20.5 2.6v3L8.9 7.6z" fill={color} />
          <Rect x={8.9} y={4.6} width={1.7} height={13} fill={color} />
          <Rect x={18.8} y={2.6} width={1.7} height={13} fill={color} />
          <Circle cx={6.6} cy={17.6} r={3.3} fill={color} />
          <Circle cx={16.5} cy={15.6} r={3.3} fill={color} />
        </Svg>
      );
    case 'musical-notes-outline':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path d="M192 218v-6c0-14.84 10-27 24.24-30.59l174.59-46.68A20 20 0 0 1 416 154v22" fill="none" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round" />
          <Path
            d="M416 295.94v80c0 13.91-8.93 25.59-22 30l-22 8c-25.9 8.72-52-10.42-52-38a33.37 33.37 0 0 1 23-32l51-18.15c13.07-4.4 22-15.94 22-29.85V58a10 10 0 0 0-12.6-9.61L204 102a16.48 16.48 0 0 0-12 16v226c0 13.91-8.93 25.6-22 30l-52 18c-13.88 4.68-22 17.22-22 32 0 27.58 26.52 46.55 52 38l22-8c13.07-4.4 22-16.08 22-30v-80"
            fill="none"
            stroke={color}
            strokeWidth={32}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'cloudy-night-outline':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path
            d="M388.31 272c47.75 0 89.77-27.77 107.69-68.92-14.21 6.18-30.9 8.61-47.38 8.61A116.31 116.31 0 0 1 332.31 95.38c0-16.48 2.43-33.17 8.61-47.38C299.77 65.92 272 107.94 272 155.69a116.31 116.31 0 0 0 3.44 28.18"
            fill="none"
            stroke={color}
            strokeWidth={32}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M90.61 306.85A16.07 16.07 0 0 0 104 293.6C116.09 220.17 169.63 176 232 176c57.93 0 96.62 37.75 112.2 77.74a15.84 15.84 0 0 0 12.2 9.87c50 8.15 91.6 41.54 91.6 99.59 0 59.4-48.6 100.8-108 100.8H106c-49.5 0-90-24.7-90-79.2 0-48.47 38.67-72.22 74.61-77.95z"
            fill="none"
            stroke={color}
            strokeWidth={32}
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'moon-outline':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path
            d="M160 136c0-30.62 4.51-61.61 16-88C99.57 81.27 48 159.32 48 248c0 119.29 96.71 216 216 216 88.68 0 166.73-51.57 200-128-26.39 11.49-57.38 16-88 16-119.29 0-216-96.71-216-216z"
            fill="none"
            stroke={color}
            strokeWidth={32}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'sunny-outline':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path
            d="M256 48v48M256 416v48M403.08 108.92l-33.94 33.94M142.86 369.14l-33.94 33.94M464 256h-48M96 256H48M403.08 403.08l-33.94-33.94M142.86 142.86l-33.94-33.94"
            fill="none"
            stroke={color}
            strokeWidth={32}
            strokeLinecap="round"
            strokeMiterlimit={10}
          />
          <Circle cx="256" cy="256" r="80" fill="none" stroke={color} strokeWidth={32} strokeLinecap="round" strokeMiterlimit={10} />
        </Svg>
      );
    case 'create-outline':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path d="M384 224v184a40 40 0 0 1-40 40H104a40 40 0 0 1-40-40V168a40 40 0 0 1 40-40h167.48" fill="none" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round" />
          <Path
            d="M459.94 53.25a16.06 16.06 0 0 0-23.22-.56L424.35 65a8 8 0 0 0 0 11.31l11.34 11.32a8 8 0 0 0 11.34 0l12.06-12c6.1-6.09 6.67-16.01.85-22.38zM399.34 90 218.82 270.2a9 9 0 0 0-2.31 3.93L208.16 299a3.91 3.91 0 0 0 4.86 4.86l24.85-8.35a9 9 0 0 0 3.93-2.31L422 112.66a9 9 0 0 0 0-12.66l-9.95-10a9 9 0 0 0-12.71 0z"
            fill={color}
          />
        </Svg>
      );
    case 'shuffle':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path d="m400 304 48 48-48 48M400 112l48 48-48 48M64 352h85.19a80 80 0 0 0 66.56-35.62L256 256" fill="none" stroke={color} strokeWidth={40} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M64 160h85.19a80 80 0 0 1 66.56 35.62l80.5 120.76A80 80 0 0 0 362.81 352H416M416 160h-53.19a80 80 0 0 0-66.56 35.62L288 208" fill="none" stroke={color} strokeWidth={40} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'repeat':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path d="m320 120 48 48-48 48" fill="none" stroke={color} strokeWidth={40} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M352 168H144a80.24 80.24 0 0 0-80 80v16M192 392l-48-48 48-48" fill="none" stroke={color} strokeWidth={40} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M160 344h208a80.24 80.24 0 0 0 80-80v-16" fill="none" stroke={color} strokeWidth={40} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'heart':
    case 'heart-outline':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path
            d="M256 448a32 32 0 0 1-18-5.57c-78.59-53.35-112.62-89.93-131.39-112.8-40-48.75-59.15-98.8-58.61-153C48.63 114.52 98.46 64 159.08 64c44.08 0 74.61 24.83 92.39 45.51a6 6 0 0 0 9.06 0C278.31 88.81 308.84 64 352.92 64c60.62 0 110.45 50.52 111.08 112.64.54 54.21-18.63 104.26-58.61 153-18.77 22.87-52.8 59.45-131.39 112.8a32 32 0 0 1-18 5.56z"
            fill={name === 'heart' ? color : 'none'}
            stroke={color}
            strokeWidth={name === 'heart' ? 0 : 36}
          />
        </Svg>
      );
    case 'share-outline':
      // Apple-style share glyph: arrow out of an open square.
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path d="M336 192h56a40 40 0 0 1 40 40v184a40 40 0 0 1-40 40H120a40 40 0 0 1-40-40V232a40 40 0 0 1 40-40h56" fill="none" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M256 336V64M160 160l96-96 96 96" fill="none" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'search':
      // The bold magnifier on a search page's empty state.
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path
            d="M456.69 421.39 362.6 327.3a173.81 173.81 0 0 0 34.84-104.58C397.44 126.38 319.06 48 222.72 48S48 126.38 48 222.72s78.38 174.72 174.72 174.72A173.81 173.81 0 0 0 327.3 362.6l94.09 94.09a25 25 0 0 0 35.3-35.3ZM97.92 222.72a124.8 124.8 0 1 1 124.8 124.8 124.95 124.95 0 0 1-124.8-124.8Z"
            fill={color}
          />
        </Svg>
      );
    case 'close-circle':
      // A search field's Clear button: a cross cut out of a filled disc.
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path
            d="M256 48C141.31 48 48 141.31 48 256s93.31 208 208 208 208-93.31 208-208S370.69 48 256 48Zm75.31 260.69a16 16 0 1 1-22.62 22.62L256 278.63l-52.69 52.68a16 16 0 0 1-22.62-22.62L233.37 256l-52.68-52.69a16 16 0 0 1 22.62-22.62L256 233.37l52.69-52.68a16 16 0 0 1 22.62 22.62L278.63 256Z"
            fill={color}
          />
        </Svg>
      );
    case 'disc-outline':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Circle cx="256" cy="256" r="208" fill="none" stroke={color} strokeWidth={32} strokeMiterlimit={10} />
          <Circle cx="256" cy="256" r="96" fill="none" stroke={color} strokeWidth={32} strokeMiterlimit={10} />
          <Circle cx="256" cy="256" r="32" fill={color} />
        </Svg>
      );
    case 'people-outline':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path d="M402 168c-2.93 40.67-33.1 72-66 72s-63.12-31.32-66-72c-3-42.31 26.37-72 66-72s69 30.46 66 72Z" fill="none" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M336 304c-65.17 0-127.84 32.37-143.54 95.41-2.08 8.34 3.15 16.59 11.72 16.59h263.65c8.57 0 13.77-8.25 11.72-16.59C463.85 335.36 401.18 304 336 304Z" fill="none" stroke={color} strokeWidth={32} strokeMiterlimit={10} />
          <Path d="M200 185.94c-2.34 32.48-26.72 58.06-53 58.06s-50.7-25.57-53-58.06C91.61 152.15 115.34 128 147 128s55.39 24.77 53 57.94Z" fill="none" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M206 306c-18.05-8.27-37.93-11.45-59-11.45-52 0-102.1 25.85-114.65 76.2-1.65 6.66 2.53 13.25 9.37 13.25H154" fill="none" stroke={color} strokeWidth={32} strokeLinecap="round" strokeMiterlimit={10} />
        </Svg>
      );
    case 'arrow-down-circle-outline':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path d="M176 262.62 256 342l80-79.38M256 330.97V170" fill="none" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M256 64C150 64 64 150 64 256s86 192 192 192 192-86 192-192S362 64 256 64Z" fill="none" stroke={color} strokeWidth={32} strokeMiterlimit={10} />
        </Svg>
      );
    case 'add-circle-outline':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path d="M448 256c0-106-86-192-192-192S64 150 64 256s86 192 192 192 192-86 192-192Z" fill="none" stroke={color} strokeWidth={32} strokeMiterlimit={10} />
          <Path d="M256 176v160M336 256H176" fill="none" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'checkmark-done':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path d="M464 128 240 384l-96-96M144 384l-96-96M368 128 232 284" fill="none" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'book-outline':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path d="M256 160c16-63.16 76.43-95.41 208-96a15.94 15.94 0 0 1 16 16v288a16 16 0 0 1-16 16c-128 0-177.45 25.81-208 64-30.37-38-80-64-208-64-9.88 0-16-8.05-16-17.93V80a15.94 15.94 0 0 1 16-16c131.57.59 192 32.84 208 96zM256 160v288" fill="none" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'camera-outline':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path d="M350.54 148.68l-26.62-42.06C318.31 100.08 310.62 96 302 96h-92c-8.62 0-16.31 4.08-21.92 10.62l-26.62 42.06C155.85 155.23 148.62 160 140 160H80a32 32 0 0 0-32 32v192a32 32 0 0 0 32 32h352a32 32 0 0 0 32-32V192a32 32 0 0 0-32-32h-59c-8.65 0-16.85-4.77-22.46-11.32z" fill="none" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx="256" cy="272" r="80" fill="none" stroke={color} strokeWidth={32} strokeMiterlimit={10} />
          <Path d="M124 158v-22h-24v22" fill="none" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'cloud-done-outline':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path d="M400 240c-8.89-89.54-71-144-144-144-69 0-113.44 48.2-128 96-60 6-112 43.59-112 112 0 66 54 112 120 112h260c55 0 100-27.44 100-88 0-59.82-53-85.76-96-88z" fill="none" stroke={color} strokeWidth={32} strokeLinejoin="round" />
          <Path d="M317 208 209.2 336 163 284.8" fill="none" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'mail-outline':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Rect x="48" y="96" width="416" height="320" rx="40" ry="40" fill="none" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="m112 160 144 112 144-112" fill="none" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'key-outline':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path d="M218.1 167.17c0 13 0 25.6 4.1 37.4-43.1 50.6-156.9 184.3-167.5 194.5a20.17 20.17 0 0 0-6.7 15c0 8.5 5.2 16.7 9.6 21.3 6.6 6.9 34.8 33 40 28 15.4-15 18.5-19 24.8-25.2 9.5-9.3-1-28.3 2.3-36s6.8-9.2 12.5-10.4 15.8 2.9 23.7 3c8.3.1 12.8-3.4 19-9.2 5-4.6 8.6-8.9 8.7-15.6.2-9-12.8-20.9-3.1-30.4s23.7 6.2 34 5 22.8-15.5 24.1-21.6-11.7-21.8-9.7-30.7c.7-3 6.8-10 11.4-11s25 6.9 29.6 5.9c5.6-1.2 12.1-7.1 17.4-10.4 15.5 6.7 29.6 9.4 47.7 9.4 68.5 0 124-53.4 124-119.2S408.5 48 340 48s-121.9 53.37-121.9 119.17zM400 144a32 32 0 1 1-32-32 32 32 0 0 1 32 32z" fill="none" stroke={color} strokeWidth={32} strokeLinejoin="round" />
        </Svg>
      );
    case 'log-out-outline':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" style={style}>
          <Path d="M304 336v40a40 40 0 0 1-40 40H104a40 40 0 0 1-40-40V136a40 40 0 0 1 40-40h152c22.09 0 48 17.91 48 40v40M368 336l80-80-80-80M176 256h256" fill="none" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    default:
      return null;
  }
}
