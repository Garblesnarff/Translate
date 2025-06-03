# TypeScript Types Directory

## Purpose

This directory is dedicated to storing custom TypeScript type definitions, interfaces, and enums that are used throughout the client application. Centralizing these type definitions helps in maintaining type safety, improving code clarity, and providing well-defined data structures for various parts of the application.

## Important Files

This directory contains files that export various type definitions. Common practice is to group related types into a single file (e.g., all types related to PDF processing in `pdf.ts`).

Current type definition files include:

- **`pdf.ts`**: This file likely contains TypeScript interfaces and types related to PDF document structures, processing, or data extracted from PDFs. For example, it might define `PdfDocument`, `PdfPage`, `TextBlock`, etc.
- **`translation.ts`**: This file probably defines types and interfaces for translation-related data structures, such as `TranslationRequest`, `TranslationResponse`, `LanguageCode`, or `GlossaryEntry`.

As the application evolves, more type definition files may be added to represent other data models or complex object shapes.

## Interaction

The type definitions and interfaces exported from files in this directory are imported and utilized across the client application's codebase. This includes:

- **Components**: To define the shape of props (`Props`) and state (`State`).
- **Functions**: To type function parameters and return values.
- **Hooks**: To define the types for hook arguments, return values, or internal state.
- **Library modules (`lib/`)**: To ensure type consistency for data being passed to or returned from utility functions.
- **API calls**: To type request payloads and expected responses.

By using these shared types, TypeScript can enforce data consistency and catch potential errors during development, leading to more robust and maintainable code.

## Usage

Types and interfaces are imported using the `import type { ... } from '...'` syntax (or just `import { ... } from '...'` if also importing values, though `import type` is more explicit for types).

Here's a simple example of how a type might be imported and used in a React component or a function:

**Example 1: Typing component props**

```typescript jsx
// Assuming 'translation.ts' exports an interface 'TranslationJob'
import type { TranslationJob } from '@/types/translation'; // Using path alias '@' for 'src'

interface MyComponentProps {
  job: TranslationJob;
  onComplete: (jobId: string) => void;
}

function MyComponent({ job, onComplete }: MyComponentProps) {
  // Component logic using the typed 'job' prop
  return (
    <div>
      <h2>Translation Job: {job.id}</h2>
      <p>Status: {job.status}</p>
      <button onClick={() => onComplete(job.id)}>Mark Complete</button>
    </div>
  );
}
```

**Example 2: Typing function parameters and return value**

```typescript
// Assuming 'pdf.ts' exports an interface 'PdfTextBlock'
import type { PdfTextBlock } from '@/types/pdf';

function processTextBlocks(blocks: PdfTextBlock[]): string {
  return blocks.map(block => block.text).join('\\n');
}
```

By defining and using these types, developers get better autocompletion, error checking, and overall understanding of the data structures being manipulated within the application.
The import path might vary based on project configuration (e.g., usage of path aliases like `@/`).
