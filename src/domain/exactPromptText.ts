const display = (text: string) => text.replace(/\r\n?/g, "\n");
/** Convert the browser's normalized textarea offset back to original string offset. */
function originalOffset(text: string, offset: number): number {
  let raw = 0,
    shown = 0;
  while (raw < text.length && shown < offset) {
    if (text[raw] === "\r" && text[raw + 1] === "\n") raw++;
    raw++;
    shown++;
  }
  return raw;
}
export function replacePromptSelection(
  original: string,
  start: number,
  end: number,
  insert: string,
): string {
  return (
    original.slice(0, originalOffset(original, start)) +
    insert +
    original.slice(originalOffset(original, end))
  );
}
/** Preserve untouched CRLF/CR bytes when the textarea reports a normalized edit. */
export function reconcilePromptEdit(
  original: string,
  nextDisplay: string,
): string {
  const previous = display(original);
  if (previous === nextDisplay) return original;
  let start = 0;
  while (
    start < previous.length &&
    start < nextDisplay.length &&
    previous[start] === nextDisplay[start]
  )
    start++;
  let end = previous.length,
    nextEnd = nextDisplay.length;
  while (
    end > start &&
    nextEnd > start &&
    previous[end - 1] === nextDisplay[nextEnd - 1]
  ) {
    end--;
    nextEnd--;
  }
  return replacePromptSelection(
    original,
    start,
    end,
    nextDisplay.slice(start, nextEnd),
  );
}
