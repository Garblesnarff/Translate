import type { Express } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";

export function registerRoutes(app: Express) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });

  app.post('/api/translate', async (req, res) => {
    try {
      const { text } = req.body;
      
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: `You are a professional Tibetan language translator. Please translate the following Tibetan text to English:

Instructions:
1. Maintain an academic and scholarly tone
2. Preserve the original structure and headings
3. Do not repeat sections unnecessarily
4. Format the output with proper paragraphs
5. Use minimal markdown formatting - only for headings and emphasis where necessary

Text to translate:
${text}`}]}],
        generationConfig: {
          temperature: 0.2,
          topK: 1,
          topP: 0.8,
          maxOutputTokens: 2048,
        },
      });

      const response = await result.response;
      const translation = response.text()
        .replace(/\*\*/g, '#') // Convert bold markdown to heading
        .replace(/(?:\r\n|\r|\n){3,}/g, '\n\n') // Remove excessive newlines
        .replace(/#{2,}/g, '#'); // Normalize multiple # to single #
      
      res.json({ translatedText: translation });
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
