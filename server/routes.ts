// routes.ts
import type { Express } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { splitTextIntoChunks } from "../client/src/lib/textChunker";
import { TibetanTextProcessor } from "./textFormatter";

function createTranslationPrompt(pageNumber: number, text: string): string {
  return `Translate this Tibetan Buddhist text into clear English, following these specific guidelines:

TRANSLATION RULES:
1. Buddhist Terms:
   - Maintain Sanskrit terms with English in parentheses on first use
   - Example: "upāsaka (lay practitioner)"
   - Keep diacritical marks for Sanskrit terms (ā, ī, ṇ, ś, etc.)
   - Always preserve these terms: Dharma, Karma, Buddha, Sangha, Vajra

2. Names and Titles:
   - Keep Tibetan personal names in transliteration
   - Translate honorary titles
     - "Rinpoche" → "Precious One"
     - "Lama" → "Master"
   - Include original Tibetan in parentheses for important titles
   - Example: "Master Jampa Sönam (Bla ma Byams pa Bsod nams)"

3. Text Structure:
   - Use clear section headers with "## " prefix
   - Create proper paragraphs for narrative sections
   - Use bullet points (*) only for lineage lists
   - Separate sections with one blank line
   - Each sentence in a paragraph on its own line

4. Formatting:
   - Headers: ## Section Name
   - Lists: * Name (with translation if meaningful)
   - Preserve original dates and time references
   - Maintain proper Buddhist honorifics
   - Include parenthetical explanations for cultural terms

5. Special Handling:
   - Lineages: List format with bullet points
   - Teachings received: Organized subsections
   - Empowerments: Clear hierarchical structure
   - Historical dates: Preserve Tibetan calendar references

Remember: Maintain religious and historical accuracy while making the text accessible to English readers. Pay special attention to Buddhist technical terms and proper formatting of lineages.

Text to translate (Page ${pageNumber}):
${text}`;
}

export function registerRoutes(app: Express) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-pro",
    generationConfig: {
      temperature: 0.1,
      topK: 1,
      topP: 0.8,
      maxOutputTokens: 8192,
    }
  });

  app.post('/api/translate', async (req, res) => {
    try {
      const { text } = req.body;
      const chunks = splitTextIntoChunks(text);
      const translations = [];
      const textProcessor = new TibetanTextProcessor({
        preserveSanskrit: true,
        formatLineages: true,
        enhancedSpacing: true,
        handleHonorifics: true
      });

      for (const chunk of chunks) {
        const result = await model.generateContent({
          contents: [{ 
            role: "user", 
            parts: [{ 
              text: createTranslationPrompt(chunk.pageNumber, chunk.content)
            }]
          }],
        });

        const response = await result.response;
        const rawTranslation = response.text();
        const processedTranslation = textProcessor.processText(rawTranslation);

        translations.push({
          pageNumber: chunk.pageNumber,
          translation: processedTranslation,
        });
      }

      const combinedText = translations
        .sort((a, b) => a.pageNumber - b.pageNumber)
        .map(t => t.translation)
        .join('\n\n');

      res.json({ translatedText: combinedText });
    } catch (error) {
      console.error('Translation error:', error);
      res.status(500).json({ 
        error: 'Translation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}