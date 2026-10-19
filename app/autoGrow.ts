// Text that must wrap on a phone but still read as plain text (names, titles)
// uses a <textarea> sized to its content, since a single-line <input> can only
// clip. Sizing once on mount isn't enough: if the stylesheet or font lands
// after that measurement, or the phone rotates, the width — and so the number
// of wrapped lines — changes, so autoGrowRef re-measures on width changes too.
export function autoGrow(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  // scrollHeight leaves out the border, which border-box sizing counts.
  el.style.height = `${el.scrollHeight + (el.offsetHeight - el.clientHeight)}px`;
}

// Pass as a textarea's `ref`; pair with `onInput={(e) => autoGrow(e.currentTarget)}`
// so it also grows as the user types.
export function autoGrowRef(el: HTMLTextAreaElement | null) {
  if (!el) return;
  autoGrow(el);

  let lastWidth = el.clientWidth;
  const observer = new ResizeObserver(() => {
    if (el.clientWidth === lastWidth) return;
    lastWidth = el.clientWidth;
    autoGrow(el);
  });
  observer.observe(el);
  return () => observer.disconnect();
}
