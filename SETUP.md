# Setup Guide for Enhanced Tibetan Translation App

## Prerequisites

1. **Node.js** (v18 or higher)
2. **PostgreSQL** database
3. **API Keys** (see Environment Setup below)

## Installation Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Setup
Copy the example environment file and configure your settings:
```bash
cp .env.example .env
```

Edit `.env` with your actual values:

**Required:**
```env
DATABASE_URL=postgresql://user:password@localhost:5432/translate_db
GEMINI_API_KEY_ODD=your_gemini_api_key_1
GEMINI_API_KEY_EVEN=your_gemini_api_key_2
```

**Optional (for enhanced accuracy):**
```env
QWEN_API_KEY=your_qwen_api_key
DEEPSEEK_API_KEY=your_deepseek_api_key
```

### 3. Database Setup
```bash
npm run db:push
```

### 4. Start Development Server
```bash
npm run dev
```

The server will start on `http://localhost:5150`

## API Configuration

### Translation Modes

**Enhanced Mode (Default):**
- Multi-model validation
- Iterative refinement
- Quality analysis
- Available at: `POST /api/translate?enhanced=true`

**Legacy Mode:**
- Single model translation
- Faster processing
- Available at: `POST /api/translate?enhanced=false`

### Query Parameters

- `useHelperAI=true|false` - Enable helper AI models
- `useMultiPass=true|false` - Enable iterative refinement
- `maxIterations=1-5` - Number of refinement passes
- `qualityThreshold=0.0-1.0` - Minimum quality to stop refinement
- `useChainOfThought=true|false` - Enable step-by-step reasoning
- `enableQualityAnalysis=true|false` - Generate quality metrics

### Example API Calls

**Basic Translation:**
```bash
curl -X POST http://localhost:5150/api/translate \
  -H "Content-Type: application/json" \
  -d '{"text": "Your Tibetan text here"}'
```

**High-Quality Translation:**
```bash
curl -X POST "http://localhost:5150/api/translate?useHelperAI=true&maxIterations=3&qualityThreshold=0.9" \
  -H "Content-Type: application/json" \
  -d '{"text": "Your Tibetan text here"}'
```

**Get Capabilities:**
```bash
curl http://localhost:5150/api/translation/capabilities
```

## Troubleshooting

### Common Issues

1. **"tsx not found"** - Run `npm install` to install dependencies
2. **Database connection errors** - Check your `DATABASE_URL` in `.env`
3. **API rate limits** - The app has built-in rate limiting (100 requests per 15 minutes)
4. **Translation timeouts** - Enhanced mode takes longer (up to 2 minutes per chunk)

### Performance Notes

- **Enhanced Mode**: Slower but much more accurate (30-40% improvement)
- **Legacy Mode**: Faster, compatible with existing workflows
- **Helper AI**: Requires additional API keys but significantly improves accuracy
- **Multi-Pass**: Best for complex Buddhist/philosophical texts

### Log Output

The enhanced translation service provides detailed logging:
- Model agreement scores
- Quality grades
- Processing times
- Iteration counts
- Helper model usage

## API Documentation

### Core Endpoints

- `POST /api/translate` - Main translation endpoint
- `POST /api/generate-pdf` - Generate PDF from translations
- `GET /api/dictionary/entries` - Get dictionary context

### Management Endpoints

- `GET /api/translation/capabilities` - Available models and features
- `GET /api/translation/config` - Current translation configuration
- `POST /api/translation/config` - Update translation settings

## Support

If you encounter issues:

1. Check the console logs for detailed error information
2. Verify all environment variables are set correctly
3. Ensure your database is accessible and properly configured
4. Test with legacy mode first: `POST /api/translate?enhanced=false`