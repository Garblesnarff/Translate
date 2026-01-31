// client/src/lib/fontLoader.ts

export async function loadCustomFonts(doc: any) {
  try {
    // Add Arial Unicode MS for Tibetan support
    const response = await fetch('/fonts/arial-unicode-ms.ttf');
    const fontData = await response.arrayBuffer();
    doc.addFileToVFS('arial-unicode-ms.ttf', fontData);
    doc.addFont('arial-unicode-ms.ttf', 'Arial Unicode MS', 'normal');
    return true;
  } catch (error) {
    console.error('Error loading custom fonts:', error);
    return false;
  }
}