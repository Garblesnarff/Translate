import type { Express } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { splitTextIntoChunks, combineTranslations } from "../client/src/lib/textChunker";

export function registerRoutes(app: Express) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-8b" });

  app.post('/api/translate', async (req, res) => {
    try {
      const { text } = req.body;
      const chunks = splitTextIntoChunks(text);
      const translations = [];

      for (const chunk of chunks) {
        const result = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: `You are a professional Tibetan language translator. Please translate the following Tibetan text to English, word for word. Keep its meaning as close to the original as you can.:

Instructions:
1. Maintain an academic and scholarly tone
2. Preserve the original structure but omit repeated headings
3. For Buddhist terms and names:
   - Keep original Sanskrit terms in italics (e.g. *dharma*)
   - Use proper capitalization for proper nouns
4. Use clear paragraph breaks and section headers
5. Format using these rules:
   - Use # for main headers only
   - Use regular text for general content

Text to translate (Page ${chunk.pageNumber}):
${chunk.content}`}]}],
          generationConfig: {
            temperature: 0.2,
            topK: 1,
            topP: 0.8,
            maxOutputTokens: 8192,
          },
        });

        const response = await result.response;
        const translation = response.text()
          .replace(/\*\*([^*]+)\*\*/g, '#$1') // Convert bold to headers
          .replace(/(?:\r\n|\r|\n){3,}/g, '\n\n') // Remove excessive newlines
          .replace(/#{2,}/g, '#') // Normalize multiple # to single #
          .replace(/^[#\s]*(?:The\s+)?([A-Z][^#\n]+)(?:\s*#\s*)?$/gm, '# $1') // Normalize section headers
          .replace(/(?:^|\n)(?:[-*]\s*(?:The\s+)?(?:Lotus|Wheel|Conch|Banner|Vase|Jewel|Fish|Throne|Dharma)\s*(?:$|\n)){3,}/g, '') // Remove repeated symbol lists
          .trim();

        translations.push({
          pageNumber: chunk.pageNumber,
          translation,
        });
      }

      const combinedTranslation = combineTranslations(translations);
      res.json({ translatedText: combinedTranslation });
    } catch (error) {
      console.error('Translation error:', error);
      res.status(500).json({ error: 'Translation failed' });
    }
  });

  app.get('/api/dictionary', (req, res) => {
    // Mock dictionary data
    const dictionary = [
      { tibetan: "བཀྲ་ཤིས་", english: "Tashi", context: "Greeting" },
      { tibetan: "བདེ་པོ་", english: "Good", context: "Adjective" },
    ];
    res.json(dictionary);
  });
}
