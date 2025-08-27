# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build both client and server for production
- `npm run start` - Start production server
- `npm run check` - Run TypeScript type checking
- `npm run db:push` - Push database schema changes using Drizzle

## Project Architecture

This is a full-stack TypeScript application for Tibetan text translation with AI assistance. The application uses React for the frontend, Express for the backend, and PostgreSQL for data persistence.

### Tech Stack

**Frontend:**
- React with TypeScript and Vite
- Wouter for routing
- Radix UI components with shadcn/ui
- TanStack Query for API state management
- Tailwind CSS for styling

**Backend:**
- Express.js with TypeScript
- Google Gemini AI for translation services
- Drizzle ORM with PostgreSQL
- File upload support (PDF processing)
- Rate limiting and error handling middleware

### Key Components and Services

**Client Structure (`/client/src/`):**
- `pages/Home.tsx` - Landing page with feature overview
- `pages/Translate.tsx` - Main translation interface with dual-pane layout
- `components/TranslationPane.tsx` - Reusable text display/editing component
- `components/UploadDialog.tsx` - File upload handling
- `lib/gemini.ts` - Frontend translation API integration
- `lib/textExtractor.ts` - PDF text extraction utilities

**Server Structure (`/server/`):**
- `routes.ts` - API endpoints for translation, PDF generation, and dictionary
- `services/translationService.ts` - Core translation orchestration
- `services/translation/GeminiService.ts` - Google Gemini AI integration
- `services/pdf/PDFGenerator.ts` - PDF export functionality
- `dictionary.ts` - Tibetan-English dictionary management
- `middleware/` - Error handling and request logging

**Database (`/db/`):**
- `schema.ts` - Drizzle schema definitions for translations and dictionary tables
- Uses PostgreSQL with environment-based configuration

### Enhanced Translation Workflow

1. **File Upload**: PDFs are uploaded and text is extracted using pdf-parse
2. **Text Chunking**: Large texts are split into manageable chunks/pages
3. **Multi-Model Translation**: Each chunk processed through:
   - Primary Gemini translation with enhanced prompts
   - Helper AI validation (Qwen/DeepSeek) if configured
   - Consensus building between models
   - Iterative refinement based on quality scores
4. **Quality Analysis**: Comprehensive quality metrics including:
   - Dictionary usage scoring
   - Structural integrity analysis
   - Terminology consistency checks
   - Natural language flow assessment
5. **Dictionary Integration**: Custom Tibetan dictionary provides contextual translations
6. **PDF Export**: Enhanced translations exported as formatted PDFs

### Environment Requirements

- `DATABASE_URL` - PostgreSQL connection string
- `GEMINI_API_KEY_ODD` - Google Gemini API key for odd pages
- `GEMINI_API_KEY_EVEN` - Google Gemini API key for even pages
- `QWEN_API_KEY` - (Optional) Qwen API key for helper AI translations
- `DEEPSEEK_API_KEY` - (Optional) DeepSeek API key for helper AI translations

### Enhanced Translation Features

**Multi-Model Consensus:**
- Primary translation with Google Gemini 2.0 Flash
- Optional helper AI validation with Qwen/DeepSeek
- Consensus mechanism for improved accuracy
- Model agreement scoring

**Quality Analysis:**
- Dictionary usage assessment
- Structural integrity verification
- Terminology consistency checking
- Natural language flow evaluation
- Overall quality grading (Excellent/Good/Fair/Poor)

**Iterative Refinement:**
- Multi-pass translation with specialized prompts
- Focus area identification for each iteration
- Quality-based stopping criteria
- Chain-of-thought reasoning for complex passages

**Advanced Prompting:**
- Few-shot examples based on text type (religious/philosophical/historical)
- Context-aware prompting with document continuity
- Buddhist terminology expertise
- Sliding window context for better consistency

### Development Notes

- The app uses a dual-pane interface with resizable panels for source and translated text
- Enhanced translation processing with comprehensive quality metrics
- Rate limiting is implemented (100 requests per 15-minute window)
- File upload limit is 50MB
- Translation timeout increased to 2 minutes for enhanced processing
- The application supports both development (Vite) and production (static) serving modes
- Enhanced mode is enabled by default, legacy mode available for compatibility

### API Endpoints

**Core Translation:**
- `POST /api/translate` - Enhanced translation endpoint with quality analysis
  - Query parameters: `enhanced`, `useHelperAI`, `useMultiPass`, `maxIterations`, `qualityThreshold`
- `POST /api/generate-pdf` - PDF generation from translation pages  
- `GET /api/dictionary/entries` - Retrieve dictionary context

**Translation Management:**
- `GET /api/translation/capabilities` - Get available models and features
- `GET /api/translation/config` - Get current translation configuration
- `POST /api/translation/config` - Update translation settings

### Testing and Quality

**Configuration Options:**
- `useHelperAI`: Enable multi-model validation (default: true)
- `useMultiPass`: Enable iterative refinement (default: true) 
- `maxIterations`: Maximum refinement passes (default: 3)
- `qualityThreshold`: Minimum quality score to stop refinement (default: 0.8)
- `useChainOfThought`: Enable step-by-step reasoning (default: false)
- `enableQualityAnalysis`: Generate quality metrics (default: true)

Run `npm run check` to verify TypeScript compilation before committing changes.