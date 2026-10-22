/** Owns frame observation only; playback and the video element remain caller-owned. */
export function watchPanoramaVideo(video: HTMLVideoElement, document: Document, update: () => void) {
  let disposed = false, visible = true, blocked = false, generation = 0;
  const view = document.defaultView;
  const native = typeof video.requestVideoFrameCallback === 'function' && typeof video.cancelVideoFrameCallback === 'function';
  let pending: number | undefined, animation: number | undefined, watchdog: number | undefined;
  let lastTime = video.currentTime;
  const eligible = () => !disposed && visible && !document.hidden && !blocked && !video.paused && !video.ended && video.readyState >= 2;
  const cancelFallback = () => {
    if (animation !== undefined) view?.cancelAnimationFrame(animation);
    if (watchdog !== undefined) view?.clearTimeout(watchdog);
    animation = undefined; watchdog = undefined;
  };
  const cancel = () => {
    generation++;
    if (pending !== undefined) video.cancelVideoFrameCallback(pending);
    pending = undefined; cancelFallback();
  };
  const fallback = () => {
    if (animation !== undefined || !eligible()) return;
    const token = generation;
    animation = view?.requestAnimationFrame(() => {
      if (token !== generation || !eligible()) return;
      animation = undefined;
      if (video.currentTime !== lastTime) { lastTime = video.currentTime; update(); }
      if (token === generation) fallback();
    });
  };
  const schedule = () => {
    if (!eligible()) return;
    if (!native) { fallback(); return; }
    if (pending !== undefined) return;
    const token = generation;
    pending = video.requestVideoFrameCallback(() => {
      if (token !== generation || !eligible()) return;
      pending = undefined; generation++; cancelFallback(); lastTime = video.currentTime;
      const resumed = generation; update(); if (resumed === generation) schedule();
    });
    // Some media pipelines expose frame callbacks without delivering them. Keep one request
    // outstanding and observe advancing playback through animation frames until it recovers.
    watchdog = view?.setTimeout(() => {
      if (token !== generation || !eligible()) return;
      watchdog = undefined; fallback();
    }, 250);
  };
  const refresh = () => { if (!disposed && visible && !document.hidden && video.readyState >= 2) update(); schedule(); };
  // A seek can complete before its frame is ready to upload, and a paused video schedules no
  // further frames, so a paused seek also updates once its frame is presented.
  const presented = () => { if (visible && !document.hidden) update(); schedule(); };
  const settle = () => {
    if (!video.paused) return;
    const token = generation;
    if (native) {
      if (pending === undefined) pending = video.requestVideoFrameCallback(() => { if (token === generation) { pending = undefined; presented(); } });
    } else if (animation === undefined) {
      animation = view?.requestAnimationFrame(() => { if (token === generation) { animation = undefined; presented(); } });
    }
  };
  const resume = () => { blocked = false; refresh(); };
  const stop = () => { blocked = true; cancel(); };
  const visibility = () => { cancel(); if (!document.hidden) refresh(); };
  const starts = ['play', 'playing', 'seeked', 'loadeddata', 'durationchange'];
  const stops = ['pause', 'ended', 'waiting', 'emptied'];
  for (const name of starts) video.addEventListener(name, resume);
  video.addEventListener('seeked', settle);
  for (const name of stops) video.addEventListener(name, stop);
  document.addEventListener('visibilitychange', visibility); schedule();
  return {
    setVisible(value: boolean) { visible = value; cancel(); if (value) refresh(); },
    dispose() { if (disposed) return; disposed = true; cancel(); for (const name of starts) video.removeEventListener(name, resume); for (const name of stops) video.removeEventListener(name, stop); video.removeEventListener('seeked', settle); document.removeEventListener('visibilitychange', visibility); },
  };
}
