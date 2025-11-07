# Extraction Dashboard - Quick Start Guide

## 🚀 Getting Started

### 1. Start the Server
```bash
npm run dev
```

### 2. Access the Dashboard
Open your browser and navigate to:
```
http://localhost:5439/extraction
```

### 3. View Metrics
The dashboard will automatically load and display:
- Overview statistics
- Entity type distribution
- Confidence score distribution
- Quality alerts
- Recent extraction jobs

## 📊 What You'll See

### When Database is Empty
- Metric cards show "0"
- Charts display "No data available"
- Jobs table shows "No extraction jobs found"
- Quality alerts show "No issues detected"

### After Running Extractions
- Metric cards populate with actual counts
- Charts show distribution bars
- Jobs table lists recent extractions
- Quality alerts highlight issues (if any)

## 🔄 How to Populate with Data

### Run an Extraction
```bash
# Example: Extract entities from translation #1
curl -X POST http://localhost:5439/api/kg/extract/1 \
  -H "Content-Type: application/json"
```

### Check Results
The dashboard will auto-refresh within 15-60 seconds, or click the "Refresh" button.

## 📡 API Endpoints

### Get Aggregate Metrics
```bash
curl http://localhost:5439/api/metrics/aggregate
```

### Get Quality Report
```bash
curl http://localhost:5439/api/metrics/quality
```

### Get Recent Jobs
```bash
curl http://localhost:5439/api/extract/jobs?limit=10
```

## 🎨 Dashboard Layout

```
┌─────────────────────────────────────────────────┐
│ Entity Extraction Dashboard      [Refresh]     │
├─────────────────────────────────────────────────┤
│ [Total Entities] [Avg Conf] [Review] [Time]    │
│ [Relationships]  [Verified]                     │
├─────────────────────────────────────────────────┤
│ Entity Types Chart                              │
├─────────────────────────────────────────────────┤
│ Confidence Distribution Chart                   │
├─────────────────────────────────────────────────┤
│ Quality Alerts Panel                            │
├─────────────────────────────────────────────────┤
│ Recent Extractions Table                        │
└─────────────────────────────────────────────────┘
```

## 🔧 Customization

### Change Refresh Intervals

Edit `/home/user/Translate/client/src/pages/ExtractionDashboard.tsx`:

```typescript
// Line 274-285
refetchInterval: 30000, // Metrics (30s)
refetchInterval: 60000, // Quality (60s)
refetchInterval: 15000, // Jobs (15s)
```

### Change Jobs Limit

Modify the query key:
```typescript
// Line 283
queryKey: ['/api/extract/jobs?limit=20'], // Change 10 to 20
```

## 📱 Responsive Breakpoints

- **Mobile** (< 768px): Single column
- **Tablet** (768-1024px): 2 columns
- **Desktop** (> 1024px): 4 columns

## 🎯 Key Features

### Auto-Refresh
✅ Metrics update every 30s
✅ Quality report updates every 60s
✅ Jobs list updates every 15s

### Manual Refresh
✅ Click "Refresh" button in header
✅ Refreshes all data simultaneously
✅ Shows toast notification on success

### Status Indicators
✅ Green: Completed/Available
✅ Blue: Processing
✅ Red: Failed/Error
✅ Orange: Warning/Needs Review

## 🐛 Troubleshooting

### Dashboard Not Loading
1. Check server is running: `npm run dev`
2. Check URL: `http://localhost:5439/extraction`
3. Check browser console for errors

### No Data Showing
1. Run an extraction first
2. Check API responses: `curl http://localhost:5439/api/metrics/aggregate`
3. Verify database has data: `ls -lh tibetan_translation.db`

### Auto-Refresh Not Working
1. Check browser console for errors
2. Verify network requests in DevTools
3. Clear browser cache and reload

## 📝 Development Notes

### File Locations
- Dashboard UI: `/home/user/Translate/client/src/pages/ExtractionDashboard.tsx`
- API Controller: `/home/user/Translate/server/controllers/metricsController.ts`
- Routes: `/home/user/Translate/server/routes.ts`

### Database Tables Used
- `entities` - Entity data
- `relationships` - Entity connections
- `extraction_jobs` - Job metadata

### Dependencies
- TanStack Query (data fetching)
- shadcn/ui (UI components)
- lucide-react (icons)
- Drizzle ORM (database queries)

## 🎓 Learning Resources

### Understanding the Code

**Dashboard Component**: `/home/user/Translate/client/src/pages/ExtractionDashboard.tsx`
- Lines 1-50: Imports and type definitions
- Lines 51-91: MetricCard component
- Lines 93-128: QualityAlerts component
- Lines 130-195: ExtractionList component
- Lines 197-240: Chart components
- Lines 242-450: Main dashboard component

**API Controller**: `/home/user/Translate/server/controllers/metricsController.ts`
- Lines 17-137: getAggregateMetrics()
- Lines 144-213: getQualityReport()
- Lines 220-301: getRecentExtractionJobs()

### Documentation
- Full implementation: `docs/kg/EXTRACTION_DASHBOARD_IMPLEMENTATION.md`
- Visual structure: `docs/kg/DASHBOARD_STRUCTURE.md`
- This guide: `docs/kg/DASHBOARD_QUICK_START.md`

## 🚀 Next Steps

1. **Test the Dashboard**: Run `npm run dev` and visit `/extraction`
2. **Generate Test Data**: Run some entity extractions
3. **Customize**: Adjust refresh intervals, styling, or layout
4. **Integrate**: Add links from other pages to the dashboard
5. **Monitor**: Use the dashboard to track extraction quality

## ✨ Pro Tips

1. **Bookmark**: Add `/extraction` to your favorites for quick access
2. **Keep Open**: Leave dashboard open in a tab to monitor progress
3. **Check Alerts**: Review quality alerts regularly to catch issues early
4. **Export Data**: Use the API endpoints to export metrics programmatically
5. **Mobile View**: Check dashboard on mobile devices for field work

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review the full documentation in `docs/kg/`
3. Check the browser console and network tab
4. Verify database connectivity and data

---

**Version**: 1.0.0
**Last Updated**: 2025-11-07
**Status**: ✅ Production Ready
