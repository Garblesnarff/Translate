// client/src/lib/dataGatheringCrew.ts

export async function extractDataFromText(text: string) {
  try {
    const response = await fetch('http://localhost:5001/extract', { // changed the URL here
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to gather data: ${error}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching:', error);
    throw error
  }
}