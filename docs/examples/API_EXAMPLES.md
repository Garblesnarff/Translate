# Tibetan Translation API - Usage Examples

## Table of Contents

1. [JavaScript/TypeScript Examples](#javascripttypescript-examples)
2. [Python Examples](#python-examples)
3. [cURL Examples](#curl-examples)
4. [PHP Examples](#php-examples)
5. [Ruby Examples](#ruby-examples)
6. [Go Examples](#go-examples)
7. [Advanced Usage](#advanced-usage)

---

## JavaScript/TypeScript Examples

### 1. Basic Translation

```javascript
// Using fetch API
async function translateText(tibetanText) {
  const response = await fetch('http://localhost:5001/api/translate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_API_KEY'  // If authentication enabled
    },
    body: JSON.stringify({
      text: tibetanText
    })
  });

  if (!response.ok) {
    throw new Error(`Translation failed: ${response.statusText}`);
  }

  const result = await response.json();
  return result;
}

// Usage
translateText('བཀྲ་ཤིས་བདེ་ལེགས།')
  .then(result => {
    console.log('Translation:', result.translation);
    console.log('Confidence:', result.confidence);
    console.log('Quality Grade:', result.quality?.grade);
  })
  .catch(error => console.error('Error:', error));
```

### 2. Translation with Custom Configuration

```typescript
interface TranslationConfig {
  useHelperAI?: boolean;
  useMultiPass?: boolean;
  maxIterations?: number;
  qualityThreshold?: number;
  useChainOfThought?: boolean;
  enableQualityAnalysis?: boolean;
  timeout?: number;
}

interface TranslationRequest {
  text: string;
  sessionId?: string;
  config?: TranslationConfig;
}

async function translateWithConfig(
  text: string,
  config: TranslationConfig
): Promise<any> {
  const request: TranslationRequest = {
    text,
    config
  };

  const response = await fetch('http://localhost:5001/api/translate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
  });

  return await response.json();
}

// Usage: High-quality translation
const result = await translateWithConfig(
  'བཀྲ་ཤིས་བདེ་ལེགས།',
  {
    useHelperAI: true,
    useMultiPass: true,
    maxIterations: 3,
    qualityThreshold: 0.9,
    useChainOfThought: true,
    enableQualityAnalysis: true
  }
);

console.log('Translation:', result.translation);
console.log('Iterations Used:', result.iterationsUsed);
console.log('Processing Time:', result.processingTime, 'ms');
```

### 3. Streaming Translation with Progress

```javascript
async function streamTranslation(tibetanText) {
  const response = await fetch('http://localhost:5001/api/translate/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text: tibetanText })
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));

        if (data.type === 'progress') {
          console.log(`Progress: ${data.stage} - ${(data.progress * 100).toFixed(0)}%`);
        } else if (data.type === 'complete') {
          console.log('Translation:', data.translation);
          console.log('Confidence:', data.confidence);
          return data;
        } else if (data.type === 'error') {
          throw new Error(data.error);
        }
      }
    }
  }
}

// Usage
streamTranslation('བཀྲ་ཤིས་བདེ་ལེགས།')
  .catch(error => console.error('Error:', error));
```

### 4. Batch Translation with Progress Tracking

```javascript
async function batchTranslate(files) {
  const formData = new FormData();

  files.forEach(file => {
    formData.append('files', file);
  });

  const response = await fetch('http://localhost:5001/api/batch/translate', {
    method: 'POST',
    body: formData
  });

  const result = await response.json();
  console.log('Batch Job Started:', result.jobId);

  // Poll for status
  return pollBatchStatus(result.jobId);
}

async function pollBatchStatus(jobId, interval = 5000) {
  const checkStatus = async () => {
    const response = await fetch(`http://localhost:5001/api/batch/status/${jobId}`);
    const status = await response.json();

    console.log(`Progress: ${status.progress.toFixed(1)}% (${status.processedFiles}/${status.totalFiles})`);

    if (status.status === 'completed') {
      console.log('Batch completed!');
      console.log('Translation IDs:', status.completedTranslations);
      return status;
    } else if (status.status === 'failed') {
      throw new Error(`Batch failed: ${status.errorMessage}`);
    }

    // Continue polling
    await new Promise(resolve => setTimeout(resolve, interval));
    return checkStatus();
  };

  return checkStatus();
}

// Usage with file input
const fileInput = document.querySelector('input[type="file"]');
fileInput.addEventListener('change', async (e) => {
  const files = Array.from(e.target.files);
  try {
    const result = await batchTranslate(files);

    // Download PDF
    window.location.href = `http://localhost:5001/api/batch/${result.jobId}/pdf`;
  } catch (error) {
    console.error('Batch translation failed:', error);
  }
});
```

### 5. Translation History

```javascript
async function getRecentTranslations(limit = 10, offset = 0) {
  const response = await fetch(
    `http://localhost:5001/api/translations/recent?limit=${limit}&offset=${offset}`
  );
  return await response.json();
}

async function getTranslationById(id) {
  const response = await fetch(`http://localhost:5001/api/translations/${id}`);
  return await response.json();
}

// Usage
const history = await getRecentTranslations(20);
console.log('Recent Translations:', history.translations);

const translation = await getTranslationById(123);
console.log('Translation:', translation);
```

### 6. Session Management (Cancellation)

```javascript
async function cancelTranslation(sessionId) {
  const response = await fetch(
    `http://localhost:5001/api/translate/cancel/${sessionId}`,
    { method: 'POST' }
  );
  return await response.json();
}

async function getActiveSessions() {
  const response = await fetch('http://localhost:5001/api/translate/sessions');
  return await response.json();
}

// Usage: Start translation with session tracking
const sessionId = crypto.randomUUID();
const translationPromise = fetch('http://localhost:5001/api/translate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: 'བཀྲ་ཤིས་བདེ་ལེགས།',
    sessionId
  })
});

// Cancel button handler
document.getElementById('cancelBtn').onclick = () => {
  cancelTranslation(sessionId)
    .then(() => console.log('Translation cancelled'))
    .catch(error => console.error('Cancel failed:', error));
};
```

### 7. Error Handling

```javascript
async function robustTranslate(text, maxRetries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch('http://localhost:5001/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });

      if (!response.ok) {
        const error = await response.json();

        // Handle specific error codes
        if (response.status === 429) {
          // Rate limit - wait and retry
          const retryAfter = response.headers.get('Retry-After') || 60;
          console.log(`Rate limited. Retrying after ${retryAfter}s...`);
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          continue;
        } else if (response.status === 400) {
          // Bad request - don't retry
          throw new Error(`Invalid input: ${error.error}`);
        } else if (response.status >= 500) {
          // Server error - retry with exponential backoff
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`Server error. Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        throw new Error(error.error || 'Translation failed');
      }

      return await response.json();

    } catch (error) {
      lastError = error;
      console.error(`Attempt ${attempt} failed:`, error.message);

      if (attempt === maxRetries) {
        throw lastError;
      }
    }
  }
}

// Usage
robustTranslate('བཀྲ་ཤིས་བདེ་ལེགས།')
  .then(result => console.log('Translation:', result.translation))
  .catch(error => console.error('All attempts failed:', error));
```

---

## Python Examples

### 1. Basic Translation

```python
import requests
import json

def translate_text(tibetan_text, api_key=None):
    """Translate Tibetan text to English."""
    url = 'http://localhost:5001/api/translate'

    headers = {
        'Content-Type': 'application/json'
    }

    if api_key:
        headers['Authorization'] = f'Bearer {api_key}'

    payload = {
        'text': tibetan_text
    }

    response = requests.post(url, headers=headers, json=payload)
    response.raise_for_status()

    return response.json()

# Usage
if __name__ == '__main__':
    result = translate_text('བཀྲ་ཤིས་བདེ་ལེགས།')
    print(f"Translation: {result['translation']}")
    print(f"Confidence: {result['confidence']}")
    print(f"Quality Grade: {result.get('quality', {}).get('grade', 'N/A')}")
```

### 2. Translation with Configuration

```python
import requests
from typing import Optional, Dict, Any

def translate_with_config(
    text: str,
    use_helper_ai: bool = True,
    use_multi_pass: bool = True,
    max_iterations: int = 3,
    quality_threshold: float = 0.8,
    use_chain_of_thought: bool = False,
    timeout: int = 90000
) -> Dict[str, Any]:
    """Translate with custom configuration."""

    url = 'http://localhost:5001/api/translate'

    payload = {
        'text': text,
        'config': {
            'useHelperAI': use_helper_ai,
            'useMultiPass': use_multi_pass,
            'maxIterations': max_iterations,
            'qualityThreshold': quality_threshold,
            'useChainOfThought': use_chain_of_thought,
            'timeout': timeout
        }
    }

    response = requests.post(url, json=payload, timeout=timeout/1000)
    response.raise_for_status()

    return response.json()

# Usage: High-quality translation
result = translate_with_config(
    text='བཀྲ་ཤིས་བདེ་ལེགས།',
    use_chain_of_thought=True,
    max_iterations=5,
    quality_threshold=0.9
)

print(f"Translation: {result['translation']}")
print(f"Iterations Used: {result.get('iterationsUsed')}")
print(f"Processing Time: {result.get('processingTime')}ms")
```

### 3. Streaming Translation

```python
import requests
import json

def stream_translation(text: str):
    """Stream translation with progress updates."""
    url = 'http://localhost:5001/api/translate/stream'

    payload = {'text': text}

    with requests.post(url, json=payload, stream=True) as response:
        response.raise_for_status()

        for line in response.iter_lines():
            if line:
                line = line.decode('utf-8')
                if line.startswith('data: '):
                    data = json.loads(line[6:])

                    if data['type'] == 'progress':
                        progress = data['progress'] * 100
                        print(f"Progress: {data['stage']} - {progress:.0f}%")
                    elif data['type'] == 'complete':
                        print(f"Translation: {data['translation']}")
                        print(f"Confidence: {data['confidence']}")
                        return data
                    elif data['type'] == 'error':
                        raise Exception(f"Translation error: {data['error']}")

# Usage
stream_translation('བཀྲ་ཤིས་བདེ་ལེགས།')
```

### 4. Batch Translation

```python
import requests
import time
from pathlib import Path

def batch_translate(file_paths: list) -> str:
    """Upload files for batch translation."""
    url = 'http://localhost:5001/api/batch/translate'

    files = []
    for file_path in file_paths:
        files.append(('files', open(file_path, 'rb')))

    response = requests.post(url, files=files)
    response.raise_for_status()

    result = response.json()
    job_id = result['jobId']

    print(f"Batch job started: {job_id}")
    return job_id

def poll_batch_status(job_id: str, interval: int = 5) -> dict:
    """Poll batch job status until complete."""
    url = f'http://localhost:5001/api/batch/status/{job_id}'

    while True:
        response = requests.get(url)
        response.raise_for_status()

        status = response.json()
        progress = status['progress']

        print(f"Progress: {progress:.1f}% ({status['processedFiles']}/{status['totalFiles']})")

        if status['status'] == 'completed':
            print("Batch completed!")
            return status
        elif status['status'] == 'failed':
            raise Exception(f"Batch failed: {status.get('errorMessage')}")

        time.sleep(interval)

def download_batch_pdf(job_id: str, output_path: str):
    """Download completed batch as PDF."""
    url = f'http://localhost:5001/api/batch/{job_id}/pdf'

    response = requests.get(url)
    response.raise_for_status()

    with open(output_path, 'wb') as f:
        f.write(response.content)

    print(f"PDF saved to: {output_path}")

# Usage
if __name__ == '__main__':
    files = ['document1.pdf', 'document2.pdf', 'document3.pdf']
    job_id = batch_translate(files)

    status = poll_batch_status(job_id)

    download_batch_pdf(job_id, f'{job_id}_translated.pdf')
```

### 5. Complete Client Class

```python
import requests
from typing import Optional, Dict, Any, List
import json

class TibetanTranslationClient:
    """Python client for Tibetan Translation API."""

    def __init__(self, base_url: str = 'http://localhost:5001', api_key: Optional[str] = None):
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.session = requests.Session()

        if api_key:
            self.session.headers.update({'Authorization': f'Bearer {api_key}'})

    def translate(self, text: str, config: Optional[Dict] = None) -> Dict[str, Any]:
        """Translate Tibetan text."""
        url = f'{self.base_url}/api/translate'
        payload = {'text': text}

        if config:
            payload['config'] = config

        response = self.session.post(url, json=payload)
        response.raise_for_status()
        return response.json()

    def stream_translate(self, text: str):
        """Stream translation with progress."""
        url = f'{self.base_url}/api/translate/stream'
        payload = {'text': text}

        with self.session.post(url, json=payload, stream=True) as response:
            response.raise_for_status()

            for line in response.iter_lines():
                if line:
                    line = line.decode('utf-8')
                    if line.startswith('data: '):
                        yield json.loads(line[6:])

    def batch_translate(self, file_paths: List[str]) -> str:
        """Start batch translation job."""
        url = f'{self.base_url}/api/batch/translate'
        files = [('files', open(path, 'rb')) for path in file_paths]

        response = self.session.post(url, files=files)
        response.raise_for_status()

        return response.json()['jobId']

    def get_batch_status(self, job_id: str) -> Dict[str, Any]:
        """Get batch job status."""
        url = f'{self.base_url}/api/batch/status/{job_id}'
        response = self.session.get(url)
        response.raise_for_status()
        return response.json()

    def download_batch_pdf(self, job_id: str, output_path: str):
        """Download batch result as PDF."""
        url = f'{self.base_url}/api/batch/{job_id}/pdf'
        response = self.session.get(url)
        response.raise_for_status()

        with open(output_path, 'wb') as f:
            f.write(response.content)

    def get_recent_translations(self, limit: int = 10, offset: int = 0) -> Dict[str, Any]:
        """Get recent translations."""
        url = f'{self.base_url}/api/translations/recent'
        params = {'limit': limit, 'offset': offset}

        response = self.session.get(url, params=params)
        response.raise_for_status()
        return response.json()

    def get_translation(self, translation_id: int) -> Dict[str, Any]:
        """Get specific translation by ID."""
        url = f'{self.base_url}/api/translations/{translation_id}'
        response = self.session.get(url)
        response.raise_for_status()
        return response.json()

    def health_check(self) -> Dict[str, Any]:
        """Check API health."""
        url = f'{self.base_url}/api/monitoring/health'
        response = self.session.get(url)
        response.raise_for_status()
        return response.json()

# Usage
if __name__ == '__main__':
    client = TibetanTranslationClient()

    # Health check
    health = client.health_check()
    print(f"API Status: {health['status']}")

    # Translate
    result = client.translate('བཀྲ་ཤིས་བདེ་ལེགས།')
    print(f"Translation: {result['translation']}")

    # History
    history = client.get_recent_translations(limit=5)
    print(f"Recent translations: {len(history['translations'])}")
```

---

## cURL Examples

### 1. Basic Translation

```bash
curl -X POST http://localhost:5001/api/translate \
  -H "Content-Type: application/json" \
  -d '{"text": "བཀྲ་ཤིས་བདེ་ལེགས།"}'
```

### 2. Translation with Authentication

```bash
curl -X POST http://localhost:5001/api/translate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"text": "བཀྲ་ཤིས་བདེ་ལེགས།"}'
```

### 3. Translation with Configuration

```bash
curl -X POST http://localhost:5001/api/translate \
  -H "Content-Type: application/json" \
  -d '{
    "text": "བཀྲ་ཤིས་བདེ་ལེགས།",
    "config": {
      "useHelperAI": true,
      "useMultiPass": true,
      "maxIterations": 3,
      "qualityThreshold": 0.8,
      "useChainOfThought": false
    }
  }'
```

### 4. Batch Translation

```bash
# Upload files for batch translation
curl -X POST http://localhost:5001/api/batch/translate \
  -F "files=@document1.pdf" \
  -F "files=@document2.pdf" \
  -F "files=@document3.pdf"

# Response: {"jobId":"123e4567-e89b-12d3-a456-426614174000",...}
```

### 5. Check Batch Status

```bash
curl http://localhost:5001/api/batch/status/123e4567-e89b-12d3-a456-426614174000
```

### 6. Download Batch PDF

```bash
curl -O http://localhost:5001/api/batch/123e4567-e89b-12d3-a456-426614174000/pdf
```

### 7. Recent Translations

```bash
curl "http://localhost:5001/api/translations/recent?limit=10&offset=0"
```

### 8. Health Check

```bash
curl http://localhost:5001/api/monitoring/health
```

### 9. System Status

```bash
curl http://localhost:5001/api/status
```

### 10. Metrics

```bash
curl http://localhost:5001/api/monitoring/metrics
```

---

## PHP Examples

### 1. Basic Translation

```php
<?php

function translateText($text, $apiKey = null) {
    $url = 'http://localhost:5001/api/translate';

    $data = array('text' => $text);
    $jsonData = json_encode($data);

    $headers = array(
        'Content-Type: application/json',
        'Content-Length: ' . strlen($jsonData)
    );

    if ($apiKey) {
        $headers[] = 'Authorization: Bearer ' . $apiKey;
    }

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $jsonData);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) {
        throw new Exception("Translation failed: HTTP $httpCode");
    }

    return json_decode($response, true);
}

// Usage
$result = translateText('བཀྲ་ཤིས་བདེ་ལེགས།');
echo "Translation: " . $result['translation'] . "\n";
echo "Confidence: " . $result['confidence'] . "\n";
?>
```

### 2. Batch Translation

```php
<?php

function batchTranslate($filePaths) {
    $url = 'http://localhost:5001/api/batch/translate';

    $ch = curl_init($url);

    $postData = array();
    foreach ($filePaths as $path) {
        $postData['files[]'] = new CURLFile($path);
    }

    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

    $response = curl_exec($ch);
    curl_close($ch);

    return json_decode($response, true);
}

// Usage
$files = ['document1.pdf', 'document2.pdf'];
$result = batchTranslate($files);
echo "Job ID: " . $result['jobId'] . "\n";
?>
```

---

## Ruby Examples

### 1. Basic Translation

```ruby
require 'net/http'
require 'json'
require 'uri'

def translate_text(text, api_key: nil)
  uri = URI('http://localhost:5001/api/translate')

  http = Net::HTTP.new(uri.host, uri.port)
  request = Net::HTTP::Post.new(uri.path, 'Content-Type' => 'application/json')

  if api_key
    request['Authorization'] = "Bearer #{api_key}"
  end

  request.body = { text: text }.to_json

  response = http.request(request)

  raise "Translation failed: #{response.code}" unless response.code == '200'

  JSON.parse(response.body)
end

# Usage
result = translate_text('བཀྲ་ཤིས་བདེ་ལེགས།')
puts "Translation: #{result['translation']}"
puts "Confidence: #{result['confidence']}"
```

### 2. Client Class

```ruby
require 'net/http'
require 'json'
require 'uri'

class TibetanTranslationClient
  attr_reader :base_url, :api_key

  def initialize(base_url: 'http://localhost:5001', api_key: nil)
    @base_url = base_url
    @api_key = api_key
  end

  def translate(text, config: nil)
    uri = URI("#{base_url}/api/translate")

    request = Net::HTTP::Post.new(uri.path, 'Content-Type' => 'application/json')
    request['Authorization'] = "Bearer #{api_key}" if api_key

    payload = { text: text }
    payload[:config] = config if config
    request.body = payload.to_json

    response = Net::HTTP.start(uri.host, uri.port) { |http| http.request(request) }
    JSON.parse(response.body)
  end

  def get_recent_translations(limit: 10, offset: 0)
    uri = URI("#{base_url}/api/translations/recent")
    uri.query = URI.encode_www_form(limit: limit, offset: offset)

    request = Net::HTTP::Get.new(uri)
    request['Authorization'] = "Bearer #{api_key}" if api_key

    response = Net::HTTP.start(uri.host, uri.port) { |http| http.request(request) }
    JSON.parse(response.body)
  end

  def health_check
    uri = URI("#{base_url}/api/monitoring/health")
    response = Net::HTTP.get_response(uri)
    JSON.parse(response.body)
  end
end

# Usage
client = TibetanTranslationClient.new
result = client.translate('བཀྲ་ཤིས་བདེ་ལེགས།')
puts "Translation: #{result['translation']}"
```

---

## Go Examples

### 1. Basic Translation

```go
package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
)

type TranslationRequest struct {
    Text      string                 `json:"text"`
    SessionID string                 `json:"sessionId,omitempty"`
    Config    map[string]interface{} `json:"config,omitempty"`
}

type TranslationResponse struct {
    Translation   string  `json:"translation"`
    Confidence    float64 `json:"confidence"`
    ProcessingTime int    `json:"processingTime"`
}

func translateText(text string, apiKey string) (*TranslationResponse, error) {
    url := "http://localhost:5001/api/translate"

    reqBody := TranslationRequest{
        Text: text,
    }

    jsonData, err := json.Marshal(reqBody)
    if err != nil {
        return nil, err
    }

    req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
    if err != nil {
        return nil, err
    }

    req.Header.Set("Content-Type", "application/json")
    if apiKey != "" {
        req.Header.Set("Authorization", "Bearer "+apiKey)
    }

    client := &http.Client{}
    resp, err := client.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        return nil, fmt.Errorf("translation failed: HTTP %d", resp.StatusCode)
    }

    body, err := io.ReadAll(resp.Body)
    if err != nil {
        return nil, err
    }

    var result TranslationResponse
    err = json.Unmarshal(body, &result)
    if err != nil {
        return nil, err
    }

    return &result, nil
}

func main() {
    result, err := translateText("བཀྲ་ཤིས་བདེ་ལེགས།", "")
    if err != nil {
        fmt.Printf("Error: %v\n", err)
        return
    }

    fmt.Printf("Translation: %s\n", result.Translation)
    fmt.Printf("Confidence: %.2f\n", result.Confidence)
}
```

### 2. Complete Client

```go
package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "time"
)

type TibetanTranslationClient struct {
    BaseURL    string
    APIKey     string
    HTTPClient *http.Client
}

func NewClient(baseURL string, apiKey string) *TibetanTranslationClient {
    return &TibetanTranslationClient{
        BaseURL: baseURL,
        APIKey:  apiKey,
        HTTPClient: &http.Client{
            Timeout: 120 * time.Second,
        },
    }
}

func (c *TibetanTranslationClient) Translate(text string, config map[string]interface{}) (*TranslationResponse, error) {
    url := fmt.Sprintf("%s/api/translate", c.BaseURL)

    reqBody := TranslationRequest{
        Text:   text,
        Config: config,
    }

    jsonData, err := json.Marshal(reqBody)
    if err != nil {
        return nil, err
    }

    req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
    if err != nil {
        return nil, err
    }

    req.Header.Set("Content-Type", "application/json")
    if c.APIKey != "" {
        req.Header.Set("Authorization", "Bearer "+c.APIKey)
    }

    resp, err := c.HTTPClient.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
    }

    body, err := io.ReadAll(resp.Body)
    if err != nil {
        return nil, err
    }

    var result TranslationResponse
    err = json.Unmarshal(body, &result)
    return &result, err
}

func (c *TibetanTranslationClient) HealthCheck() (map[string]interface{}, error) {
    url := fmt.Sprintf("%s/api/monitoring/health", c.BaseURL)

    resp, err := c.HTTPClient.Get(url)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    body, err := io.ReadAll(resp.Body)
    if err != nil {
        return nil, err
    }

    var result map[string]interface{}
    err = json.Unmarshal(body, &result)
    return result, err
}

func main() {
    client := NewClient("http://localhost:5001", "")

    // Health check
    health, err := client.HealthCheck()
    if err != nil {
        fmt.Printf("Health check failed: %v\n", err)
        return
    }
    fmt.Printf("API Status: %s\n", health["status"])

    // Translate
    result, err := client.Translate("བཀྲ་ཤིས་བདེ་ལེགས།", nil)
    if err != nil {
        fmt.Printf("Translation failed: %v\n", err)
        return
    }

    fmt.Printf("Translation: %s\n", result.Translation)
    fmt.Printf("Confidence: %.2f\n", result.Confidence)
}
```

---

## Advanced Usage

### 1. Rate Limit Handling

```javascript
class RateLimitedClient {
  constructor(baseURL, apiKey) {
    this.baseURL = baseURL;
    this.apiKey = apiKey;
    this.requestQueue = [];
    this.processing = false;
  }

  async translate(text) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ text, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.processing || this.requestQueue.length === 0) return;

    this.processing = true;
    const { text, resolve, reject } = this.requestQueue.shift();

    try {
      const response = await fetch(`${this.baseURL}/api/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({ text })
      });

      if (response.status === 429) {
        // Rate limited - get retry time and re-queue
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
        console.log(`Rate limited. Retrying in ${retryAfter}s`);

        setTimeout(() => {
          this.requestQueue.unshift({ text, resolve, reject });
          this.processing = false;
          this.processQueue();
        }, retryAfter * 1000);
        return;
      }

      const result = await response.json();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.processing = false;
      // Process next request after a short delay
      setTimeout(() => this.processQueue(), 100);
    }
  }
}

// Usage
const client = new RateLimitedClient('http://localhost:5001', 'YOUR_API_KEY');

// Queue multiple translations
const texts = ['text1', 'text2', 'text3', ...];
const results = await Promise.all(
  texts.map(text => client.translate(text))
);
```

### 2. Caching Client

```javascript
class CachingTranslationClient {
  constructor(baseURL, apiKey) {
    this.baseURL = baseURL;
    this.apiKey = apiKey;
    this.cache = new Map();
    this.cacheTTL = 3600000; // 1 hour
  }

  getCacheKey(text, config) {
    return JSON.stringify({ text, config });
  }

  async translate(text, config = null) {
    const cacheKey = this.getCacheKey(text, config);

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      console.log('Cache hit');
      return cached.result;
    }

    // Fetch from API
    const response = await fetch(`${this.baseURL}/api/translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({ text, config })
    });

    const result = await response.json();

    // Cache result
    this.cache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });

    return result;
  }

  clearCache() {
    this.cache.clear();
  }

  // Clean expired entries
  cleanCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp >= this.cacheTTL) {
        this.cache.delete(key);
      }
    }
  }
}

// Usage
const client = new CachingTranslationClient('http://localhost:5001', 'YOUR_API_KEY');

// First call - hits API
const result1 = await client.translate('བཀྲ་ཤིས་བདེ་ལེགས།');

// Second call - returns cached
const result2 = await client.translate('བཀྲ་ཤིས་བདེ་ལེགས།');

// Clean cache periodically
setInterval(() => client.cleanCache(), 600000); // Every 10 minutes
```

### 3. Webhook Integration (n8n)

```javascript
// n8n webhook handler for batch completion
app.post('/webhook/batch-complete', async (req, res) => {
  const { jobId, status, translationIds, pdfUrl } = req.body;

  console.log(`Batch ${jobId} completed with ${translationIds.length} translations`);

  // Download PDF
  const pdfResponse = await fetch(pdfUrl);
  const pdfBuffer = await pdfResponse.arrayBuffer();

  // Upload to storage (S3, Google Drive, etc.)
  await uploadToStorage(jobId, pdfBuffer);

  // Send notification email
  await sendEmail({
    to: 'user@example.com',
    subject: `Translation Complete: ${jobId}`,
    body: `Your translation is ready with ${translationIds.length} pages.`,
    attachments: [{ filename: `${jobId}.pdf`, content: pdfBuffer }]
  });

  // Update database
  await db.update('jobs', { jobId, status: 'delivered' });

  res.json({ success: true });
});
```

---

## Best Practices

### 1. Always Handle Errors

```javascript
try {
  const result = await translateText('...');
} catch (error) {
  if (error.response?.status === 429) {
    // Handle rate limit
  } else if (error.response?.status === 400) {
    // Handle validation error
  } else {
    // Handle other errors
  }
}
```

### 2. Use Timeouts

```javascript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 60000); // 60s

try {
  const response = await fetch(url, {
    signal: controller.signal,
    ...options
  });
} finally {
  clearTimeout(timeout);
}
```

### 3. Retry Logic

```javascript
async function retryFetch(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetch(url, options);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
}
```

### 4. Monitor Performance

```javascript
const startTime = Date.now();
const result = await translateText('...');
const duration = Date.now() - startTime;

console.log(`Translation took ${duration}ms`);

// Send to analytics
analytics.track('translation_completed', {
  duration,
  confidence: result.confidence,
  textLength: text.length
});
```

---

## Support

For questions or issues:
- Documentation: `/docs/`
- GitHub Issues: https://github.com/your-org/tibetan-translation/issues
- Email: support@example.com
