import type { Express } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";

export function registerRoutes(app: Express) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });

  app.post('/api/translate', async (req, res) => {
    try {
      const { text } = req.body;
      
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: `You are a helpful Tibetan language translator. Please translate the following Tibetan text to English, maintaining academic and scholarly tone: ${text}`}]}],
        generationConfig: {
          temperature: 0.3,
          topK: 1,
          topP: 0.8,
        },
      });

      const response = await result.response;
      const translation = response.text();
      
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
