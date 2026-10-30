/** JSON keys are sorted by UTF-16 code unit; original string values are untouched. */
export function canonicalStringify(value: unknown): string {
  if (Array.isArray(value))
    return "[" + value.map(canonicalStringify).join(",") + "]";
  if (value !== null && typeof value === "object")
    return (
      "{" +
      Object.keys(value)
        .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
        .sort()
        .map(
          (k) =>
            JSON.stringify(k) +
            ":" +
            canonicalStringify((value as Record<string, unknown>)[k]),
        )
        .join(",") +
      "}"
    );
  const text = JSON.stringify(value);
  if (text === undefined) throw Error("Unsupported canonical value.");
  return text;
}
export async function changeSetDigest(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalStringify(value));
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
