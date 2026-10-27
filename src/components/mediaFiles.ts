// Compare only same-size/type candidates in bounded chunks; never rewrite media.
export async function sameMediaBytes(
  left: Blob,
  right: Blob
): Promise<boolean> {
  if (left.size !== right.size || left.type !== right.type) return false;
  for (let offset = 0; offset < left.size; offset += 65536) {
    const [a, b] = await Promise.all([
      left.slice(offset, offset + 65536).arrayBuffer(),
      right.slice(offset, offset + 65536).arrayBuffer(),
    ]);
    const bytes = new Uint8Array(a),
      other = new Uint8Array(b);
    if (bytes.some((value, index) => value !== other[index])) return false;
  }
  return true;
}
