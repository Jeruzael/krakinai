// Synthetic, decodable floor-plan media and deterministic records in a fresh Playwright context.
// This seed also runs against master: it does not attach the source or require Shot Type APIs.
export const MIDORI_INSTRUCTIONS = 'Preserve the provided floor-plan geometry, dimensions, room labels and proportions. Introduce a subtle zoom, highlight the two bedrooms and then the living/dining area. Do not redraw the original graphic or invent architectural information.';
export const MIDORI_FILENAME = 'MIDORI-two-bedroom-original.png';
export const MIDORI_TITLE = 'MIDORI / 03 — Floor Plan';

export async function seedShotTypes(page) {
  await page.goto('/#/');
  await page.getByText('Your reusable video creation toolkit').waitFor({ state: 'attached' });
  const ids = await page.evaluate(async ({ filename, title }) => {
    const db = await import('/src/storage/db.ts');
    const now = '2026-10-28T00:00:00.000Z';
    const canvas = document.createElement('canvas');
    canvas.width = 960; canvas.height = 720;
    const c = canvas.getContext('2d');
    c.fillStyle = '#f8faf8'; c.fillRect(0, 0, 960, 720);
    c.fillStyle = '#174b3c'; c.font = 'bold 34px sans-serif';
    c.fillText('MIDORI / Two-bedroom floor plan', 38, 55);
    c.fillStyle = '#52645c'; c.font = '19px sans-serif';
    c.fillText('SYNTHETIC QA DATA — Fictional condominium. Not for construction.', 38, 88);
    const rooms = [
      [80, 130, 320, 245, '#dcebdd', 'BEDROOM 1'],
      [400, 130, 320, 245, '#dcebdd', 'BEDROOM 2'],
      [720, 130, 160, 245, '#e6ecf2', 'BATH'],
      [80, 375, 520, 250, '#f1e8d5', 'LIVING / DINING'],
      [600, 375, 280, 250, '#e4e8dc', 'KITCHEN'],
    ];
    for (const [x, y, w, h, fill, label] of rooms) {
      c.fillStyle = fill; c.fillRect(x, y, w, h);
      c.strokeStyle = '#263c33'; c.lineWidth = 7; c.strokeRect(x, y, w, h);
      c.fillStyle = '#263c33'; c.font = 'bold 22px sans-serif'; c.textAlign = 'center';
      c.fillText(label, x + w / 2, y + h / 2);
    }
    // Simple bed, bath and dining outlines make the original visibly decodable as a floor plan.
    c.strokeStyle = '#638273'; c.lineWidth = 3;
    for (const x of [110, 430]) { c.strokeRect(x, 155, 135, 150); c.strokeRect(x + 10, 167, 115, 35); }
    c.strokeRect(752, 165, 92, 55); c.strokeRect(650, 470, 175, 90);
    c.beginPath(); c.ellipse(345, 525, 75, 45, 0, 0, Math.PI * 2); c.stroke();
    c.fillStyle = '#52645c'; c.font = '18px sans-serif'; c.textAlign = 'left';
    c.fillText('Original source graphic • two bedrooms • room labels intentionally preserved', 80, 675);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Synthetic floor-plan PNG encoding failed.');
    const source = { id: 'media_qa_midori_floorplan', filename, safeFilename: filename, mimeType: 'image/png', byteSize: blob.size, blob, width: canvas.width, height: canvas.height, createdAt: now };
    const draft = { id: 'draft_qa_midori_floorplan', title, slots: {}, extraRequiredSlots: [], sceneInstructions: '', settings: { aspectRatio: '16:9', durationSeconds: 8 }, inputRevision: 1, manualOutputs: {}, resultMediaLinks: [], reviewNotes: '', reviewStatus: 'unreviewed', updatedAt: now };
    const collection = { id: 'collection_qa_midori', name: 'MIDORI — Fictional Condominium / Synthetic QA', description: 'Synthetic QA only. An ordered three-shot condominium storyboard.', members: [], createdAt: now, updatedAt: now, project: { version: 1, revision: 0, shots: ['Arrival', 'Amenities', 'Floor Plan'].map((shotTitle, order) => ({ id: `shot_qa_midori_${order + 1}`, order, code: String(order + 1).padStart(2, '0'), title: shotTitle, takeSceneIds: [], status: 'planned' })) } };
    await db.replaceAllStoresTransactionally({ assets: [], variants: [], media: [source], drafts: [draft], scenes: [], collections: [collection], templates: [], preferences: { id: 'app_preferences', schemaVersion: 1, starterLoaded: true, activeDraftId: draft.id, updatedAt: now } });
    const originalSha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))).map(value => value.toString(16).padStart(2, '0')).join('');
    return { draftId: draft.id, sourceId: source.id, collectionId: collection.id, shotId: collection.project.shots[2].id, shotIds: collection.project.shots.map(shot => shot.id), originalFilename: source.filename, originalByteSize: blob.size, originalSha256, originalPngBase64: canvas.toDataURL('image/png').split(',')[1], draftRoute: `/#/builder/${draft.id}`, projectRoute: `/#/collections/${collection.id}?tab=storyboard` };
  }, { filename: MIDORI_FILENAME, title: MIDORI_TITLE });
  await page.reload();
  await page.goto(ids.draftRoute);
  await page.getByRole('heading', { name: 'Scene Builder', exact: true }).waitFor();
  return ids;
}
