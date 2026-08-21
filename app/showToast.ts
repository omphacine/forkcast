// Dispatched as a plain DOM event rather than through component state so a
// server-action revalidation (which re-renders the form that triggered it)
// can't wipe the message before <ToastListener>, mounted once in the root
// layout, gets a chance to pick it up.
export function showToast(message: string) {
  window.dispatchEvent(new CustomEvent("forkcast:toast", { detail: message }));
}
