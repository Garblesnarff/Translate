# Text Processing Services

## Purpose

This directory (`server/services/textProcessing/`) houses a collection of modules dedicated to various text processing and manipulation tasks. These services are likely used on the server-side to prepare, refine, or transform text before it undergoes other operations (such as translation by an AI model), is stored, or is sent to the client for display.

The goal is to encapsulate specific text transformation logic, making it reusable and maintainable.

## Important Files

The key modules within this directory include:

- **`HeaderFormatter.ts`**: Contains logic for formatting or standardizing headers within a given text. This might involve adjusting levels, adding numbering, or ensuring consistent styling cues.
- **`LineageFormatter.ts`**: Likely deals with formatting text that represents lineage, pedigrees, or hierarchical structures, ensuring proper indentation or notation.
- **`SpacingEnhancer.ts`**: Focuses on improving the spacing within text. This could include normalizing multiple spaces, ensuring correct spacing around punctuation, or applying specific spacing rules for readability, particularly for languages like Tibetan.
- **`TermProcessor.ts`**: Handles the processing of specific terms or terminology within a text. This might involve identifying defined terms, applying consistent formatting, or preparing them for a glossary or translation memory.
- **`TextProcessor.ts`**: This module likely acts as a central orchestrator for text processing tasks. It might provide a primary class or function that chains together various specialized processors (like `HeaderFormatter`, `SpacingEnhancer`, etc.) to apply a sequence of transformations. Alternatively, it could be a collection of more general text processing utility functions.
- **`constants.ts`**: Stores constant values (e.g., regular expressions, special characters, default settings) used by one or more of the text processing modules in this directory.
- **`types.ts`**: Defines TypeScript interfaces and type aliases specific to the data structures and parameters used within the text processing services (e.g., `TextProcessingOptions`, `FormattedLine`).

## Interaction

These modules typically take text strings (or structured text representations) as input. Each specialized module (`HeaderFormatter`, `LineageFormatter`, `SpacingEnhancer`, `TermProcessor`) applies specific transformations or analyses based on its designated purpose.

The `TextProcessor.ts` module might:
- Expose a primary method that accepts raw text and a configuration.
- Internally instantiate or call methods from the other specialized modules in a predefined or configurable order.
- Manage the flow of text through this pipeline of processing steps.

The `constants.ts` file provides shared, immutable values to ensure consistency, while `types.ts` ensures type safety for the data being passed between these modules.

## Usage

Other server-side services (e.g., a translation orchestration service, content ingestion pipelines) or API route handlers would import and use these text processing modules to preprocess text before further actions or postprocess text received from other systems.

**Example (Conceptual):**

```typescript
// In another server-side service, e.g., a translation pipeline

import { TextProcessor } from './services/textProcessing/TextProcessor'; // Adjust path as needed
// Or import specific processors if TextProcessor is not an orchestrator:
// import { SpacingEnhancer } from './services/textProcessing/SpacingEnhancer';

async function handleIncomingTextForTranslation(rawText: string): Promise<string> {
  // Assuming TextProcessor orchestrates various formatting steps
  const textProcessor = new TextProcessor({
    // Configuration options for the processor
    enhanceSpacing: true,
    formatHeaders: true,
  });

  let processedText = await textProcessor.process(rawText);

  // Alternatively, if using individual processors:
  // const spacingEnhancer = new SpacingEnhancer();
  // processedText = spacingEnhancer.enhance(rawText);
  // const headerFormatter = new HeaderFormatter();
  // processedText = headerFormatter.format(processedText);

  // Now, 'processedText' can be sent to a translation model or another service
  // const translation = await translationService.translate(processedText);

  return processedText; // Or the translation
}
```

Developers would refer to the specific exports and methods of each module (especially `TextProcessor.ts`) to understand how to integrate and configure these text processing capabilities.
