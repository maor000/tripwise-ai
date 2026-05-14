const DESTINATIONS = {
  rome: 'ROM', roma: 'ROM', 'רומא': 'ROM', איטליה: 'ROM', italy: 'ROM',
  crete: 'HER', heraklion: 'HER', 'כרתים': 'HER', 'הרקליון': 'HER', יוון: 'ATH', greece: 'ATH',
  athens: 'ATH', 'אתונה': 'ATH',
  dubai: 'DXB', 'דובאי': 'DXB', emirates: 'DXB', 'איחוד האמירויות': 'DXB',
  paris: 'PAR', france: 'PAR', 'פריז': 'PAR', צרפת: 'PAR',
  london: 'LON', england: 'LON', uk: 'LON', 'לונדון': 'LON', אנגליה: 'LON',
  amsterdam: 'AMS', 'אמסטרדם': 'AMS', הולנד: 'AMS', netherlands: 'AMS',
  barcelona: 'BCN', 'ברצלונה': 'BCN', spain: 'BCN', ספרד: 'BCN',
  madrid: 'MAD', 'מדריד': 'MAD',
  istanbul: 'IST', 'איסטנבול': 'IST', turkey: 'IST', טורקיה: 'IST',
  larnaca: 'LCA', cyprus: 'LCA', 'לרנקה': 'LCA', קפריסין: 'LCA',
  budapest: 'BUD', 'בודפשט': 'BUD', הונגריה: 'BUD', hungary: 'BUD',
  prague: 'PRG', 'פראג': 'PRG', צכיה: 'PRG', czech: 'PRG',
  vienna: 'VIE', 'וינה': 'VIE', אוסטריה: 'VIE', austria: 'VIE',
  berlin: 'BER', 'ברלין': 'BER', germany: 'BER', גרמניה: 'BER',
  berlinBrandenburg: 'BER',
  lisbon: 'LIS', 'ליסבון': 'LIS', portugal: 'LIS', פורטוגל: 'LIS',
  malta: 'MLA', 'מלטה': 'MLA',
  tbilisi: 'TBS', 'טביליסי': 'TBS', georgia: 'TBS', גאורגיה: 'TBS',
  batumi: 'BUS', 'בטומי': 'BUS',
  telaviv: 'TLV', 'tel-aviv': 'TLV', 'תל אביב': 'TLV', 'תל־אביב': 'TLV', נתבג: 'TLV',
};

const DESTINATION_NAMES = {
  ROM: 'רומא', HER: 'כרתים', ATH: 'אתונה', DXB: 'דובאי', PAR: 'פריז', LON: 'לונדון', AMS: 'אמסטרדם',
  BCN: 'ברצלונה', MAD: 'מדריד', IST: 'איסטנבול', LCA: 'לרנקה', BUD: 'בודפשט', PRG: 'פראג', VIE: 'וינה',
  BER: 'ברלין', LIS: 'ליסבון', MLA: 'מלטה', TBS: 'טביליסי', BUS: 'בטומי', TLV: 'תל אביב',
};

const IDEA_DESTINATIONS = {
  beach: ['HER', 'LCA', 'ATH', 'DXB', 'BCN', 'MLA'],
  city: ['ROM', 'PAR', 'AMS', 'BCN', 'BUD', 'PRG', 'VIE', 'BER'],
  luxury: ['DXB', 'PAR', 'LON', 'ROM', 'AMS'],
  cheap: ['LCA', 'ATH', 'BUD', 'PRG', 'IST', 'HER', 'ROM'],
  value: ['LCA', 'ATH', 'ROM', 'BUD', 'PRG', 'HER', 'BCN', 'AMS'],
};

function send(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function envValue(name, fallback = '') {
  return String(process.env[name] || fallback).trim();
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

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/["'`]/g, '')
    .replace(/\s+/g, ' ');
}

function directAirportCode(value) {
  const raw = String(value || '').trim();
  if (/^[a-z]{3}$/i.test(raw)) return raw.toUpperCase();
  return '';
}

function airportCode(value, fallback) {
  const direct = directAirportCode(value);
  if (direct) return direct;

  const key = normalizeText(value);
  if (DESTINATIONS[key]) return DESTINATIONS[key];

  const fallbackDirect = directAirportCode(fallback);
  if (fallbackDirect) return fallbackDirect;

  const fallbackKey = normalizeText(fallback);
  if (DESTINATIONS[fallbackKey]) return DESTINATIONS[fallbackKey];

  return 'TLV';
}

function detectDestinations(request) {
  const combined = normalizeText(`${request.destination || ''} ${request.notes || ''}`);
  const found = new Set();

  const direct = directAirportCode(request.destination);
  if (direct && direct !== 'TLV') found.add(direct);

  for (const [alias, code] of Object.entries(DESTINATIONS)) {
    if (code === 'TLV') continue;
    const key = normalizeText(alias);
    if (key && combined.includes(key)) found.add(code);
  }

  if (found.size) return Array.from(found).slice(0, 5);

  const style = normalizeText(request.style || request.priority || 'value');
  if (IDEA_DESTINATIONS[style]) return IDEA_DESTINATIONS[style];

  const priority = normalizeText(request.priority || 'value');
  if (IDEA_DESTINATIONS[priority]) return IDEA_DESTINATIONS[priority];

  return IDEA_DESTINATIONS.value;
}

function withMarker(link, marker) {
  if (!link) return 'https://www.aviasales.com';
  const baseUrl = `https://www.aviasales.com${link}`;
  if (!marker) return baseUrl;
  return `${baseUrl}${link.includes('?') ? '&' : '?'}marker=${encodeURIComponent(marker)}`;
}

function packageSummary(destination) {
  const name = DESTINATION_NAMES[destination] || destination;
  return `תוצאה אמיתית מספק טיסות ל${name}. מלון, ארוחות, מזוודה, ביטוח ותנאי החזר מלאים דורשים חיבור ספקים נוספים ולכן מסומנים כחסרים.`;
}

function buildPackage(row, index, request, marker, origin, destination) {
  const price = Number(row.value || row.price || 0);
  const missingFields = ['hotel', 'baggage', 'meals', 'refundable_terms', 'insurance_price'];

  return {
    id: `tp-${origin}-${destination}-${index}-${price || Date.now()}`,
    destination,
    destinationName: DESTINATION_NAMES[destination] || destination,
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
      direct: row.direct || null,
    },
    baggage: { included: null },
    meals: { breakfastIncluded: null },
    price,
    currency: String(request.currency || 'ILS').toUpperCase(),
    refundable: null,
    cancellationPolicy: {
      summary: 'תנאי ביטול והחזר נקבעים אצל הספק לפני ההזמנה. ביטול מלחמה/חירום דורש תנאי ספק או ביטוח מתאים.',
    },
    supplierName: 'Travelpayouts / Aviasales',
    supplierUrl: withMarker(row.link, marker),
    lastCheckedAt: new Date().toISOString(),
    availabilityStatus: 'pending_verification',
    verificationStatus: 'verified',
    confidenceScore: request.priority === 'cheap' ? 74 : 70,
    source: 'provider',
    verified: true,
    aiComposed: false,
    missing_data: true,
    missingFields,
    insurance: {
      requested: request.insurance || {},
      status: 'provider_required',
      note: 'מחירי ביטוח וכיסוי ביטול יתווספו רק אחרי חיבור ספק ביטוח מורשה.',
    },
    aiSummary: packageSummary(destination),
  };
}

async function fetchDestination({ token, marker, origin, destination, request, month, timeoutMs }) {
  const url = new URL('https://api.travelpayouts.com/aviasales/v3/prices_for_dates');

  url.searchParams.set('origin', origin);
  url.searchParams.set('destination', destination);
  url.searchParams.set('departure_at', month);
  url.searchParams.set('currency', String(request.currency || 'ils').toLowerCase());
  url.searchParams.set('market', 'il');
  url.searchParams.set('locale', 'he');
  url.searchParams.set('sorting', 'price');
  url.searchParams.set('limit', String(request.destination ? 10 : 4));
  url.searchParams.set('token', token);

  const response = await fetch(url, {
    headers: { 'X-Access-Token': token, Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  });

  const text = await response.text();
  let providerData = {};
  try {
    providerData = text ? JSON.parse(text) : {};
  } catch (error) {
    return {
      state: 'provider_error',
      packages: [],
      provider: {
        name: 'Travelpayouts', configured: true, status: 'provider_error', destination,
        error: 'Provider did not return JSON', providerMessage: text.slice(0, 400),
      },
    };
  }

  if (!response.ok || providerData.success === false) {
    return {
      state: 'provider_error',
      packages: [],
      provider: {
        name: 'Travelpayouts', configured: true, status: 'provider_error', destination,
        error: providerData.error || `Travelpayouts returned ${response.status}`,
        providerMessage: providerData.error || text.slice(0, 400),
      },
    };
  }

  const rows = Array.isArray(providerData.data) ? providerData.data : [];
  return {
    state: rows.length ? 'available' : 'no_results',
    packages: rows.map((row, index) => buildPackage(row, index, request, marker, origin, destination)),
    provider: { name: 'Travelpayouts', configured: true, status: rows.length ? 'available' : 'no_results', destination },
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return send(res, 405, { error: 'Method not allowed' });
  }

  const token = envValue('TRAVELPAYOUTS_TOKEN');
  const marker = envValue('TRAVELPAYOUTS_MARKER');

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
    const origin = airportCode(request.origin, envValue('TRAVELPAYOUTS_DEFAULT_ORIGIN', 'TLV'));
    const destinations = detectDestinations(request).filter((code) => code && code !== origin);
    const month = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 7);
    const timeoutMs = Number(process.env.PROVIDER_TIMEOUT_MS || 9000);

    const settled = await Promise.allSettled(
      destinations.slice(0, request.destination ? 5 : 8).map((destination) =>
        fetchDestination({ token, marker, origin, destination, request, month, timeoutMs })
      )
    );

    const providerResults = settled.map((result, index) => {
      if (result.status === 'fulfilled') return result.value;
      return {
        state: result.reason?.name === 'TimeoutError' ? 'provider_timeout' : 'provider_error',
        packages: [],
        provider: {
          name: 'Travelpayouts', configured: true, status: 'provider_error', destination: destinations[index],
          error: result.reason?.message || 'Provider error',
        },
      };
    });

    const packages = providerResults
      .flatMap((result) => result.packages)
      .filter((item) => Number(item.price) > 0)
      .sort((a, b) => Number(a.price) - Number(b.price))
      .slice(0, 18);

    const providers = providerResults.map((result) => result.provider);
    const state = packages.length ? 'available' : providers.some((provider) => provider.status === 'provider_error') ? 'provider_error' : 'no_results';

    return send(res, 200, {
      state,
      searchedDestinations: destinations,
      packages,
      providers,
      message: packages.length
        ? 'Real provider results returned. Missing package parts are clearly marked.'
        : 'No real provider results were returned. No fake packages were created.',
      ai: {
        openai: { configured: Boolean(envValue('OPENAI_API_KEY')), used: false, error: null },
        explanation: 'AI will rank provider data only. It will not invent missing hotel, baggage, meal, refund, insurance or availability data.',
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