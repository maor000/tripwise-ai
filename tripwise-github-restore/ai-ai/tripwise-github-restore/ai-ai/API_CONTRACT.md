# TripWise AI API Contract

The frontend does not use mock packages. It expects a real backend endpoint:

```http
POST /api/packages/search
Content-Type: application/json
```

## Request

```json
{
  "destination": "Crete",
  "budget": 5000,
  "travelers": "family",
  "style": "beach",
  "notes": "breakfast, flexible cancellation",
  "locale": "he-IL",
  "currency": "ILS"
}
```

## Response

```json
{
  "packages": [
    {
      "id": "provider-package-id",
      "provider": "Provider name",
      "title": "Crete family package",
      "destination": "Crete",
      "price": {
        "amount": 4380,
        "currency": "ILS"
      },
      "nights": 4,
      "hotelName": "Hotel name",
      "hotelRating": "4 stars",
      "mealPlan": "Breakfast",
      "imageUrl": "https://provider/image.jpg",
      "bookingUrl": "https://affiliate-or-provider-url",
      "commission": {
        "type": "percent",
        "value": 4.5,
        "source": "affiliate-agreement",
        "refundable": false
      },
      "commissionRefundable": false,
      "emergencyRefundEligible": true,
      "cancellationPolicy": {
        "summary": "Full refund for provider-approved emergency cancellation",
        "source": "provider-policy",
        "lastCheckedAt": "2026-05-10T14:30:00.000Z"
      },
      "disruptionSupport": {
        "summary": "Provider supports replacement hotel search when original hotel cannot host",
        "hotelReplacement": true,
        "flightReplacement": true,
        "customerNotification": true
      },
      "replacementOptionsAvailable": true,
      "aiScore": 92,
      "aiReason": "Why this package is worth booking",
      "scoreBreakdown": {
        "מחיר": 94,
        "שעות טיסה": 88,
        "מלון": 90,
        "ארוחות": 82,
        "ביטול": 76,
        "נוחות": 91,
        "אמינות ספק": 89
      }
    }
  ]
}
```

## Real Providers To Connect

- HolidayFinder or another local travel agency, only with permission, API, feed, or affiliate agreement.
- Travelpayouts for flight/hotel affiliate links.
- Expedia Rapid API for hotels and packages, subject to partner approval.
- Hotelbeds for hotel inventory, subject to commercial agreement.
- KAYAK Affiliate APIs for flights, hotels, cars, and monetized referrals, subject to partner approval.
- Viator Partner API for tours and activities, subject to partner approval.
- Direct agency feed for curated packages and commissions.

## Important Rule

Do not scrape or copy packages from another site without permission. Use official API access, affiliate links, feed files, or a direct commercial partnership.
