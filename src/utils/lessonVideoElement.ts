/**
 * The lesson's <video> element, which exists only on the web
 * (lessonVideoElement.web.ts). On iOS and Android each surface draws the
 * player in a view of its own, so there is nothing to lend.
 */
export function lessonVideoElement(): HTMLVideoElement | null {
  return null;
}

/** Nothing to keep: the web's home view only (lessonVideoElement.web.ts). */
export function setLessonVideoHome(_container: HTMLElement | null, _video: HTMLVideoElement | null): void {
  // No element outside the web.
}

/** Nothing to lend: each surface has its own view (lessonVideoElement.web.ts). */
export function borrowLessonVideo(_slot: HTMLElement | null): () => void {
  return () => undefined;
}
