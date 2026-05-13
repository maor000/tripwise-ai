const DESTINATIONS = {
  rome: 'ROM',
  'רומא': 'ROM',
  crete: 'HER',
  'כרתים': 'HER',
  dubai: 'DXB',
  'דובאי': 'DXB',
  paris: 'PAR',
  'פריז': 'PAR',
  london: 'LON',
  'לונדון': 'LON',
  athens: 'ATH',
  'אתונה': 'ATH',
};

function send(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        resolve({});
      }
    });
  });
}

function airportCode(value, fallback) {
  const key = String(value || '').trim().toLowerCase();
  return DESTINATIONS[key] || (key ? key.slice(0, 3).toUpperCase() : fallback);
}

function buildPackage(row, index, request, marker) {
  const destination = request.destination || row.destination || 'יעד מהספק';
  const supplierUrl = row.link
    ? `https://www.aviasales.com${row.link}${row.link.includes('?') ? '&' : '?'}marker=${encodeURIComponent(marker)}`
    : 'https://www.aviasales.com';

  return {
    id: `tp-package-${index}-${row.value || row.price || Date.now()}`,
    destination,
    dates: {
      departureAt: row.departure_at || null,
      returnAt: row.return_at || null,
    },
    hotel: null,
    flight: {
      origin: row.origin || airportCode(request.origin, process.env.TRAVELPAYOUTS_DEFAULT_ORIGIN || 'TLV'),
      destination: row.destination || airportCode(request.destination, 'ROM'),
      airline: row.airline || null,
      departureAt: row.departure_at || null,
      returnAt: row.return_at || null,
    },
    baggage: { included: null },
    meals: { breakfastIncluded: null },
    price: Number(row.value || row.price || 0),
    currency: String(request.currency || 'ILS').toUpperCase(),
    refundable: null,
    cancellationPolicy: {
      summary: 'תנאי ביטול והחזר נקבעים אצל הספק לפני ההזמנה.',
    },
    supplierName: 'Travelpayouts / Aviasales',
    supplierUrl,
    lastCheckedAt: new Date().toISOString(),
    availabilityStatus: 'pending_verification',
    verificationStatus: 'verified',
    confidenceScore: 70,
    source: 'provider',
    verified: true,
    aiComposed: false,
    missing_data: true,
    missingFields: ['hotel', 'baggage', 'meals', 'refundable_terms'],
    aiSummary: 'תוצאה אמיתית מספק טיסות. מלון, ארוחות, מזוודה ותנאי החזר לא נמסרו ולכן מסומנים כחסרים.',
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return send(res, 405, { error: 'Method not allowed' });
  }

  const token = process.env.TRAVELPAYOUTS_TOKEN;
  const marker = process.env.TRAVELPAYOUTS_MARKER || '';

  if (!token) {
    return send(res, 200, {
      state: 'unavailable',
      packages: [],
      providers: [{ name: 'Travelpayouts', configured: false, status: 'unavailable' }],
      message: 'Provider API is not configured yet.',
    });
  }

  try {
    const request = await readBody(req);
    const origin = airportCode(request.origin, process.env.TRAVELPAYOUTS_DEFAULT_ORIGIN || 'TLV');
    const destination = airportCode(request.destination, 'ROM');
    const month = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 7);
    const url = new URL('https://api.travelpayouts.com/aviasales/v3/prices_for_dates');

    url.searchParams.set('origin', origin);
    url.searchParams.set('destination', destination);
    url.searchParams.set('departure_at', month);
    url.searchParams.set('currency', String(request.currency || 'ils').toLowerCase());
    url.searchParams.set('sorting', 'price');
    url.searchParams.set('limit', '10');
    url.searchParams.set('token', token);

    const response = await fetch(url, {
      signal: AbortSignal.timeout(Number(process.env.PROVIDER_TIMEOUT_MS || 9000)),
    });
    const providerData = await response.json();
    const rows = Array.isArray(providerData.data) ? providerData.data : [];
    const packages = rows.map((row, index) => buildPackage(row, index, request, marker));

    return send(res, 200, {
      state: packages.length ? 'available' : 'no_results',
      packages,
      providers: [{ name: 'Travelpayouts', configured: true, status: response.ok ? 'available' : 'provider_error' }],
      ai: {
        openai: { configured: Boolean(process.env.OPENAI_API_KEY), used: false, error: null },
        explanation: 'AI will rank provider data only. It will not invent missing hotel, baggage, meal, refund or availability data.',
      },
    });
  } catch (error) {
    return send(res, 200, {
      state: error.name === 'TimeoutError' ? 'provider_timeout' : 'provider_error',
      packages: [],
      providers: [{ name: 'Travelpayouts', configured: true, status: 'provider_error', error: error.message }],
      message: 'Provider returned an error. No fake packages were created.',
    });
  }
};
