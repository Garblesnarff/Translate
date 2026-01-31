# Semantic Chunking Examples

## Example 1: Page-Based Strategy (Backward Compatible)

### Input Text
```
1 བླ་མ་དང་དཀོན་མཆོག་གསུམ་ལ་ཕྱག་འཚལ་ལོ། སངས་རྒྱས་ཆོས་དང་དགེ་འདུན་ལ་སྐྱབས་སུ་མཆི།
2 བདག་སོགས་འགྲོ་བ་མཐའ་དག་གི། བླ་ན་མེད་པའི་བྱང་ཆུབ་ཐོབ་པར་ཤོག།
3 སེམས་ཅན་ཐམས་ཅད་བདེ་བ་དང་བདེ་བའི་རྒྱུ་དང་ལྡན་པར་གྱུར་ཅིག།
```

### Output
```javascript
[
  {
    pageNumber: 1,
    text: "བླ་མ་དང་དཀོན་མཆོག་གསུམ་ལ་ཕྱག་འཚལ་ལོ། སངས་རྒྱས་ཆོས་དང་དགེ་འདུན་ལ་སྐྱབས་སུ་མཆི།",
    hasOverlap: false,
    tokenCount: 20,
    chunkingStrategy: "page",
    sentenceCount: 2
  },
  {
    pageNumber: 2,
    text: "བདག་སོགས་འགྲོ་བ་མཐའ་དག་གི། བླ་ན་མེད་པའི་བྱང་ཆུབ་ཐོབ་པར་ཤོག།",
    hasOverlap: true,
    overlapText: "སངས་རྒྱས་ཆོས་དང་དགེ་འདུན་ལ་སྐྱབས་སུ་མཆི།", // Last sentence from Page 1
    tokenCount: 35,
    chunkingStrategy: "page",
    sentenceCount: 2
  },
  {
    pageNumber: 3,
    text: "སེམས་ཅན་ཐམས་ཅད་བདེ་བ་དང་བདེ་བའི་རྒྱུ་དང་ལྡན་པར་གྱུར་ཅིག།",
    hasOverlap: true,
    overlapText: "བདག་སོགས་འགྲོ་བ་མཐའ་དག་གི། བླ་ན་མེད་པའི་བྱང་ཆུབ་ཐོབ་པར་ཤོག།", // Last 2 sentences from Page 2
    tokenCount: 29,
    chunkingStrategy: "page",
    sentenceCount: 1
  }
]
```

**Strategy**: Page-based (each numbered paragraph becomes a chunk)
**Overlap**: Last 2 sentences from previous chunk included for context

---

## Example 2: Semantic Strategy (No Page Numbers)

### Input Text
Long continuous Tibetan text (~685 tokens) with no page markers

### Output
```javascript
[
  {
    pageNumber: 1,
    text: "བླ་མ་དང་དཀོན་མཆོག་གསུམ་ལ་ཕྱག་འཚལ་ལོ། ... [18 sentences]",
    hasOverlap: false,
    tokenCount: 198,
    chunkingStrategy: "semantic",
    sentenceCount: 18
  },
  {
    pageNumber: 2,
    text: "[overlap sentences] + [17 new sentences]",
    hasOverlap: true,
    overlapText: "[last 2 sentences from chunk 1]",
    tokenCount: 199,
    chunkingStrategy: "semantic",
    sentenceCount: 17
  },
  {
    pageNumber: 3,
    text: "[overlap sentences] + [17 new sentences]",
    hasOverlap: true,
    overlapText: "[last 2 sentences from chunk 2]",
    tokenCount: 195,
    chunkingStrategy: "semantic",
    sentenceCount: 17
  },
  {
    pageNumber: 4,
    text: "[overlap sentences] + [9 new sentences]",
    hasOverlap: true,
    overlapText: "[last 2 sentences from chunk 3]",
    tokenCount: 118,
    chunkingStrategy: "semantic",
    sentenceCount: 9
  }
]
```

**Strategy**: Semantic (sentence-based, no page markers detected)
**Token Limit**: Each chunk stays under 200 tokens (maxTokens config)
**Sentence Preservation**: Never splits mid-sentence

---

## Example 3: Hybrid Strategy (Large Pages)

### Input Text
```
1 [Very long text - 1700 tokens]
2 བདག། [Short text - 20 tokens]
3 [Very long text - 1700 tokens]
```

### Output
```javascript
[
  // Page 1 split semantically (too large for one chunk)
  {
    pageNumber: 1.0,
    text: "[44 sentences]",
    hasOverlap: false,
    tokenCount: 495,
    chunkingStrategy: "hybrid",
    sentenceCount: 44
  },
  {
    pageNumber: 1.1,
    text: "[overlap] + [44 sentences]",
    hasOverlap: true,
    tokenCount: 500,
    chunkingStrategy: "hybrid",
    sentenceCount: 44
  },
  {
    pageNumber: 1.2,
    text: "[overlap] + [44 sentences]",
    hasOverlap: true,
    tokenCount: 493,
    chunkingStrategy: "hybrid",
    sentenceCount: 44
  },
  {
    pageNumber: 1.3,
    text: "[overlap] + [19 sentences]",
    hasOverlap: true,
    tokenCount: 229,
    chunkingStrategy: "hybrid",
    sentenceCount: 19
  },

  // Page 2 stays intact (small enough)
  {
    pageNumber: 2,
    text: "བདག།",
    hasOverlap: true,
    tokenCount: 20,
    chunkingStrategy: "page",
    sentenceCount: 1
  },

  // Page 3 split semantically (too large for one chunk)
  {
    pageNumber: 3.0,
    text: "[44 sentences]",
    hasOverlap: true,
    tokenCount: 500,
    chunkingStrategy: "hybrid",
    sentenceCount: 44
  },
  {
    pageNumber: 3.1,
    text: "[44 sentences]",
    hasOverlap: true,
    tokenCount: 500,
    chunkingStrategy: "hybrid",
    sentenceCount: 44
  },
  {
    pageNumber: 3.2,
    text: "[44 sentences]",
    hasOverlap: true,
    tokenCount: 493,
    chunkingStrategy: "hybrid",
    sentenceCount: 44
  },
  {
    pageNumber: 3.3,
    text: "[19 sentences]",
    hasOverlap: true,
    tokenCount: 229,
    chunkingStrategy: "hybrid",
    sentenceCount: 19
  }
]
```

**Strategy**: Hybrid (combines page-based and semantic)
**Decision Logic**:
- Page 1 & 3: Too large (>500 tokens) → Split semantically
- Page 2: Small enough → Keep intact
**Page Numbers**: Use decimals (1.0, 1.1, 1.2) to indicate sub-chunks

---

## Example 4: Mixed Tibetan-English Text

### Input Text
```
The word བླ་མ (lama) is important. སངས་རྒྱས means Buddha. Dr. Smith studied Tibetan Buddhism.
```

### Sentence Detection
```javascript
[
  {
    text: "The word བླ་མ (lama) is important.",
    hasTibetan: true,
    hasEnglish: true,
    endMarker: "."
  },
  {
    text: "སངས་རྒྱས means Buddha.",
    hasTibetan: true,
    hasEnglish: true,
    endMarker: "."
  },
  {
    text: "Dr. Smith studied Tibetan Buddhism.",
    hasTibetan: false,
    hasEnglish: true,
    endMarker: "."
    // Note: "Dr." correctly recognized as abbreviation, not sentence end
  }
]
```

**Key Feature**: Abbreviation handling prevents false sentence breaks at "Dr."

---

## Example 5: Tibetan Punctuation Handling

### Input Text
```
བླ་མ་ལ་ཕྱག་འཚལ། དཀོན་མཆོག་གསུམ་ལ་སྐྱབས་སུ་མཆི༎ སེམས་ཅན་ཐམས་ཅད་ཀྱི་དོན་དུ༑ བྱང་ཆུབ་སེམས་བསྐྱེད་དོ།
```

### Sentence Detection
```javascript
[
  {
    text: "བླ་མ་ལ་ཕྱག་འཚལ།",
    endMarker: "།",  // Shad - normal sentence end
    hasTibetan: true
  },
  {
    text: "དཀོན་མཆོག་གསུམ་ལ་སྐྱབས་སུ་མཆི༎",
    endMarker: "༎",  // Double Shad - section end
    hasTibetan: true
  },
  {
    text: "སེམས་ཅན་ཐམས་ཅད་ཀྱི་དོན་དུ༑",
    endMarker: "༑",  // Nyis Shad - enumeration marker
    hasTibetan: true
  },
  {
    text: "བྱང་ཆུབ་སེམས་བསྐྱེད་དོ།",
    endMarker: "།",  // Shad
    hasTibetan: true
  }
]
```

**Punctuation Recognized**:
- ། (Shad) - sentence end
- ༎ (Double Shad) - section end
- ༑ (Nyis Shad) - enumeration

**Not Sentence Ends**:
- ་ (Tsek) - syllable boundary (like spaces in English)

---

## Comparison: Old vs New System

### Old System
```javascript
// Input: "1 text1\n2 text2\n3 text3"
splitTextIntoChunks(text)
// Output:
[
  { pageNumber: 1, text: "text1" },
  { pageNumber: 2, text: "text2" },
  { pageNumber: 3, text: "text3" }
]
// ❌ No token limits
// ❌ No overlap
// ❌ No sentence awareness
// ❌ No metadata
```

### New System
```javascript
// Input: "1 text1\n2 text2\n3 text3"
splitTextIntoChunks(text)
// Output:
[
  {
    pageNumber: 1,
    text: "text1",
    hasOverlap: false,
    tokenCount: 150,
    chunkingStrategy: "page",
    sentenceCount: 5
  },
  {
    pageNumber: 2,
    text: "text2",
    hasOverlap: true,
    overlapText: "[last 2 sentences from page 1]",
    tokenCount: 200,
    chunkingStrategy: "page",
    sentenceCount: 6
  },
  {
    pageNumber: 3,
    text: "text3",
    hasOverlap: true,
    overlapText: "[last 2 sentences from page 2]",
    tokenCount: 175,
    chunkingStrategy: "page",
    sentenceCount: 5
  }
]
// ✅ Token limits enforced (3500 max)
// ✅ Context overlap (last 2 sentences)
// ✅ Sentence-aware (never splits mid-sentence)
// ✅ Rich metadata for analytics
```

---

## Configuration Examples

### Default Configuration
```typescript
const chunker = new SemanticChunker();
// maxTokens: 3500
// overlapSentences: 2
// preferPageBased: true
// minSentences: 1
```

### Smaller Chunks
```typescript
const chunker = new SemanticChunker({
  maxTokens: 2000,  // Smaller chunks for faster processing
  overlapSentences: 3  // More context
});
```

### Pure Semantic (Ignore Page Markers)
```typescript
const chunker = new SemanticChunker({
  preferPageBased: false  // Always use semantic strategy
});
```

### Minimal Overlap
```typescript
const chunker = new SemanticChunker({
  overlapSentences: 0  // No overlap between chunks
});
```

---

## Statistics Example

```typescript
import { getChunkingStats } from './lib/textChunker';

const stats = getChunkingStats(chunks);

console.log(stats);
// {
//   totalChunks: 4,
//   totalTokens: 710,
//   avgTokensPerChunk: 177.5,
//   maxTokens: 199,
//   minTokens: 118,
//   chunksWithOverlap: 1,
//   strategyCounts: {
//     page: 1,
//     semantic: 2,
//     hybrid: 1
//   }
// }
```

Use these stats for:
- Progress estimation
- Quality metrics
- Performance optimization
- Strategy effectiveness analysis
