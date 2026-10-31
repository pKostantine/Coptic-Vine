import '@/services/offlineChecksum';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Network from 'expo-network';

import { moveLegacyFile, moveLegacyStorageKey } from '@/utils/legacyNames';

export interface DownloadPreferences { wifiOnly: boolean; allowCellular: boolean; allowVideoOnCellular: boolean; }
const DEFAULTS: DownloadPreferences = { wifiOnly: false, allowCellular: true, allowVideoOnCellular: false };
const WEB_KEY = 'cv-download-preferences-v1'; const NATIVE_URI = `${FileSystem.documentDirectory}cv-download-preferences.json`;
// Their names in earlier builds (utils/legacyNames.ts), moved to the new ones before the first read or write.
const LEGACY_WEB_KEY = 'chc-download-preferences-v1'; const LEGACY_NATIVE_URI = `${FileSystem.documentDirectory}chc-download-preferences.json`;
async function moveLegacy(): Promise<void> { if (Platform.OS === 'web') moveLegacyStorageKey(LEGACY_WEB_KEY, WEB_KEY); else await moveLegacyFile(LEGACY_NATIVE_URI, NATIVE_URI); }
let cached: DownloadPreferences | null = null; const listeners = new Set<() => void>();
// One choice, cellular or Wi-Fi only, kept in both fields so older stored
// preferences read the same: Wi-Fi only is cellular turned off.
function normalize(value: Partial<DownloadPreferences> | null | undefined): DownloadPreferences { const allowCellular = (value?.allowCellular ?? DEFAULTS.allowCellular) && !(value?.wifiOnly ?? DEFAULTS.wifiOnly); return { wifiOnly: !allowCellular, allowCellular, allowVideoOnCellular: value?.allowVideoOnCellular ?? DEFAULTS.allowVideoOnCellular }; }
export async function getDownloadPreferences(): Promise<DownloadPreferences> { if (cached) return cached; try { await moveLegacy(); const raw = Platform.OS === 'web' ? globalThis.localStorage?.getItem(WEB_KEY) ?? null : await FileSystem.readAsStringAsync(NATIVE_URI); cached = raw ? normalize(JSON.parse(raw) as Partial<DownloadPreferences>) : { ...DEFAULTS }; } catch { cached = { ...DEFAULTS }; } return cached; }
export async function setDownloadPreferences(patch: Partial<DownloadPreferences>): Promise<DownloadPreferences> { const current = await getDownloadPreferences(); cached = normalize({ ...current, ...patch }); const raw = JSON.stringify(cached); if (Platform.OS === 'web') globalThis.localStorage?.setItem(WEB_KEY, raw); else await FileSystem.writeAsStringAsync(NATIVE_URI, raw); listeners.forEach((listener) => listener()); return cached; }
export function subscribeDownloadPreferences(listener: () => void): () => void { listeners.add(listener); return () => listeners.delete(listener); }
/** Whether a download may start now. The liturgical calendar comes with the app, so it downloads on any connection whatever the cellular choice. */
export async function assertDownloadNetworkAllowed(hasVideo: boolean, systemResource = false): Promise<void> { const preferences = await getDownloadPreferences(); const network = await Network.getNetworkStateAsync(); if (network.isConnected === false || network.type === Network.NetworkStateType.NONE) throw new Error('Connect to the internet to start or update this download.'); if (systemResource || network.type !== Network.NetworkStateType.CELLULAR) return; if (preferences.wifiOnly || !preferences.allowCellular) throw new Error('Downloads are set to Wi-Fi only.'); if (hasVideo && !preferences.allowVideoOnCellular) throw new Error('Video downloads over cellular are turned off in Settings.'); }
