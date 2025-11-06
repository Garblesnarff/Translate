# Bundle Size Optimization

This document outlines strategies for optimizing bundle sizes in the Tibetan Translation Tool V2.

## Overview

Bundle optimization reduces:
- Initial page load time
- Network bandwidth usage
- Time to interactive (TTI)
- First contentful paint (FCP)

**Target Bundle Sizes:**
- Initial load: <500KB (gzipped)
- Per-route chunk: <200KB (gzipped)
- Vendor chunk: <300KB (gzipped)

## 1. Client-Side Optimizations

### 1.1 Code Splitting (Route-Based)

Vite automatically code-splits at route boundaries when using dynamic imports.

#### Current Implementation

```typescript
// client/src/App.tsx
import { lazy, Suspense } from 'react';

// Lazy load route components
const TranslationPage = lazy(() => import('./pages/TranslationPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Router>
        <Route path="/" component={TranslationPage} />
        <Route path="/history" component={HistoryPage} />
        <Route path="/settings" component={SettingsPage} />
      </Router>
    </Suspense>
  );
}
```

#### Benefits
- Users only download code for routes they visit
- Initial bundle size reduced by ~40-60%
- Faster initial page load

### 1.2 Component-Level Code Splitting

Split heavy components that aren't needed immediately:

```typescript
// Heavy components (charts, editors, etc.)
const TranslationEditor = lazy(() => import('@/components/TranslationEditor'));
const PDFViewer = lazy(() => import('@/components/PDFViewer'));
const AnalyticsChart = lazy(() => import('@/components/AnalyticsChart'));

// Usage
function Dashboard() {
  const [showChart, setShowChart] = useState(false);

  return (
    <div>
      <button onClick={() => setShowChart(true)}>Show Analytics</button>
      {showChart && (
        <Suspense fallback={<Skeleton />}>
          <AnalyticsChart />
        </Suspense>
      )}
    </div>
  );
}
```

**Components to Split:**
- PDF viewer (heavy library)
- Rich text editor
- Chart libraries (recharts)
- Translation editor
- Image processing components

### 1.3 Tree Shaking

Vite automatically tree-shakes unused code, but you can help:

#### ✅ Good: Named Imports
```typescript
// Only imports the specific components needed
import { Button, Input } from '@/components/ui';
import { format } from 'date-fns';
```

#### ❌ Bad: Default Imports from Large Libraries
```typescript
// Imports entire library
import _ from 'lodash';
import * as dateFns from 'date-fns';
```

#### Optimize Imports
```typescript
// ❌ Bad: Imports entire lodash
import _ from 'lodash';
const result = _.debounce(fn, 300);

// ✅ Good: Imports only debounce
import debounce from 'lodash/debounce';
const result = debounce(fn, 300);

// ❌ Bad: Imports entire react-icons
import * as Icons from 'react-icons/fa';

// ✅ Good: Imports only needed icons
import { FaCheck, FaTimes } from 'react-icons/fa';
```

### 1.4 Remove Console Logs in Production

#### Option 1: Vite Plugin (Recommended)
```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import { vitePluginRemoveConsole } from 'vite-plugin-remove-console';

export default defineConfig({
  plugins: [
    vitePluginRemoveConsole({
      // Remove console.log only in production
      includes: ['log', 'debug', 'info'],
    }),
  ],
});
```

#### Option 2: Terser (Manual)
```typescript
// vite.config.ts
export default defineConfig({
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },
});
```

### 1.5 Lazy Load Heavy Dependencies

#### PDF Processing
```typescript
// ❌ Bad: Loads PDF library immediately
import pdfParse from 'pdf-parse';

// ✅ Good: Loads only when needed
async function processPDF(file: File) {
  const pdfParse = await import('pdf-parse');
  return pdfParse.default(file);
}
```

#### Image Processing
```typescript
// ❌ Bad: Loads Tesseract immediately
import Tesseract from 'tesseract.js';

// ✅ Good: Loads only when OCR is needed
async function performOCR(image: string) {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('tib');
  const result = await worker.recognize(image);
  return result.data.text;
}
```

#### Rich Text Editor
```typescript
// Only load editor when user clicks "Edit"
const [Editor, setEditor] = useState<React.ComponentType | null>(null);

async function loadEditor() {
  const module = await import('@/components/RichTextEditor');
  setEditor(() => module.default);
}
```

### 1.6 Optimize Images and Assets

#### Image Formats
- Use WebP for photos (70-80% smaller than JPEG)
- Use AVIF when possible (50% smaller than WebP)
- Use SVG for logos and icons
- Provide fallbacks for older browsers

```typescript
<picture>
  <source srcSet="image.avif" type="image/avif" />
  <source srcSet="image.webp" type="image/webp" />
  <img src="image.jpg" alt="fallback" />
</picture>
```

#### Image Optimization
```bash
# Install image optimization tools
npm install vite-plugin-image-optimizer -D

# Add to vite.config.ts
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer';

export default defineConfig({
  plugins: [
    ViteImageOptimizer({
      jpg: { quality: 80 },
      png: { quality: 80 },
      webp: { quality: 80 },
    }),
  ],
});
```

### 1.7 Font Optimization

#### Use System Fonts
```css
/* Use system font stack (0KB download) */
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
    'Helvetica Neue', Arial, sans-serif;
}
```

#### Self-Host Fonts
```typescript
// Download fonts and host locally
// Use font-display: swap for better performance
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter.woff2') format('woff2');
  font-display: swap;
  font-weight: 400;
}
```

#### Preload Critical Fonts
```html
<!-- In index.html -->
<link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossorigin>
```

### 1.8 Bundle Analysis

#### Install Bundle Analyzer
```bash
npm install rollup-plugin-visualizer -D
```

#### Configure Vite
```typescript
// vite.config.ts
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    visualizer({
      open: true,
      gzipSize: true,
      brotliSize: true,
      filename: 'dist/stats.html',
    }),
  ],
});
```

#### Analyze Bundle
```bash
npm run build

# Opens stats.html showing bundle composition
# Identify large dependencies and optimize
```

**Look for:**
- Duplicate dependencies
- Large libraries that can be replaced
- Unused code that wasn't tree-shaken
- Opportunities for code splitting

## 2. Server-Side Optimizations

### 2.1 Remove Dev Dependencies from Production

#### Package.json Best Practices
```json
{
  "dependencies": {
    // Only include runtime dependencies
    "express": "^4.21.1",
    "pg": "^8.13.1"
  },
  "devDependencies": {
    // All dev tools go here
    "typescript": "5.6.3",
    "tsx": "^4.19.1",
    "@types/node": "20.16.11"
  }
}
```

#### Production Install
```bash
# Install only production dependencies
npm ci --production

# Or using environment variable
NODE_ENV=production npm install
```

### 2.2 Use Production Builds

#### Environment Configuration
```typescript
// server/index.ts
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  // Serve pre-built static files
  app.use(express.static('dist/public'));
} else {
  // Use Vite dev server
  const vite = await import('vite');
  // ...
}
```

### 2.3 Minimize node_modules Size

#### Audit Dependencies
```bash
# Check dependency tree
npm list --depth=0

# Find duplicate packages
npm dedupe

# Check for unused dependencies
npm install -g depcheck
depcheck

# Remove unused dependencies
npm uninstall <package>
```

#### Use Smaller Alternatives
```typescript
// Replace large dependencies with smaller ones

// ❌ Moment.js (288KB)
import moment from 'moment';

// ✅ date-fns (13KB tree-shakeable)
import { format } from 'date-fns';

// ❌ Lodash (71KB)
import _ from 'lodash';

// ✅ Native JavaScript
const unique = [...new Set(array)];
const sorted = array.sort((a, b) => a - b);

// ❌ Axios (13KB)
import axios from 'axios';

// ✅ Fetch API (0KB, native)
const response = await fetch(url);
```

### 2.4 Server Bundle Optimization

#### Configure esbuild
```json
// package.json
{
  "scripts": {
    "build": "vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist --minify --sourcemap --tree-shaking=true"
  }
}
```

**Options:**
- `--minify`: Minify server code
- `--tree-shaking=true`: Remove unused code
- `--packages=external`: Don't bundle node_modules (use package.json)
- `--sourcemap`: Generate source maps for debugging

## 3. Vite Configuration

### 3.1 Enhanced Build Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    visualizer({
      open: true,
      gzipSize: true,
      filename: 'dist/stats.html',
    }),
  ],

  build: {
    // Output directory
    outDir: 'dist/public',

    // Generate source maps for production debugging
    sourcemap: true,

    // Minify with terser (better compression than esbuild)
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },

    // Optimize chunk splitting
    rollupOptions: {
      output: {
        // Manual chunk splitting
        manualChunks: {
          // Vendor chunk (React, etc.)
          vendor: ['react', 'react-dom', 'wouter'],

          // UI library chunk
          ui: [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
          ],

          // Utils chunk
          utils: ['date-fns', 'zod'],
        },

        // Asset file naming
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },

    // Chunk size warning threshold (500KB)
    chunkSizeWarningLimit: 500,
  },

  // Dependency optimization
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'wouter',
      '@tanstack/react-query',
    ],
    exclude: [
      // Exclude large libraries that should be lazy-loaded
      'jspdf',
      'tesseract.js',
      'pdf-parse',
    ],
  },
});
```

### 3.2 Asset Optimization

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    // Inline assets smaller than 4KB as base64
    assetsInlineLimit: 4096,

    // CSS code splitting
    cssCodeSplit: true,
  },
});
```

## 4. Production Checklist

### Client-Side
- [ ] Route-based code splitting implemented
- [ ] Heavy components lazy-loaded
- [ ] Tree-shaking enabled (using named imports)
- [ ] Console logs removed in production
- [ ] Images optimized (WebP/AVIF)
- [ ] Fonts optimized (preloaded/system fonts)
- [ ] Bundle analysis performed
- [ ] Manual chunk splitting configured
- [ ] Source maps generated

### Server-Side
- [ ] Dev dependencies excluded from production
- [ ] Production build script configured
- [ ] node_modules size minimized
- [ ] Large dependencies replaced with smaller alternatives
- [ ] Server code minified
- [ ] Unused packages removed

### Monitoring
- [ ] Bundle size tracked in CI/CD
- [ ] Performance budgets set (500KB initial load)
- [ ] Lighthouse scores monitored
- [ ] Bundle visualizer reports generated

## 5. Performance Budgets

Set performance budgets to prevent regressions:

```json
// package.json
{
  "scripts": {
    "size-limit": "size-limit"
  },
  "size-limit": [
    {
      "name": "Initial bundle",
      "path": "dist/public/assets/index-*.js",
      "limit": "500 KB"
    },
    {
      "name": "Vendor chunk",
      "path": "dist/public/assets/vendor-*.js",
      "limit": "300 KB"
    }
  ]
}
```

```bash
# Install size-limit
npm install size-limit @size-limit/file -D

# Check bundle sizes
npm run size-limit
```

## 6. Monitoring Bundle Size

### GitHub Actions (CI/CD)
```yaml
# .github/workflows/bundle-size.yml
name: Bundle Size Check

on: [pull_request]

jobs:
  bundle-size:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run build
      - uses: andresz1/size-limit-action@v1
```

### Bundle Size Report
```bash
# Generate bundle report after build
npm run build

# View bundle statistics
cat dist/stats.html
```

## 7. Expected Improvements

### Before Optimization
- Initial bundle: ~1.2MB (uncompressed)
- Initial bundle: ~400KB (gzipped)
- Time to interactive: ~3-4s (3G)

### After Optimization
- Initial bundle: ~600KB (uncompressed)
- Initial bundle: ~200KB (gzipped)
- Time to interactive: ~1-2s (3G)

**Improvements:**
- 50% reduction in bundle size
- 50% faster time to interactive
- 60% less bandwidth usage

## 8. Tools and Resources

### Bundle Analysis
- [Rollup Plugin Visualizer](https://github.com/btd/rollup-plugin-visualizer)
- [Webpack Bundle Analyzer](https://github.com/webpack-contrib/webpack-bundle-analyzer)
- [Source Map Explorer](https://github.com/danvk/source-map-explorer)

### Size Monitoring
- [Size Limit](https://github.com/ai/size-limit)
- [Bundlephobia](https://bundlephobia.com/) - Check package sizes

### Performance Testing
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)
- [WebPageTest](https://www.webpagetest.org/)
- [Chrome DevTools Coverage](https://developer.chrome.com/docs/devtools/coverage/)

## Related Documentation

- [Database Optimization](./DATABASE_OPTIMIZATION.md)
- [CDN Configuration](../deployment/CDN_SETUP.md)
- [Performance Benchmarks](../benchmarks/PERFORMANCE_BENCHMARKS.md)
