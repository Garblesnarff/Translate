import { useState } from 'react';

const GEMINI_API_ENDPOINT = '/api/translate';

export interface TranslationResult {
  translatedText: string;
  confidence: number;
}

export const useTranslation = () => {
  const [isTranslating, setIsTranslating] = useState(false);
  const [progress, setProgress] = useState(0);

  const translate = async (text: string): Promise<TranslationResult> => {
    setIsTranslating(true);
    setProgress(0);
    
    try {
      const response = await fetch(GEMINI_API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error('Translation failed');
      }

      const reader = response.body?.getReader();
      let translatedText = '';
      
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          translatedText += new TextDecoder().decode(value);
          setProgress((prev) => Math.min(prev + 10, 90));
        }
      }

      setProgress(100);
      return {
        translatedText,
        confidence: 0.95, // Mock confidence score
      };
    } finally {
      setIsTranslating(false);
    }
  };

  return {
    translate,
    isTranslating,
    progress,
  };
};
