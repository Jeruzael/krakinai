// All callers own fresh isolated synthetic profiles; never use a user's origin/profile.
export async function seedPermissionWorkspace(page, count = 80) {
  await page.goto('/#/connections/ai');
  await page.getByRole('heading', { name: 'AI Connections', exact: true }).waitFor();
  if (new URL(page.url()).origin !== 'http://127.0.0.1:4173') throw Error('Synthetic permission fixture refused a non-QA origin');
  await page.evaluate(async count => {
    const db = await import('/src/storage/db.ts'), fixture = await import('/src/__tests__/fixtures/changeSetFixture.ts');
    const connection = await db.openDatabase();
    await new Promise((resolve, reject) => {
      const tx = connection.transaction('assets', 'readwrite');
      for (let i = 0; i < count; i++) tx.objectStore('assets').put({ ...fixture.syntheticCamera(), id: 'synthetic_bulk_' + i, title: 'Synthetic ' + (i < 65 ? 'Matching ' : 'Hidden ') + String(i).padStart(2, '0'), category: i % 2 ? 'camera' : 'lighting' });
      tx.oncomplete = resolve; tx.onabort = () => reject(tx.error);
    });
  }, count);
  await page.reload();
  await page.getByRole('heading', { name: 'AI Connections', exact: true }).waitFor();
}
