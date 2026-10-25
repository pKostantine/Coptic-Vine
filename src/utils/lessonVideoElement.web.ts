/**
 * The lesson's one <video> element on the web. expo-video's web player plays
 * through every element mounted for it, each fetching the stream itself, so
 * there is exactly one: the home view's (components/playback/
 * LessonVideoHome.web.tsx). A surface that shows the picture borrows it by
 * moving the element into itself, and gives it back when it goes; a media
 * element moved within the page keeps playing, its buffer and its place, so
 * the picture passes from the bar to the full player and back without a
 * reload or a second download.
 */
let home: HTMLElement | null = null;
let element: HTMLVideoElement | null = null;

export function setLessonVideoHome(container: HTMLElement | null, video: HTMLVideoElement | null): void {
  home = container;
  element = video;
}

export function lessonVideoElement(): HTMLVideoElement | null {
  return element;
}

/**
 * Moves the element into the slot; the function returned gives it back to
 * the home. Called from a layout effect, so the element leaves a surface
 * before React removes the surface from the page (it would otherwise go
 * with it, and stop).
 */
export function borrowLessonVideo(slot: HTMLElement | null): () => void {
  const video = element;
  if (!slot || !video) return () => undefined;
  if (video.parentElement !== slot) slot.appendChild(video);
  return () => {
    if (video.parentElement === slot && home) home.appendChild(video);
  };
}
