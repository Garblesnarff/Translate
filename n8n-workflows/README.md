# n8n Integration for Sakya Monastery Translation Pipeline

## Quick Setup

### Prerequisites
1. ✅ Translation API running on `http://localhost:5001`
2. ✅ n8n running on `http://localhost:5678` 
3. ✅ Environment variables set for Gemini API keys

### Import Workflows

1. **Open n8n UI**: http://localhost:5678
2. **Import Test Workflow**:
   - Click "Import from File" 
   - Select `test-translation-api.json`
   - This tests basic API connectivity

3. **Import Content Pipeline**:
   - Click "Import from File"
   - Select `monastery-content-pipeline.json` 
   - This is your full automation pipeline

## Workflow Descriptions

### 1. Test Translation API (`test-translation-api.json`)
**Purpose**: Verify your translation API is working with n8n

**Features**:
- ✅ Calls `/api/translations/recent` 
- ✅ Calls `/api/dictionary/entries`
- ✅ Tests `/api/translate` with sample text
- ✅ Webhook endpoint for external triggers
- ✅ Success/error handling

**Usage**:
- Manual trigger to test connectivity
- Webhook at `http://localhost:5678/webhook/translation-test`

### 2. Monastery Content Pipeline (`monastery-content-pipeline.json`)
**Purpose**: Full automation for daily content generation

**Features**:
- 🕕 **6AM Daily Trigger**: Automatic content generation
- 📤 **PDF Upload**: Webhook for batch processing monastery texts
- 🎯 **Daily Wisdom**: Selects random translation for daily content
- 🧠 **AI Enhancement**: Uses Gemini to create modern interpretations  
- 💾 **Content Storage**: Saves formatted blog posts
- 📊 **Progress Monitoring**: Tracks batch translation jobs

**Triggers**:
- Daily at 6AM for wisdom posts
- Webhook at `http://localhost:5678/webhook/monastery-upload` for PDFs

## Testing the Integration

### Step 1: Test Basic API
1. Import `test-translation-api.json`
2. Click "Execute Workflow" 
3. Should see successful API calls to your translation service

### Step 2: Test Content Pipeline
1. Import `monastery-content-pipeline.json`
2. Manually trigger the daily content workflow
3. Check that it generates a wisdom post from existing translations

### Step 3: Test PDF Upload
```bash
curl -X POST http://localhost:5678/webhook/monastery-upload \\
  -F "file=@your-tibetan-text.pdf"
```

## API Integration Points

Your n8n workflows call these endpoints:

- `GET /api/translations/recent` - Get recent translations for daily content
- `POST /api/translate` - Single text translation  
- `POST /api/batch/translate` - Batch PDF processing
- `GET /api/batch/status/:jobId` - Monitor batch progress
- `GET /api/dictionary/entries` - Dictionary context

## Content Output

Generated content is saved to:
- `monastery-content/daily-wisdom/YYYY-MM-DD-wisdom.md`

Each file contains:
- Original Tibetan text
- English translation  
- AI-generated modern interpretation
- Meditation instructions
- Reflection questions
- Translation metadata

## Next Steps

1. **Test the workflows** with your translation API
2. **Customize content templates** in the JavaScript nodes
3. **Add more triggers** (RSS feeds, email, etc.)
4. **Integrate with social media** APIs for posting
5. **Add podcast generation** using text-to-speech
6. **Connect to your VPS** when ready for production

## Troubleshooting

- **API Connection Issues**: Ensure translation service is running on port 5001
- **Webhook Not Working**: Check n8n webhook URLs match your calls
- **Gemini Integration**: Verify your Google AI Studio API key is configured in n8n
- **File Permissions**: Ensure n8n can write to content directories