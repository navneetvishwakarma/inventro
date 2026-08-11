import { test, expect } from './fixtures';

// S-84: preprocessFile (lib/receipts/preprocess.ts) throws when the browser
// can't decode a file's bytes (createImageBitmap rejects on malformed image
// data -- this is real Chromium decode behavior, not a mock). Before the
// fix, capture.tsx's handleFiles awaited preprocessFile with no try/catch
// inside startTransition, so one bad file in a batch threw past
// setResults/setStatus('idle') entirely: the UI hangs on "Got it --
// processing..." forever and the rest of the batch (including files after
// the bad one in iteration order) never reaches the upload action.
//
// "bad.png" is garbage bytes with a .png name/mimeType so preprocessFile
// routes it through downscaleImage's createImageBitmap call (no HEIC/heic2any
// involved -- simpler and just as real a decode failure). "good.png" is a
// valid 1x1 PNG that should upload and get a receiptId back from the live
// Supabase-backed uploadReceiptsAction.
test('capture: a file that fails client-side preprocessing gets a Failed badge, the rest of the batch still uploads, and status returns to idle', async ({ page }) => {
  await page.goto('/add');

  const goodPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64'
  );
  const badPng = Buffer.from('this is not a valid png file', 'utf-8');

  // Second file input is fileInputRef (accepts multiple) -- the first is the
  // camera-capture input (single file, image/* only).
  const fileInput = page.locator('input[type="file"]').nth(1);
  await fileInput.setInputFiles([
    { name: 'bad.png', mimeType: 'image/png', buffer: badPng },
    { name: 'good.png', mimeType: 'image/png', buffer: goodPng },
  ]);

  await expect(page.getByText(/Failed .{1,3} couldn.t process image/)).toBeVisible({ timeout: 20_000 });
  // downscaleImage renames the processed file to a .jpg regardless of its
  // original extension (lib/receipts/preprocess.ts) -- the surviving file's
  // result row is keyed on that post-preprocessing name, not "good.png".
  await expect(page.getByText('good.jpg')).toBeVisible();
  await expect(page.getByText('Uploaded', { exact: true })).toBeVisible();

  // Status must reach 'idle' -- the processing message gone and controls
  // re-enabled -- regardless of the bad file's failure.
  await expect(page.getByText('Got it — processing…')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Choose files' })).toBeEnabled();
});
