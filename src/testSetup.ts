import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';

const nodeBufModName = 'node:buffer';
const setupNodeBlob = async () => {
  try {
    const mod = (await import(/* @vite-ignore */ nodeBufModName)) as {
      Blob?: typeof Blob;
      File?: typeof File;
    };
    if (mod.Blob) globalThis.Blob = mod.Blob;
    if (mod.File) globalThis.File = mod.File;
  } catch {
    // ignore in browser
  }
};
await setupNodeBlob();

if (typeof window !== 'undefined' && !window.scrollTo) {
  window.scrollTo = () => {};
} else if (typeof window !== 'undefined') {
  window.scrollTo = () => {};
}

if (typeof URL !== 'undefined') {
  if (!URL.createObjectURL) {
    URL.createObjectURL = () => `blob:test-${Math.random().toString(36).slice(2)}`;
  }
  if (!URL.revokeObjectURL) {
    URL.revokeObjectURL = () => {};
  }
}
