'use strict';

const DESTINATIONS = {
  rome: 'ROM', roma: 'ROM', 'רומא': 'ROM', italy: 'ROM', 'איטליה': 'ROM',
  crete: 'HER', heraklion: 'HER', 'כרתים': 'HER', 'הרקליון': 'HER',
  athens: 'ATH', 'אתונה': 'ATH', greece: 'ATH', 'יוון': 'ATH',
  dubai: 'DXB', 'דובאי': 'DXB', emirates: 'DXB',
  paris: 'PAR', 'פריז': 'PAR', france: 'PAR', 'צרפת': 'PAR',
  london: 'LON', 'לונדון': 'LON', uk: 'LON', england: 'LON',
  amsterdam: 'AMS', 'אמסטרדם': 'AMS', netherlands: 'AMS', 'הולנד': 'AMS',
  barcelona: 'BCN', 'ברצלונה': 'BCN', spain: 'BCN', 'ספרד': 'BCN',
  madrid: 'MAD', 'מדריד': 'MAD',
  istanbul: 'IST', 'איסטנבול': 'IST', turkey: 'IST', 'טורקיה': 'IST',
  larnaca: 'LCA', 'לרנקה': 'LCA', cyprus: 'LCA', 'קפריסין': 'LCA',
  budapest: 'BUD', 'בודפשט': 'BUD', hungary: 'BUD', 'הונגריה': 'BUD',
  prague: 'PRG', 'פראג': 'PRG', czech: 'PRG', 'צכיה': 'PRG', 'צ׳כיה': 'PRG',
  vienna: 'VIE', 'וינה': 'VIE', austria: 'VIE', 'אוסטריה': 'VIE',
  berlin: 'BER', 'ברלין': 'BER', germany: 'BER', 'גרמניה': 'BER',
  lisbon: 'LIS', 'ליסבון': 'LIS', portugal: 'LIS', 'פורטוגל': 'LIS',
  malta: 'MLA', 'מלטה': 'MLA',
  tbilisi: 'TBS', 'טביליסי': 'TBS', georgia: 'TBS', 'גאורגיה': 'TBS',
  batumi: 'BUS', 'בטומי': 'BUS',
  telaviv: 'TLV', 'tel-aviv': 'TLV', 'תל אביב': 'TLV', 'נתבג': 'TLV'
};

const NAMES = {
  ROM: 'רומא', HER: 'כרתים', ATH: 'אתונה', DXB: 'דובאי', PAR: 'פריז', LON: 'לונדון',
  AMS: 'אמסטרדם', BCN: 'ברצלונה', MAD: 'מדריד', IST: 'איסטנבול', LCA: 'לרנקה',
  BUD: 'בודפשט', PRG: 'פראג', VIE: 'וינה', BER: 'ברלין', LIS: 'ליסבון', MLA: 'מלטה',
  TBS: 'טביליסי', BUS: 'בטומי', TLV: 'תל אביב'
};

const IDEA_DESTINATIONS = {
  beach: ['HER', 'LCA', 'ATH', 'DXB', 'BCN', 'MLA'],
  city: ['ROM', 'PAR', 'AMS', 'BCN', 'BUD', 'PRG', 'VIE', 'BER', 'LIS'],
  luxury: ['DXB', 'PAR', 'LON', 'ROM', 'AMS', 'VIE'],
  cheap: ['LCA', 'ATH', 'BUD', 'PRG', 'IST', 'HER', 'ROM', 'BUS'],
  value: ['LCA', 'ATH', 'ROM', 'BUD', 'PRG', 'HER', 'BCN', 'AMS', 'MLA', 'TBS']
};

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.end(JSON.stringify(body));
}

function env(name, fallback = '') {
  return String(process.env[name] || fallback).trim();
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function normalize(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/["'`]/g, '')
    .replace(/\s+/g, ' ');
}

function directCode(value) {
  const text = String(value || '').trim();
  return /^[a-z]{3}$/i.test(text) ? text.toUpperCase() : '';
}

function codeFor(value, fallback = 'TLV') {
  const direct = directCode(value);
  if (direct) return direct;

  const normalized = normalize(value);
  if (DESTINATIONS[normalized]) return DESTINATIONS[normalized];

  const fallbackDirect = directCode(fallback);
  if (fallbackDirect) return fallbackDirect;

  return DESTINATIONS[normalize(fallback)] || 'TLV';
}

function chooseDestinations(request) {
  const text = normalize(`${request.destination || ''} ${request.notes || ''}`);
  const found = new Set();
  const explicitCode = directCode(request.destination);

  if (explicitCode && explicitCode !== 'TLV') found.add(explicitCode);

  for (const [alias, code] of Object.entries(DESTINATIONS)) {
    if (code !== 'TLV' && text.includes(normalize(alias))) found.add(code);
  }

  if (found.size) return Array.from(found).slice(0, 5);

  const style = normalize(request.style);
  const priority = normalize(request.priority);
  return IDEA_DESTINATIONS[style] || IDEA_DESTINATIONS[priority] || IDEA_DESTINATIONS.value;
}

function buildSupplierUrl(link, marker) {
  const base = link ? `https://www.aviasales.com${link}` : 'https://www.aviasales.com';
  if (!marker) return base;
  return `${base}${base.includes('?') ? '&' : '?'}marker=${encodeURIComponent(marker)}`;
}

function packageFromFlight(row, index, request, marker, origin, destination) {
  const price = Number(row.value || row.price || 0);

  return {
    id: `tp-${origin}-${destination}-${index}-${price || Date.now()}`,
    destination,
    destinationName: NAMES[destination] || destination,
    dates: {
      departureAt: row.departure_at || null,
      returnAt: row.return_at || null
    },
    hotel: null,
    flight: {
      origin,
      destination,
      airline: row.airline || null,
      departureAt: row.departure_at || null,
      returnAt: row.return_at || null,
      direct: row.direct ?? null
    },
    baggage: { included: null },
    meals: { breakfastIncluded: null },
    price,
    currency: String(request.currency || 'ILS').toUpperCase(),
    refundable: null,
    cancellationPolicy: {
      summary: 'תנאי ביטול, מלחמה, החזר ושינוי נקבעים אצל הספק או לפי פוליסת ביטוח שתתווסף מספק מורשה.'
    },
    supplierName: 'Travelpayouts / Aviasales',
    supplierUrl: buildSupplierUrl(row.link, marker),
    lastCheckedAt: new Date().toISOString(),
    availabilityStatus: 'pending_verification',
    verificationStatus: 'verified',
    confidenceScore: normalize(request.priority) === 'cheap' ? 74 : 70,
    source: 'provider',
    verified: true,
    aiComposed: false,
    completePackage: false,
    missing_data: true,
    missingFields: ['hotel', 'baggage', 'meals', 'refundable_terms', 'insurance_price'],
    aiSummary: `טיסה אמיתית מספק ל${NAMES[destination] || destination}. זה בסיס לבניית חבילה, לא חבילה מלאה: צריך להשלים מלון, ארוחות, מזוודה, ביטוח ותנאי ביטול מספקים מחוברים.`
  };
}

async function fetchTravelpayoutsDestination({ token, marker, origin, destination, request, month }) {
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
    headers: {
      'X-Access-Token': token,
      Accept: 'application/json'
    },
    signal: AbortSignal.timeout(Number(process.env.PROVIDER_TIMEOUT_MS || 9000))
  });

  const text = await response.text();
  let data;

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    return {
      packages: [],
      provider: {
        name: 'Travelpayouts',
        configured: true,
        status: 'provider_error',
        destination,
        error: 'Provider did not return JSON',
        providerMessage: text.slice(0, 300)
      }
    };
  }

  if (!response.ok || data.success === false) {
    return {
      packages: [],
      provider: {
        name: 'Travelpayouts',
        configured: true,
        status: 'provider_error',
        destination,
        error: data.error || `Travelpayouts returned ${response.status}`,
        providerMessage: data.error || text.slice(0, 300)
      }
    };
  }

  const rows = Array.isArray(data.data) ? data.data : [];

  return {
    packages: rows
      .map((row, index) => packageFromFlight(row, index, request, marker, origin, destination))
      .filter((item) => item.price > 0),
    provider: {
      name: 'Travelpayouts',
      configured: true,
      status: rows.length ? 'available' : 'no_results',
      destination
    }
  };
}

function diversifyPackages(items, explicitDestination) {
  const sorted = [...items].sort((a, b) => Number(a.price) - Number(b.price));
  if (explicitDestination) return sorted.slice(0, 18);

  const counts = new Map();
  const output = [];

  for (const item of sorted) {
    const count = counts.get(item.destination) || 0;
    if (count < 2) {
      counts.set(item.destination, count + 1);
      output.push(item);
    }
    if (output.length >= 18) break;
  }

  return output;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const token = env('TRAVELPAYOUTS_TOKEN');
  const marker = env('TRAVELPAYOUTS_MARKER');

  if (!token) {
    return sendJson(res, 200, {
      state: 'unavailable',
      packages: [],
      providers: [{ name: 'Travelpayouts', configured: false, status: 'unavailable' }],
      message: 'Provider API is not configured yet.'
    });
  }

  const request = await readJsonBody(req);
  const origin = codeFor(request.origin, env('TRAVELPAYOUTS_DEFAULT_ORIGIN', 'TLV'));
  const destinations = chooseDestinations(request)
    .filter((code) => code && code !== origin)
    .slice(0, request.destination ? 5 : 9);
  const month = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 7);

  const settled = await Promise.allSettled(
    destinations.map((destination) => fetchTravelpayoutsDestination({ token, marker, origin, destination, request, month }))
  );

  const results = settled.map((result, index) => {
    if (result.status === 'fulfilled') return result.value;
    return {
      packages: [],
      provider: {
        name: 'Travelpayouts',
        configured: true,
        status: result.reason?.name === 'TimeoutError' ? 'provider_timeout' : 'provider_error',
        destination: destinations[index],
        error: result.reason?.message || 'Provider error'
      }
    };
  });

  const allPackages = results.flatMap((result) => result.packages);
  const packages = diversifyPackages(allPackages, Boolean(request.destination));
  const providers = results.map((result) => result.provider);
  const state = packages.length
    ? 'available'
    : providers.some((provider) => provider.status === 'provider_error')
      ? 'provider_error'
      : 'no_results';

  return sendJson(res, 200, {
    state,
    searchedDestinations: destinations,
    packages,
    providers,
    message: packages.length
      ? 'Real provider flight results returned. Missing package parts are marked.'
      : 'No real provider results were returned. No fake packages were created.',
    ai: {
      openai: { configured: Boolean(env('OPENAI_API_KEY')), used: false },
      explanation: 'AI may rank and explain real provider data only. It must not invent hotel, baggage, meals, insurance, refund or availability.'
    }
  });
};
