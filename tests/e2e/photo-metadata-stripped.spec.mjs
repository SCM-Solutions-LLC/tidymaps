import { test, expect } from 'playwright/test';

/* A camera photo's EXIF block can carry GPS coordinates — where the photo of
   someone's home was taken. js/db.js used to upload a photo File to
   space-media storage unmodified, EXIF and all; the video-frame path never
   had this problem because a frame comes off a canvas, and canvas export
   never carries EXIF forward. stripPhotoMetadata() now routes photos through
   the same canvas re-decode/re-export, which strips EXIF as a side effect
   of how canvas export works, without needing to parse the EXIF block at all.

   The fixture below is a real, decodable 8x8 JPEG (built once by rendering a
   canvas fillRect to JPEG in this same browser, then splicing in a minimal
   but valid EXIF APP1 segment with a GPS IFD entry right after the SOI
   marker) so the test proves the actual browser behavour rather than
   asserting the source calls a canvas API. */
const JPEG_WITH_GPS_EXIF_B64 = '/9j/4QA0RXhpZgAASUkqAAgAAAABACWIBAABAAAAGgAAAAAAAAABAAEAAgACAAAATgAAAAAAAAD/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAAIAAgDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAB//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AJoAMjm//9k=';

test('a saved photo\'s EXIF block, GPS included, is stripped before it reaches storage', async ({ page }) => {
  await page.goto('/index.html');
  const result = await page.evaluate(async (b64) => {
    const [{ state }, db] = await Promise.all([
      import('/js/state.js'), import('/js/db.js'),
    ]);
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const sourceHasExif = new TextDecoder('latin1').decode(bytes).includes('Exif');
    const file = new File([bytes], 'photo.jpg', { type: 'image/jpeg' });
    state.uploadedFiles = [file];
    const snapshot = db.snapshotSave('Test', { media: true });
    const blob = await snapshot.uploads[0].blobPromise;
    const outBytes = new Uint8Array(await blob.arrayBuffer());
    const uploadedHasExif = new TextDecoder('latin1').decode(outBytes).includes('Exif');
    return { sourceHasExif, uploadedHasExif, sourceBytes: bytes.length, uploadedBytes: outBytes.length };
  }, JPEG_WITH_GPS_EXIF_B64);

  expect(result.sourceHasExif, 'the fixture itself carries no EXIF — the test proves nothing').toBe(true);
  expect(result.uploadedHasExif, 'the uploaded blob still carries the EXIF/GPS block').toBe(false);
  // Re-encoded through a canvas, so the bytes are not simply a copy of the input.
  expect(result.uploadedBytes).not.toBe(result.sourceBytes);
});
