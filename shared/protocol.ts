export const VERSION = 1;
export const DEFAULT_PORT = 43821;
export const MAX_MESSAGE = 16_384;
export type AdState = 'content' | 'ad' | 'uncertain';
export interface Playback {
  videoId: string; generation: number; seq: number; title: string; artist: string;
  position: number; duration: number | null; rate: number;
  playing: boolean; seeking: boolean; buffering: boolean; ended: boolean; muted: boolean; ad: AdState;
}
export type ClientMessage =
  | { v: 1; type: 'auth'; secret: string; instance: string }
  | { v: 1; type: 'heartbeat' }
  | { v: 1; type: 'snapshot'; tab: number; document: string; playback: Playback }
  | { v: 1; type: 'remove'; tab: number }
  | { v: 1; type: 'pin'; tab: number | null };
export const object = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
export const text = (x: unknown, max: number): x is string => typeof x === 'string' && x.length <= max;
export const number = (x: unknown, min: number, max: number): x is number => typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max;
export const integer = (x: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): x is number => number(x, min, max) && Number.isInteger(x);
export const videoId = (x: unknown): x is string => typeof x === 'string' && /^[A-Za-z0-9_-]{11}$/.test(x);
export const identity = (x: unknown): x is string => typeof x === 'string' && /^[a-zA-Z0-9_-]{8,80}$/.test(x);
export function validPlayback(x: unknown): x is Playback {
  return object(x) && videoId(x.videoId) && integer(x.generation) && integer(x.seq) && text(x.title, 400) && text(x.artist, 200)
    && number(x.position, 0, 604800) && (x.duration === null || number(x.duration, 0, 604800)) && number(x.rate, .1, 16)
    && ['playing','seeking','buffering','ended','muted'].every(k => typeof x[k] === 'boolean') && ['content','ad','uncertain'].includes(x.ad as string);
}
export function parseMessage(raw: string): ClientMessage | null {
  if (raw.length > MAX_MESSAGE) return null;
  let x: unknown; try { x = JSON.parse(raw); } catch { return null; }
  if (!object(x) || x.v !== VERSION) return null;
  if (x.type === 'auth' && typeof x.secret === 'string' && /^[a-f0-9]{64}$/.test(x.secret) && identity(x.instance)) return x as ClientMessage;
  if (x.type === 'heartbeat') return { v: VERSION, type: 'heartbeat' };
  if (x.type === 'snapshot' && integer(x.tab, 0, 2**31-1) && identity(x.document) && validPlayback(x.playback)) return x as ClientMessage;
  if (x.type === 'remove' && integer(x.tab, 0, 2**31-1)) return x as ClientMessage;
  if (x.type === 'pin' && (x.tab === null || integer(x.tab, 0, 2**31-1))) return x as ClientMessage;
  return null;
}
export function extensionOrigin(origin: unknown): origin is string {
  return typeof origin === 'string' && (/^chrome-extension:\/\/[a-p]{32}$/.test(origin)
    || /^moz-extension:\/\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(origin));
}
