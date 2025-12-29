# Project Overview

## PROJECT OVERVIEW
**Name:** Tibetan Translation Pipeline (rest-express)
**One-liner:** Full-stack Tibetan-to-English translation application with AI-powered translation, knowledge graph extraction, and automated content pipeline.
**Purpose:** Automate the translation of Tibetan Buddhist texts from the Sakya Monastery into English, extracting entities (people, places, lineages, teachings) into a knowledge graph. Part of a larger content generation pipeline for producing social media, blogs, podcasts, and documentaries from monastery archives.

## CURRENT STATE
**Status:** Active development (production-ready core, expanding knowledge graph features)
**Last meaningful work:** Enhanced event and place extraction with new entity types and categories; updated entity schemas and database structure
**What's working:**
- Core translation API with streaming support
- PDF upload and text extraction
- Batch translation processing with job queue
- Multi-model translation (Gemini, OpenAI, Anthropic providers)
- Knowledge graph entity extraction (people, places, texts, events, lineages, concepts, institutions, deities)
- Neo4j graph database integration
- Entity resolution and deduplication
- Network, timeline, map, and lineage visualizations
- Rate limiting and API key authentication
- Dual SQLite/PostgreSQL database support

**What's broken/incomplete:**
- SQLite timestamp formatting issue (translation works but database save has timestamp fix needed)
- n8n workflow integration pending testing
- VPS deployment not yet complete

**Next logical step:** Import and test n8n workflows for automated daily content generation

## TECH STACK
- **Runtime:** Node.js with TypeScript (tsx for dev, esbuild for production)
- **Framework:** Express.js (backend), React 18 + Vite (frontend)
- **Database:** PostgreSQL (production) / SQLite (local dev) via Drizzle ORM; Neo4j for knowledge graph
- **Deployment:** Planned for Hetzner VPS ($8/month CX22), Docker-ready
- **Key dependencies:**
  - `@google/generative-ai` - Gemini translation models
  - `drizzle-orm` - Database ORM with type safety
  - `neo4j-driver` - Graph database for entity relationships
  - `@tanstack/react-query` - Server state management
  - `pdfjs-dist` / `pdf-parse` - PDF text extraction
  - `tesseract.js` - OCR for scanned documents

## KEY FILES
- `server/index.ts` - Express server entry point, port configuration
- `server/routes.ts` - API route definitions with controller mappings
- `server/services/translationService.ts` - Core translation orchestration
- `server/controllers/translationController.ts` - Translation API handlers
- `server/controllers/knowledgeGraphController.ts` - Entity extraction endpoints
- `server/services/knowledgeGraph/EntityExtractor.ts` - AI-powered entity extraction
- `db/schema.ts` - Complete database schema (translations, entities, relationships, lineages)
- `client/src/pages/Translate.tsx` - Main translation UI
- `client/src/pages/NetworkPage.tsx` - Knowledge graph visualization
- `server/providers/translation/` - Multi-provider translation (Gemini, OpenAI, Anthropic)

## ENTRY POINTS
- **Run dev:** `npm run dev` (serves on port 5001, requires GEMINI_API_KEY_ODD/EVEN)
- **Build:** `npm run build`
- **Test:** `npm run test` (vitest)
- **Type check:** `npm run check`
- **DB push:** `npm run db:push` (PostgreSQL) or `npm run db:push --config=./drizzle.sqlite.config.ts` (SQLite)
- **Deploy:** Docker build (Dockerfile present), planned for Hetzner VPS

## CONNECTIONS
- **Depends on:**
  - Google Gemini API (primary translation)
  - OpenAI API (alternative provider)
  - Anthropic API (alternative provider)
  - Neo4j (graph database, via docker-compose)
  - n8n (workflow automation, localhost:5678)
- **Used by:** Planned n8n workflows for automated content generation (6am wisdom posts, podcasts, fiction stories, dev blogs)
- **Related repos:** None (self-contained)

## API ENDPOINTS (Core)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/translate` | POST | Single document translation |
| `/api/translate/stream` | POST | Streaming translation with progress |
| `/api/batch/translate` | POST | Batch process multiple PDFs |
| `/api/batch/status/:jobId` | GET | Check batch job progress |
| `/api/translations/recent` | GET | Get recent translations |
| `/api/translations/:id` | GET | Get specific translation |
| `/api/kg/extract` | POST | Extract entities from translation |
| `/api/kg/entities/:translationId` | GET | Get entities for translation |
| `/api/kg/batch/extract` | POST | Batch entity extraction |
| `/api/graph/*` | Various | Neo4j graph queries (lineages, paths, networks) |

## ENVIRONMENT VARIABLES
```
DATABASE_URL=postgresql://...  # Production only
GEMINI_API_KEY_ODD=...         # Required for translation
GEMINI_API_KEY_EVEN=...        # Required for parallel translation
OPENAI_API_KEY=...             # Optional alternative provider
ANTHROPIC_API_KEY=...          # Optional alternative provider
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=...
```
