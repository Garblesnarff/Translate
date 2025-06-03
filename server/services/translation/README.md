# Translation Services

## Purpose

This directory (`server/services/translation/`) is dedicated to modules that handle the translation of text. The primary mechanism for translation is likely interaction with an external AI-powered translation API, such as Google's Gemini model.

These services encapsulate the logic required to communicate with the translation provider, manage API keys, format requests, and process responses.

## Important Files

The core modules in this directory are:

- **`GeminiService.ts`**: This TypeScript file exports a service class (or set of functions) responsible for direct interaction with the Google Gemini AI model. It handles API calls, authentication (e.g., API key management), sending text for translation, and receiving the translated text.
- **`PromptGenerator.ts`**: This module is designed to create effective and well-structured prompts to be sent to the translation service (i.e., the Gemini model via `GeminiService.ts`). Crafting good prompts is crucial for obtaining accurate and contextually appropriate translations from large language models.

## Interaction

The typical workflow for translation using these services is as follows:

1.  Text that needs translation is identified (this text may have already been processed by modules in `server/services/textProcessing/`).
2.  `PromptGenerator.ts` is used to construct a suitable prompt. This might involve:
    *   Specifying source and target languages.
    *   Providing context (e.g., the domain of the text, a glossary of terms).
    *   Formatting the text according to the AI model's best practices.
    *   Including instructions for the desired tone or style of translation.
3.  The generated prompt (containing the text to be translated) is passed to `GeminiService.ts`.
4.  `GeminiService.ts` makes an API call to the Google Gemini endpoint, sending the prompt.
5.  The Gemini model processes the request and returns the translated text.
6.  `GeminiService.ts` receives the response, potentially performs some basic parsing or error handling, and returns the translated text to the caller.

## Usage

Other server-side services (e.g., a higher-level `TranslationOrchestrationService.ts` that might combine text processing with translation, or directly within API route handlers) would utilize these modules to get text translated.

**Example (Conceptual):**

```typescript
// In an API route handler or a higher-level translation service

import { GeminiService } from './services/translation/GeminiService'; // Adjust path as needed
import { PromptGenerator } from './services/translation/PromptGenerator';

// Potentially initialize GeminiService once, e.g., when the server starts,
// or create an instance when needed if it manages state or API keys internally.
const geminiService = new GeminiService({ apiKey: process.env.GEMINI_API_KEY });
const promptGenerator = new PromptGenerator({ /* options if any */ });

async function translateTextHandler(textToTranslate: string, sourceLang: string, targetLang: string): Promise<string> {
  try {
    // 1. Generate the prompt
    const prompt = promptGenerator.generateTranslationPrompt({
      text: textToTranslate,
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
      // other options like context, glossary
    });

    // 2. Get translation from GeminiService
    const translatedText = await geminiService.translate(prompt);
    // or geminiService.translateText(textToTranslate, sourceLang, targetLang, additionalOptions)
    // depending on GeminiService.ts's method signatures.

    if (!translatedText) {
      throw new Error('Translation failed or returned empty.');
    }

    return translatedText;

  } catch (error) {
    console.error('Error during translation:', error);
    throw new Error('Failed to translate text.'); // Or handle error appropriately
  }
}

// Example usage within an Express.js-like route:
// app.post('/api/translate', async (req, res) => {
//   const { text, source, target } = req.body;
//   try {
//     const translation = await translateTextHandler(text, source, target);
//     res.json({ translatedText: translation });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });
```

Developers would need to consult `GeminiService.ts` and `PromptGenerator.ts` for their specific class/method signatures, configuration options, and error handling mechanisms.
