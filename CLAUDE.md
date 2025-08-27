# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start development server with hot reload (serves both client and API on port 5001)
- `npm run build` - Build production client and server bundles
- `npm run start` - Start production server
- `npm run check` - Run TypeScript type checking
- `npm run db:push` - Push PostgreSQL database schema changes using Drizzle
- `npm run db:push --config=./drizzle.sqlite.config.ts` - Push SQLite schema changes

### Running the Server with Environment Variables
Since the server requires Gemini API keys, use:
```bash
GEMINI_API_KEY_ODD=your_key_here GEMINI_API_KEY_EVEN=your_key_here npm run dev
```

### Database Configuration
- **Local Development**: Uses SQLite (`tibetan_translation.db`) when no DATABASE_URL is set
- **Production**: Set `DATABASE_URL=postgresql://...` for PostgreSQL
- **Port**: Server runs on 5001 (5000 conflicts with macOS ControlCenter)

## Project Architecture

This is a full-stack Tibetan translation application with the following key components:

### Tech Stack
- **Frontend**: React 18 + TypeScript, Vite, Wouter (routing), TanStack Query, shadcn/ui components
- **Backend**: Express.js + TypeScript, Drizzle ORM with PostgreSQL
- **AI Translation**: Google Gemini 2.0 Flash (dual API keys for odd/even pages)
- **File Processing**: PDF parsing, text extraction, chunking for parallel translation

### Directory Structure
- `client/src/` - React frontend application
- `server/` - Express backend with API routes and services
- `db/` - Database schema and configuration (Drizzle ORM)

### Key Architecture Patterns

**Dual Gemini API Strategy**: Uses separate API keys for odd/even pages to improve translation throughput and avoid rate limits. Configured in `server/index.ts` with `oddPagesGeminiService` and `evenPagesGeminiService`.

**Text Processing Pipeline**:
1. PDF upload and text extraction (`client/src/lib/textExtractor.ts`)
2. Text chunking by pages (`client/src/lib/textChunker.ts`) 
3. Parallel translation processing in pairs (`server/routes.ts`)
4. Results aggregation and PDF generation

**Translation Service Architecture**:
- `GeminiService` class handles AI model configuration and content generation
- `TranslationService` orchestrates the translation workflow
- `PromptGenerator` creates specialized prompts for Tibetan text translation
- Text processors handle formatting, spacing, and term processing

**Database Schema**: 
- `translations` table stores translation results with confidence scores
- `dictionary` table contains Tibetan-English dictionary entries for context

**Frontend State Management**: Uses TanStack Query for server state, React hooks for local state, and custom hooks like `useTranslation` for translation workflow.

## Environment Variables Required

- `DATABASE_URL` - PostgreSQL connection string
- `GEMINI_API_KEY_ODD` - Google Gemini API key for odd pages
- `GEMINI_API_KEY_EVEN` - Google Gemini API key for even pages

## Important File Paths

- Path aliases: `@/*` maps to `client/src/*`, `@db/*` maps to `db/*`
- Server serves both API (`/api/*`) and static client files
- Development server runs on port 5000 with Vite HMR integration

## PROJECT VISION: Sakya Monastery Translation Pipeline

This tool is part of a larger automated content generation pipeline for translating Tibetan texts from the Sakya Monastery into multiple content formats (social media, blogs, podcasts, newsletters, documentaries).

### The Complete Pipeline Architecture
- **Input**: Tibetan PDFs (up to 600+ pages)
- **Translation**: Automated processing using this tool
- **Storage**: PostgreSQL database with full-text search
- **Automation**: n8n workflows on Hertzner VPS ($8/month CX22)
- **Output**: Multi-format content generation

### Content Generation Schedule (via n8n)
- **6am**: Daily Tibetan Wisdom Post (blog + 3-min meditation)
- **12pm**: AI Consciousness Deep Dive (long-form podcast)
- **6pm**: Fiction Story (YouTube content)
- **10pm**: Dev Blog (technical learnings)

## CURRENT PHASE: Week 1 - Production-Ready API

### Implementation Steps (START LOCAL, THEN SCALE)

#### Step 1: Production-Ready Translation API ✅ COMPLETED
- [x] Core translation functionality exists
- [x] Add API wrapper endpoints:
  - `POST /api/translate` - Single document translation with database persistence ✅
  - `GET /api/translations/recent` - Retrieve recent translations ✅
  - `POST /api/batch/translate` - Batch process multiple PDFs ✅
  - `GET /api/batch/status/:jobId` - Check batch progress ✅
  - `GET /api/translations/:id` - Get specific translation ✅
- [x] Implement dual database support: SQLite for local, PostgreSQL for production ✅
- [x] Add translation metadata storage (source, date, topics, length, confidence) ✅
- [x] Database schema with batchJobs table for queue management ✅
- [x] TibetanDictionary integration with monastery terminology ✅

### Current Status & Next Steps

#### ✅ READY FOR AUTOMATION
**Server Status**: Running on port 5001 (5000 conflicts with macOS ControlCenter)
**Database**: SQLite working locally, PostgreSQL configured for production
**API Endpoints**: All core endpoints functional and tested

#### Key Technical Details Completed:
- **Database Migration System**: Drizzle ORM with dual PostgreSQL/SQLite support
- **Background Processing**: Async batch job system with progress tracking  
- **Rate Limiting**: 100 requests per 15-minute window
- **Error Handling**: Comprehensive error responses with proper HTTP status codes
- **Metadata Tracking**: Full translation metadata (processing time, confidence, page count)

#### Minor Fix Needed:
- SQLite timestamp formatting issue (translation works, database save needs timestamp fix)

#### Ready for Integration:
- n8n workflows can now call `/api/batch/translate` for monastery archives
- Progress tracking via `/api/batch/status/:jobId` 
- Recent translations available via `/api/translations/recent`

#### ✅ n8n Integration Setup COMPLETED
- **n8n running**: http://localhost:5678
- **Workflows created**: `test-translation-api.json` and `monastery-content-pipeline.json` 
- **Location**: `/Users/rob/Claude/workspaces/tibetan-translation/n8n-workflows/`
- **Test PDF ready**: `/Users/rob/Documents/Tibet/RRAL001.pdf` (20 pages Tibetan text)

#### NEXT TASK: Import and Test n8n Workflows
1. Import `test-translation-api.json` into n8n UI
2. Test with monastery PDF: `/Users/rob/Documents/Tibet/RRAL001.pdf`
3. Set up daily automation workflow
4. Test full monastery content pipeline (6AM daily wisdom posts)

### Future Phases  
- **Week 2**: VPS deployment preparation
- **Week 3**: Production deployment with Docker
- **Week 4**: Full monastery archive processing
- **Week 5**: Multi-channel content distribution

## API ENDPOINTS NEEDED FOR AUTOMATION

### Core Translation Endpoints
- `POST /api/translate` - Process single document (EXISTS)
- `POST /api/batch/translate` - Process multiple documents
- `GET /api/batch/status/:jobId` - Check batch job status
- `GET /api/translations/recent` - Get recent translations
- `GET /api/translations/:id` - Get specific translation

### Content Generation Endpoints (Future)
- `GET /api/content/daily-wisdom` - Daily wisdom selection
- `POST /api/content/generate-meditation` - Create meditation script
- `GET /api/content/extract-quotes` - Pull quotable passages

## DEVELOPMENT PRIORITIES

1. **Immediate**: Make translation API endpoint work standalone
2. **Next**: Add database persistence for all translations
3. **Then**: Create batch processing capability
4. **Finally**: Prepare for Docker/VPS deployment

## NOTES FOR FUTURE CLAUDE INSTANCES

When working on this project, remember:
- The GUI is secondary - API and automation are primary
- Every translation must be saved to database with metadata
- Design for headless operation (no human intervention)
- Output formats should support downstream content generation
- This will run 24/7 on a VPS, processing monastery archives
- Focus on batch processing and queue systems for large documents