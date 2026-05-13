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
  telaviv: 'TLV',
  'tel-aviv': 'TLV',
  'תל אביב': 'TLV',
  'תל־אביב': 'TLV',
  'נתבג': 'TLV',
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
  if (/^[a-z]{2,3}$/i.test(key)) return key.toUpperCase();
  if (DESTINATIONS[key]) return DESTINATIONS[key];

  const fallbackKey = String(fallback || '').trim().toLowerCase();
  if (/^[a-z]{2,3}$/i.test(fallbackKey)) return fallbackKey.toUpperCase();
  if (DESTINATIONS[fallbackKey]) return DESTINATIONS[fallbackKey];

  return 'TLV';
}

function buildPackage(row, index, request, marker, origin, destination) {
  const supplierUrl = row.link
    ? `https://www.aviasales.com${row.link}${row.link.includes('?') ? '&' : '?'}marker=${encodeURIComponent(marker)}`
    : 'https://www.aviasales.com';

  return {
    id: `tp-package-${index}-${row.value || row.price || Date.now()}`,
    destination: request.destination || destination,
    dates: {
      departureAt: row.departure_at || null,
      returnAt: row.return_at || null,
    },
    hotel: null,
    flight: {
      origin,
      destination,
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
    url.searchParams.set('market', 'il');
    url.searchParams.set('locale', 'he');
    url.searchParams.set('sorting', 'price');
    url.searchParams.set('limit', '10');
    url.searchParams.set('token', token);

    const response = await fetch(url, {
      headers: { 'X-Access-Token': token },
      signal: AbortSignal.timeout(Number(process.env.PROVIDER_TIMEOUT_MS || 9000)),
    });

    const text = await response.text();
    let providerData = {};
    try {
      providerData = text ? JSON.parse(text) : {};
    } catch (error) {
      return send(res, 200, {
        state: 'provider_error',
        packages: [],
        providers: [{ name: 'Travelpayouts', configured: true, status: 'provider_error', error: 'Provider did not return JSON', providerMessage: text.slice(0, 400) }],
        message: 'Provider returned a non-JSON response. No fake packages were created.',
      });
    }

    if (!response.ok || providerData.success === false) {
      return send(res, 200, {
        state: 'provider_error',
        packages: [],
        providers: [{
          name: 'Travelpayouts',
          configured: true,
          status: 'provider_error',
          error: providerData.error || `Travelpayouts returned ${response.status}`,
          providerMessage: providerData.error || text.slice(0, 400),
        }],
        message: 'Provider returned an error. No fake packages were created.',
      });
    }

    const rows = Array.isArray(providerData.data) ? providerData.data : [];
    const packages = rows.map((row, index) => buildPackage(row, index, request, marker, origin, destination));

    return send(res, 200, {
      state: packages.length ? 'available' : 'no_results',
      packages,
      providers: [{ name: 'Travelpayouts', configured: true, status: packages.length ? 'available' : 'no_results' }],
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
