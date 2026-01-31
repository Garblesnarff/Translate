# CDN Configuration Guide

This document provides comprehensive guidance for setting up a Content Delivery Network (CDN) for the Tibetan Translation Tool V2.

## Overview

A CDN improves performance by:
- Serving static assets from edge locations closer to users
- Reducing server load and bandwidth costs
- Enabling long-term browser caching
- Providing DDoS protection and security

**Performance Targets:**
- Static asset load time: <100ms (from CDN)
- Cache hit rate: >95%
- Global latency: <50ms (major cities)

## 1. CDN Providers Comparison

### 1.1 Cloudflare (Recommended)

**Pros:**
- Free tier available (unlimited bandwidth)
- Global edge network (300+ locations)
- Built-in DDoS protection
- Easy setup with DNS change
- Automatic SSL/TLS
- Image optimization included
- WebP/AVIF conversion
- Brotli compression

**Cons:**
- Cache purge limited on free tier
- Advanced features require paid plan

**Pricing:**
- Free: Unlimited bandwidth, basic features
- Pro: $20/month - Enhanced security, performance
- Business: $200/month - Advanced features, priority support

**Best For:**
- Small to medium projects
- Budget-conscious deployments
- Projects needing DDoS protection

### 1.2 AWS CloudFront

**Pros:**
- Tight integration with AWS services (S3, Lambda@Edge)
- Excellent performance and reliability
- Granular control over caching
- Lambda@Edge for edge computing
- Regional edge caches

**Cons:**
- More complex setup
- Pay-per-use pricing
- Requires AWS knowledge

**Pricing:**
- Pay-as-you-go: ~$0.085/GB (varies by region)
- Free tier: 1TB outbound, 10M requests (12 months)

**Best For:**
- AWS-based infrastructure
- Advanced caching requirements
- Enterprise deployments

### 1.3 Vercel Edge Network

**Pros:**
- Zero configuration for Vercel deployments
- Automatic SSL
- Built-in edge caching
- Great DX (developer experience)
- Serverless functions at edge

**Cons:**
- Vendor lock-in
- Expensive for high traffic
- Limited customization

**Pricing:**
- Hobby: Free - 100GB bandwidth
- Pro: $20/month - 1TB bandwidth
- Enterprise: Custom pricing

**Best For:**
- Vercel-hosted applications
- Rapid prototyping
- Small to medium projects

### 1.4 Netlify CDN

**Pros:**
- Simple setup
- Automatic HTTPS
- Instant cache invalidation
- Git-based deployments
- Edge functions

**Cons:**
- Bandwidth limits on free tier
- Can be expensive at scale

**Pricing:**
- Starter: Free - 100GB bandwidth
- Pro: $19/month - 1TB bandwidth
- Enterprise: Custom pricing

**Best For:**
- JAMstack applications
- Static site hosting
- Small to medium projects

## 2. CDN Setup (Cloudflare)

### 2.1 Initial Setup

#### Step 1: Sign Up and Add Site
```bash
1. Go to https://dash.cloudflare.com/sign-up
2. Add your domain (e.g., translate.example.com)
3. Select Free plan
4. Update nameservers at your domain registrar
5. Wait for DNS propagation (24-48 hours)
```

#### Step 2: Configure DNS
```dns
# A Record for root domain
Type: A
Name: @
Content: YOUR_SERVER_IP
Proxy: Enabled (Orange cloud)

# A Record for www
Type: A
Name: www
Content: YOUR_SERVER_IP
Proxy: Enabled (Orange cloud)

# CNAME for CDN subdomain
Type: CNAME
Name: cdn
Content: translate.example.com
Proxy: Enabled (Orange cloud)
```

#### Step 3: Enable HTTPS
```bash
1. Go to SSL/TLS tab
2. Select "Full (strict)" encryption mode
3. Enable "Always Use HTTPS"
4. Enable "Automatic HTTPS Rewrites"
5. Enable "Opportunistic Encryption"
```

### 2.2 Caching Configuration

#### Cache Rules (Page Rules)
```
URL Pattern: translate.example.com/assets/*
Settings:
  - Cache Level: Cache Everything
  - Edge Cache TTL: 1 year
  - Browser Cache TTL: 1 year
  - Origin Cache Control: On

URL Pattern: translate.example.com/fonts/*
Settings:
  - Cache Level: Cache Everything
  - Edge Cache TTL: 1 year
  - Browser Cache TTL: 1 year
```

#### Custom Cache Rules (Transform Rules)
```javascript
// Cache static assets aggressively
if (
  http.request.uri.path matches "\\.(js|css|png|jpg|jpeg|gif|webp|avif|svg|woff|woff2|ttf|ico)$"
) {
  return {
    cache: {
      edge_ttl: 31536000, // 1 year
      browser_ttl: 31536000, // 1 year
    },
  };
}

// Don't cache API responses
if (http.request.uri.path matches "^/api/") {
  return {
    cache: {
      eligible_for_cache: false,
    },
  };
}
```

### 2.3 Performance Optimizations

#### Enable Auto Minify
```
Speed > Optimization > Auto Minify
- ✅ JavaScript
- ✅ CSS
- ✅ HTML
```

#### Enable Brotli Compression
```
Speed > Optimization > Brotli
- ✅ Enable Brotli compression
```

#### Enable Rocket Loader (Optional)
```
Speed > Optimization > Rocket Loader
- ⚠️  Test before enabling (can break some JS)
```

#### Enable Early Hints
```
Speed > Optimization > Early Hints
- ✅ Enable Early Hints
```

## 3. Server Configuration

### 3.1 Cache-Control Headers

Update your Express server to set proper cache headers:

```typescript
// server/index.ts
import express from 'express';

const app = express();

// Static asset caching
app.use('/assets', express.static('dist/public/assets', {
  maxAge: '1y', // 1 year
  immutable: true,
  setHeaders: (res, path) => {
    // Set cache-control headers
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    // Set appropriate content type
    if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    } else if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
    } else if (path.endsWith('.woff2')) {
      res.setHeader('Content-Type', 'font/woff2');
    }
  },
}));

// Font caching
app.use('/fonts', express.static('dist/public/fonts', {
  maxAge: '1y',
  immutable: true,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Access-Control-Allow-Origin', '*'); // CORS for fonts
  },
}));

// Image caching
app.use('/images', express.static('dist/public/images', {
  maxAge: '1y',
  immutable: true,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  },
}));

// HTML caching (short TTL)
app.use(express.static('dist/public', {
  maxAge: '5m', // 5 minutes
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
    }
  },
}));

// API routes (no caching)
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});
```

### 3.2 Nginx Configuration

If using nginx as reverse proxy:

```nginx
# /etc/nginx/sites-available/translate

server {
  listen 80;
  server_name translate.example.com;

  # Redirect to HTTPS
  return 301 https://$server_name$request_uri;
}

server {
  listen 443 ssl http2;
  server_name translate.example.com;

  # SSL configuration (handled by Cloudflare)
  ssl_certificate /path/to/cert.pem;
  ssl_certificate_key /path/to/key.pem;

  # Security headers
  add_header X-Frame-Options "SAMEORIGIN" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-XSS-Protection "1; mode=block" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;

  # Static assets (1 year cache)
  location ~* \.(js|css|png|jpg|jpeg|gif|webp|avif|svg|woff|woff2|ttf|ico)$ {
    root /var/www/translate/dist/public;
    expires 1y;
    add_header Cache-Control "public, immutable";
    add_header X-Content-Type-Options "nosniff";

    # CORS for fonts
    if ($request_filename ~* \.(woff|woff2|ttf)$) {
      add_header Access-Control-Allow-Origin "*";
    }
  }

  # HTML files (5 minute cache)
  location ~* \.html$ {
    root /var/www/translate/dist/public;
    expires 5m;
    add_header Cache-Control "public, max-age=300, must-revalidate";
  }

  # API routes (no cache)
  location /api/ {
    proxy_pass http://localhost:5439;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;

    # No caching
    add_header Cache-Control "no-store, no-cache, must-revalidate, private";
    expires -1;
  }

  # Root
  location / {
    root /var/www/translate/dist/public;
    try_files $uri $uri/ /index.html;
  }
}
```

### 3.3 Cache Busting Strategy

Use content hashing in filenames (Vite does this automatically):

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // Files with hash: main-a1b2c3d4.js
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
});
```

**Benefits:**
- New deployments automatically invalidate old cached files
- Users always get latest version
- No manual cache purging needed

## 4. CDN Testing and Verification

### 4.1 Verify CDN is Working

#### Check HTTP Headers
```bash
# Check if asset is served from CDN
curl -I https://translate.example.com/assets/main-a1b2c3d4.js

# Look for CDN headers:
# CF-Cache-Status: HIT (Cloudflare)
# X-Cache: Hit from cloudfront (AWS CloudFront)
# Cache-Control: public, max-age=31536000, immutable
```

#### Test from Different Locations
```bash
# Use curl with location override
curl -H "CF-IPCountry: US" https://translate.example.com/

# Or use online tools:
# - https://tools.keycdn.com/performance
# - https://www.webpagetest.org/
# - https://gtmetrix.com/
```

### 4.2 Measure Performance

#### Before CDN
```bash
# Average load time: 2-3 seconds
# Time to first byte (TTFB): 500-1000ms
# Asset load time: 200-500ms each
```

#### After CDN
```bash
# Average load time: 0.5-1 second
# Time to first byte (TTFB): 50-100ms
# Asset load time: 20-50ms each
```

### 4.3 Monitor Cache Hit Rate

#### Cloudflare Analytics
```
Analytics > Performance > Cache Hit Rate
- Target: >95%
- If lower: Check cache rules, TTLs
```

#### Custom Monitoring
```typescript
// Add CF-Cache-Status to response headers
app.use((req, res, next) => {
  const cfCacheStatus = req.headers['cf-cache-status'];
  if (cfCacheStatus) {
    console.log(`Cache status: ${cfCacheStatus}`);
  }
  next();
});
```

## 5. Advanced CDN Features

### 5.1 Image Optimization (Cloudflare)

Enable automatic image optimization:

```
Speed > Optimization > Image Optimization
- ✅ Polish (Lossless or Lossy)
- ✅ WebP
- ✅ AVIF (Pro plan)
```

**Usage:**
```html
<!-- Original URL -->
<img src="https://translate.example.com/images/logo.png">

<!-- Cloudflare automatically serves optimized version -->
<!-- Converts to WebP/AVIF if browser supports -->
```

### 5.2 Edge Workers (Advanced)

Use edge workers for dynamic content:

```javascript
// cloudflare-worker.js
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);

  // Cache API responses at edge for 5 minutes
  if (url.pathname.startsWith('/api/translations/recent')) {
    const cache = caches.default;
    let response = await cache.match(request);

    if (!response) {
      response = await fetch(request);
      response = new Response(response.body, response);
      response.headers.set('Cache-Control', 'public, max-age=300');
      event.waitUntil(cache.put(request, response.clone()));
    }

    return response;
  }

  return fetch(request);
}
```

### 5.3 Geographic Routing

Route users to nearest server:

```javascript
// Cloudflare Worker for geographic routing
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const country = request.headers.get('CF-IPCountry');

  let origin;
  if (country === 'US' || country === 'CA') {
    origin = 'https://us-server.example.com';
  } else if (country === 'EU') {
    origin = 'https://eu-server.example.com';
  } else {
    origin = 'https://asia-server.example.com';
  }

  const url = new URL(request.url);
  url.hostname = new URL(origin).hostname;

  return fetch(url, request);
}
```

## 6. CDN Security

### 6.1 Enable DNSSEC

```
DNS > Settings > DNSSEC
- ✅ Enable DNSSEC
```

### 6.2 Configure Firewall Rules

```
Security > WAF > Firewall Rules

# Block known bad bots
(cf.client.bot) and not (cf.verified_bot)

# Rate limiting
(http.request.uri.path eq "/api/translate" and rate(5m) > 100)

# Block countries (if needed)
(ip.geoip.country in {"CN" "RU"})
```

### 6.3 Enable Bot Protection

```
Security > Bots
- ✅ Enable Bot Fight Mode (Free)
- ✅ Enable Super Bot Fight Mode (Pro)
```

## 7. Cost Optimization

### 7.1 Cloudflare (Free Tier)

**Included:**
- Unlimited bandwidth
- Basic DDoS protection
- Shared SSL certificate
- 3 page rules
- 100k Workers requests/day

**Tips:**
- Use page rules wisely (limit: 3)
- Enable auto-minification
- Use Polish for image optimization

### 7.2 AWS CloudFront

**Cost Calculation:**
```
Monthly costs for 1TB bandwidth:
- Data transfer: 1000 GB × $0.085 = $85
- HTTP requests: 10M × $0.0075/10k = $7.50
- HTTPS requests: 10M × $0.01/10k = $10
- Total: ~$102.50/month
```

**Tips:**
- Use S3 as origin (cheaper than EC2)
- Enable compression
- Use regional edge caches
- Monitor CloudWatch metrics

## 8. Deployment Checklist

### Pre-Deployment
- [ ] CDN provider selected
- [ ] Domain DNS configured
- [ ] SSL/TLS certificates obtained
- [ ] Cache rules configured
- [ ] Security headers set

### Post-Deployment
- [ ] Verify CDN is serving assets
- [ ] Check cache hit rate (>95%)
- [ ] Test from multiple geographic locations
- [ ] Verify HTTPS is working
- [ ] Monitor performance metrics
- [ ] Set up cache purge webhook (for deployments)

### Monitoring
- [ ] CDN analytics dashboard configured
- [ ] Cache hit rate alerts set up
- [ ] Bandwidth usage monitoring
- [ ] Error rate monitoring
- [ ] Performance regression alerts

## 9. Troubleshooting

### Low Cache Hit Rate

**Causes:**
- Dynamic query parameters
- Cookies in requests
- Vary headers
- Short TTLs

**Solutions:**
```nginx
# Ignore query strings for static assets
location ~* \.(js|css|png|jpg)$ {
  proxy_cache_key "$scheme$request_method$host$uri";
  # Ignore $is_args$args
}

# Remove cookies for static assets
proxy_ignore_headers Set-Cookie;
proxy_hide_header Set-Cookie;
```

### Assets Not Updating

**Solution:**
```bash
# Purge CDN cache
# Cloudflare
curl -X POST "https://api.cloudflare.com/client/v4/zones/ZONE_ID/purge_cache" \
  -H "Authorization: Bearer API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'

# Or use version hashing (automatic cache busting)
# vite.config.ts already configured for this
```

### CORS Issues

**Solution:**
```typescript
// server/index.ts
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});
```

## 10. Performance Metrics

### Expected Improvements

#### Without CDN
- Global load time: 2-5 seconds
- TTFB: 500-1000ms
- Asset load: 200-500ms each
- Bandwidth: 100% from origin

#### With CDN
- Global load time: 0.5-1.5 seconds
- TTFB: 50-150ms
- Asset load: 20-80ms each
- Bandwidth: 5-10% from origin (90-95% from CDN)

**Improvement:**
- 60-70% faster load times
- 90% reduction in server bandwidth
- 95% cache hit rate
- Better user experience globally

## Related Documentation

- [Database Optimization](../performance/DATABASE_OPTIMIZATION.md)
- [Bundle Optimization](../performance/BUNDLE_OPTIMIZATION.md)
- [Performance Benchmarks](../benchmarks/PERFORMANCE_BENCHMARKS.md)
- [Deployment Guide](./DEPLOYMENT.md)
