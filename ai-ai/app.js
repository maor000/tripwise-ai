const form = document.querySelector('#tripForm');
const dealGrid = document.querySelector('#dealGrid');
const providerStatus = document.querySelector('#providerStatus');
const agentStatus = document.querySelector('#agentStatus');
const quickIdea = document.querySelector('#quickIdea');
const scoreValue = document.querySelector('#scoreValue');
const scoreDetails = document.querySelector('#scoreDetails');
const openAgent = document.querySelector('#openAgent');
const agentModal = document.querySelector('#agentModal');
const agentBuild = document.querySelector('#agentBuild');
const agentReply = document.querySelector('#agentReply');

const FRONTEND_VERSION = '20260514-provider-cards-v3';
const PACKAGE_ENDPOINTS = ['/api/search/packages', '/api/packages/search'];
const PROVIDER_STATUS_ENDPOINT = '/api/providers/status';

const AIRPORT_NAMES = {
  TLV: 'תל אביב',
  ROM: 'רומא',
  FCO: 'רומא',
  CIA: 'רומא',
  HER: 'כרתים',
  ATH: 'אתונה',
  DXB: 'דובאי',
  PAR: 'פריז',
  CDG: 'פריז',
  ORY: 'פריז',
  LON: 'לונדון',
  LHR: 'לונדון',
  LGW: 'לונדון',
  AMS: 'אמסטרדם',
  BCN: 'ברצלונה',
  MAD: 'מדריד',
  IST: 'איסטנבול',
  LCA: 'לרנקה',
};

const FIELD_NAMES = {
  hotel: 'מלון',
  baggage: 'מזוודה',
  meals: 'ארוחות',
  refundable_terms: 'תנאי החזר וביטול',
  insurance_price: 'מחיר ביטוח',
};

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function apiUrl(path) {
  return `${path}?v=${encodeURIComponent(FRONTEND_VERSION)}&t=${Date.now()}`;
}

function checked(id) {
  return Boolean(document.querySelector(`#${id}`)?.checked);
}

function formPayload() {
  return {
    destination: document.querySelector('#destination')?.value.trim() || '',
    budget: Number(document.querySelector('#budget')?.value || 5000),
    travelers: document.querySelector('#travelers')?.value || 'couple',
    style: document.querySelector('#style')?.value || 'beach',
    priority: document.querySelector('#priority')?.value || 'value',
    notes: document.querySelector('#notes')?.value.trim() || '',
    insurance: {
      travel: checked('travelInsurance'),
      life: checked('lifeInsurance'),
      baggage: checked('baggageInsurance'),
      cancellation: checked('cancelInsurance'),
      flexibleOnly: checked('flexibleOnly'),
    },
    currency: 'ILS',
    locale: 'he-IL',
  };
}

function airportLabel(value) {
  const raw = String(value || '').trim();
  const code = raw.toUpperCase();
  if (!code) return 'יעד מהספק';
  const name = AIRPORT_NAMES[code];
  return name ? `${code} (${name})` : raw;
}

function destinationLabel(value) {
  const code = String(value || '').trim().toUpperCase();
  return AIRPORT_NAMES[code] || value || 'יעד מהספק';
}

function money(value, currency = 'ILS') {
  const amount = Number(value || 0);
  if (!amount) return 'מחיר מהספק';
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function timeLabel(value) {
  if (!value) return 'עכשיו';
  try {
    return new Intl.DateTimeFormat('he-IL', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return 'עכשיו';
  }
}

function boolLabel(value, yes, no, unknown = 'לא נמסר מהספק') {
  if (value === true) return yes;
  if (value === false) return no;
  return unknown;
}

function missingLabel(fields = []) {
  const list = fields.map((field) => FIELD_NAMES[field] || field).filter(Boolean);
  return list.length ? list.join(', ') : 'מידע שלא חזר מהספק';
}

function emptyState(title, text, note = '') {
  if (!dealGrid) return;
  dealGrid.innerHTML = `
    <article class="empty-state">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(text)}</p>
      ${note ? `<strong>${escapeHtml(note)}</strong>` : ''}
    </article>
  `;
}

async function readJsonSafely(response, endpoint) {
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();
  if (!contentType.includes('application/json')) {
    throw new Error(`הנתיב ${endpoint} לא החזיר JSON תקין. האתר לא מציג חבילות בלי מקור ספק אמיתי.`);
  }
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error('התקבלה תשובה לא תקינה מהשרת. אין שימוש במחירי דמה.');
  }
}

function normalizePackage(item = {}) {
  const flight = item.flight || {};
  const hotel = item.hotel || null;
  const baggage = item.baggage || flight.baggage || { included: null };
  const meals = item.meals || { breakfastIncluded: null };
  const cancellationPolicy = item.cancellationPolicy || {};
  const missingFields = Array.isArray(item.missingFields) ? item.missingFields : [];
  const hasRefund = item.refundable !== null && item.refundable !== undefined;
  const completePackage = Boolean(hotel && meals && baggage && hasRefund);
  const missingData = item.missing_data ?? (!completePackage || missingFields.length > 0);

  return {
    id: item.id || `pkg-${Math.random().toString(16).slice(2)}`,
    destination: destinationLabel(item.destination || flight.destination),
    destinationCode: item.destination || flight.destination || '',
    dates: item.dates || flight.dates || {},
    hotel,
    flight,
    baggage,
    meals,
    price: Number(item.price || item.price?.amount || flight.price || 0),
    currency: item.currency || item.price?.currency || 'ILS',
    refundable: item.refundable,
    cancellationPolicy,
    supplierName: item.supplierName || flight.supplierName || 'Travelpayouts / Aviasales',
    supplierUrl: item.supplierUrl || item.bookingUrl || flight.supplierUrl || '',
    lastCheckedAt: item.lastCheckedAt || item.checkedAt || new Date().toISOString(),
    availabilityStatus: item.availabilityStatus || 'pending_verification',
    verificationStatus: item.verificationStatus || (item.verified ? 'verified' : 'pending_verification'),
    confidenceScore: Number(item.confidenceScore || item.aiScore || item.score || 0),
    source: item.source || 'provider',
    verified: item.verified === true || item.verificationStatus === 'verified',
    missing_data: missingData,
    missingFields: missingFields.length ? missingFields : missingData ? ['hotel', 'baggage', 'meals', 'refundable_terms', 'insurance_price'] : [],
    aiComposed: item.aiComposed === true || item.source === 'ai_composed',
    aiSummary: item.aiSummary || item.aiReason || '',
    completePackage,
  };
}

function verificationLabel(deal) {
  if (deal.source === 'mock') return 'Mock בלבד';
  if (deal.verified) return 'ספק מאומת';
  return 'ממתין לאימות';
}

function sourceLabel(deal) {
  if (deal.source === 'mock') return 'לא אמיתי';
  if (deal.aiComposed) return 'AI הרכיב מנתוני ספק';
  if (deal.completePackage) return 'חבילה מלאה מספק';
  return 'נתון אמיתי מספק';
}

function availabilityLabel(status) {
  const labels = {
    available: 'זמין מהספק',
    unavailable: 'לא זמין',
    provider_timeout: 'ספק לא ענה בזמן',
    provider_error: 'שגיאת ספק',
    pending_verification: 'דורש אימות לפני הזמנה',
    price_changed: 'מחיר השתנה',
    no_results: 'אין תוצאות',
  };
  return labels[status] || status || 'בדיקת ספק';
}

function renderBadges(deal) {
  const statusClass = deal.source === 'mock' ? 'is-mock' : deal.verified ? 'is-verified' : 'is-pending';
  return `
    <div class="package-badges" aria-label="סטטוס חבילה">
      <span class="status-badge ${statusClass}">${escapeHtml(verificationLabel(deal))}</span>
      <span class="status-badge">${escapeHtml(sourceLabel(deal))}</span>
      <span class="status-badge">${escapeHtml(availabilityLabel(deal.availabilityStatus))}</span>
      ${deal.missing_data ? '<span class="status-badge is-pending">חסר מידע</span>' : ''}
    </div>
  `;
}

function renderRouteVisual(deal) {
  const origin = deal.flight?.origin || 'TLV';
  const target = deal.flight?.destination || deal.destinationCode || deal.destination;
  return `
    <div class="deal-route" aria-label="מסלול טיסה">
      <span>${escapeHtml(airportLabel(origin))}</span>
      <strong>→</strong>
      <span>${escapeHtml(airportLabel(target))}</span>
      <small>${deal.completePackage ? 'חבילה מלאה' : 'טיסה אמיתית מספק'}</small>
    </div>
  `;
}

function insuranceText(request) {
  const selected = [];
  if (request.insurance?.travel) selected.push('ביטוח נסיעות רפואי');
  if (request.insurance?.life) selected.push('חיים/תאונות אישיות');
  if (request.insurance?.baggage) selected.push('כיסוי כבודה');
  if (request.insurance?.cancellation) selected.push('ביטול נסיעה/מצב חירום');
  if (request.insurance?.flexibleOnly) selected.push('להעדיף חבילה שניתן לבטל');
  return selected.length ? selected.join(', ') : 'לא נבחר ביטוח לבדיקה';
}

function renderFacts(deal, request) {
  return `
    <dl class="package-facts">
      <div><dt>ספק</dt><dd>${escapeHtml(deal.supplierName)}</dd></div>
      <div><dt>נבדק</dt><dd>${escapeHtml(timeLabel(deal.lastCheckedAt))}</dd></div>
      <div><dt>טיסה</dt><dd>${escapeHtml(airportLabel(deal.flight?.origin || 'TLV'))} → ${escapeHtml(airportLabel(deal.flight?.destination || deal.destinationCode || deal.destination))}</dd></div>
      <div><dt>מלון</dt><dd>${deal.hotel?.name ? escapeHtml(deal.hotel.name) : 'לא חזר מהספק'}</dd></div>
      <div><dt>מזוודה</dt><dd>${escapeHtml(boolLabel(deal.baggage?.included, 'כלולה', 'לא כלולה'))}</dd></div>
      <div><dt>ארוחת בוקר</dt><dd>${escapeHtml(boolLabel(deal.meals?.breakfastIncluded, 'כלולה', 'לא כלולה'))}</dd></div>
      <div><dt>ביטול</dt><dd>${escapeHtml(boolLabel(deal.refundable, 'יש אפשרות החזר', 'ללא החזר', 'לפי תנאי ספק'))}</dd></div>
      <div><dt>ביטוח לבדיקה</dt><dd>${escapeHtml(insuranceText(request))}</dd></div>
    </dl>
  `;
}

function worthinessText(deal, request) {
  const parts = [];
  if (deal.price && request.budget && deal.price <= request.budget) parts.push('המחיר עומד בתקציב שבחרת.');
  if (request.priority === 'cheap') parts.push('הדירוג נותן עדיפות למחיר נמוך.');
  if (request.priority === 'comfort') parts.push('הדירוג נותן עדיפות לנוחות, שעות טיסה ופחות חוסר ודאות.');
  if (request.priority === 'flexible') parts.push('הדירוג נותן עדיפות לביטול גמיש והחזר ברור.');
  if (request.priority === 'premium') parts.push('הדירוג נותן עדיפות לרמה גבוהה ושירות טוב יותר.');
  if (deal.missing_data) parts.push('יש מידע חסר ולכן זו עדיין לא חבילה מלאה לסגירה אוטומטית.');
  return parts.join(' ') || 'צריך להשוות מול עוד תוצאות ספק לפני סגירה.';
}

function renderWarnings(deal) {
  const warnings = [];
  if (deal.aiComposed) warnings.push('זו חבילה שה-AI הרכיב מנתוני ספקים. חייבים לוודא כל רכיב לפני הזמנה.');
  if (deal.missing_data) warnings.push(`חסר מידע: ${missingLabel(deal.missingFields)}. ה-AI לא ממציא מלון, ביטוח, מזוודה או החזר.`);
  if (deal.source === 'mock') warnings.push('Mock: נתון פיתוח בלבד. אסור למכור או להציג כחבילה אמיתית.');
  return warnings.length ? `<div class="package-warnings">${warnings.map((warning) => `<p>${escapeHtml(warning)}</p>`).join('')}</div>` : '';
}

function renderScore(deal) {
  if (!scoreValue || !scoreDetails) return;
  if (!deal) {
    scoreValue.textContent = '--';
    scoreDetails.innerHTML = '<p class="score-empty">אין עדיין תוצאה לבדיקה.</p>';
    return;
  }

  const rows = [
    ['מחיר', deal.price ? 82 : 0],
    ['אמינות ספק', deal.verified ? 92 : 66],
    ['שלמות חבילה', deal.completePackage ? 90 : 45],
    ['ביטול והחזר', deal.refundable === true ? 88 : deal.refundable === false ? 45 : 55],
    ['ביטוח', deal.missingFields.includes('insurance_price') ? 40 : 75],
  ];
  const total = Math.round(rows.reduce((sum, row) => sum + row[1], 0) / rows.length);
  scoreValue.textContent = deal.confidenceScore || total;
  scoreDetails.innerHTML = rows.map(([label, value]) => `
    <div class="score-row">
      <span>${escapeHtml(label)}</span>
      <div class="score-bar"><i style="width:${Number(value)}%"></i></div>
      <strong>${Number(value)}</strong>
    </div>
  `).join('');
}

function renderDeals(items, request = formPayload()) {
  const packages = items.map(normalizePackage);
  if (!packages.length) {
    emptyState('לא נמצאו תוצאות אמיתיות', 'הספק מחובר, אבל לא החזיר תוצאות לבקשה הזו.', 'אין באתר מחירי דמה ואין המצאת חבילות.');
    renderScore(null);
    return;
  }

  dealGrid.innerHTML = packages.map((deal) => {
    const title = deal.completePackage ? `חבילה ל${deal.destination}` : `טיסה אמיתית ל${deal.destination}`;
    const summary = deal.aiSummary || (deal.completePackage
      ? 'החבילה הגיעה מספק מחובר ותדורג לפי מחיר, טיסה, מלון, ארוחות וביטול.'
      : 'הספק החזיר כרגע נתון טיסה אמיתי. מלון, ארוחות, מזוודה, ביטוח והחזר מסומנים כחסרים עד חיבור ספקים נוספים.');

    return `
      <article class="deal-card ${deal.source === 'mock' ? 'mock-card' : ''}">
        ${renderRouteVisual(deal)}
        <div class="deal-body">
          ${renderBadges(deal)}
          <div class="deal-meta">
            <span class="pill">${escapeHtml(deal.supplierName)}</span>
            <span>${escapeHtml(deal.destination)}</span>
          </div>
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(summary)}</p>
          ${renderFacts(deal, request)}
          <span class="commission-note">${escapeHtml(deal.cancellationPolicy?.summary || 'תנאי הביטול וההחזר נקבעים אצל הספק לפני ההזמנה. עמלת שירות אינה מוחזרת אם הוצגה מראש.')}</span>
          <span class="commission-note">כדאיות: ${escapeHtml(worthinessText(deal, request))}</span>
          ${renderWarnings(deal)}
          <div class="deal-footer">
            <span class="price">${money(deal.price, deal.currency)}</span>
            <button class="check-button" type="button" data-package="${encodeURIComponent(JSON.stringify(deal))}">בדוק כדאיות</button>
          </div>
          ${deal.supplierUrl
            ? `<a class="booking-link" href="${escapeHtml(deal.supplierUrl)}" target="_blank" rel="noopener">פתח הזמנה אצל הספק</a>`
            : '<span class="booking-link is-disabled">אין קישור הזמנה מאומת</span>'}
        </div>
      </article>
    `;
  }).join('');

  renderScore(packages[0]);
}

async function postPackageSearch(request) {
  const errors = [];
  for (const endpoint of PACKAGE_ENDPOINTS) {
    try {
      const response = await fetch(apiUrl(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(request),
        cache: 'no-store',
      });
      const data = await readJsonSafely(response, endpoint);
      if (!response.ok) throw new Error(data.message || data.error || `Provider API returned ${response.status}`);
      return { data, endpoint };
    } catch (error) {
      errors.push(`${endpoint}: ${error.message}`);
    }
  }
  throw new Error(errors.join(' | '));
}

async function runSearch() {
  const request = formPayload();
  emptyState('בודק ספקים אמיתיים...', 'פונה לשרת בלבד. מפתחות API לא נחשפים בדפדפן.');
  if (agentStatus) agentStatus.textContent = 'מחפש נתוני ספקים';

  try {
    const { data, endpoint } = await postPackageSearch(request);
    const problem = (data.providers || []).find((provider) => provider.status === 'provider_error');
    if (problem && !(data.packages || data.results || data.flights || []).length) {
      emptyState('שגיאת ספק', problem.providerMessage || problem.error || 'הספק החזיר שגיאה בזמן החיפוש.', 'אין באתר מחירי דמה.');
      renderScore(null);
      if (agentStatus) agentStatus.textContent = 'צריך לבדוק הרשאות ספק';
      return;
    }

    const results = data.packages || data.results || data.flights || [];
    renderDeals(results, request);
    if (agentStatus) agentStatus.textContent = results.length ? `נמצאו ${results.length} תוצאות אמיתיות דרך ${endpoint}` : 'אין תוצאות ספק לבקשה הזו';
    document.querySelector('#deals')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    emptyState('שגיאת חיבור', error.message, 'המערכת לא תציג נתוני דמה במקום ספק אמיתי.');
    renderScore(null);
    if (agentStatus) agentStatus.textContent = 'נדרש תיקון חיבור ספק';
  }
}

async function loadProviderStatus() {
  if (!providerStatus) return;
  try {
    const response = await fetch(apiUrl(PROVIDER_STATUS_ENDPOINT), { cache: 'no-store' });
    const data = await readJsonSafely(response, PROVIDER_STATUS_ENDPOINT);
    const text = (data.providers || []).map((provider) => `${provider.name}: ${provider.configured ? 'מחובר' : 'לא מוגדר'}`).join(' | ');
    providerStatus.textContent = text || 'אין ספקים מוגדרים';
    if (agentStatus) agentStatus.textContent = data.openaiConfigured ? 'AI מחובר' : 'AI בסיסי, חסר OPENAI_API_KEY';
  } catch {
    providerStatus.textContent = 'לא ניתן לבדוק ספקים כרגע';
  }
}

form?.addEventListener('submit', (event) => {
  event.preventDefault();
  runSearch();
});

quickIdea?.addEventListener('click', () => {
  const destination = document.querySelector('#destination');
  const priority = document.querySelector('#priority');
  const notes = document.querySelector('#notes');
  if (destination) destination.value = '';
  if (priority) priority.value = 'value';
  if (notes) notes.value = 'תציע יעד משתלם עם ביטוח נסיעות וביטול גמיש';
});

dealGrid?.addEventListener('click', (event) => {
  const button = event.target.closest('.check-button');
  if (!button) return;
  const deal = JSON.parse(decodeURIComponent(button.dataset.package));
  renderScore(deal);
  if (agentStatus) agentStatus.textContent = `בדיקת כדאיות: ${deal.destination}`;
  document.querySelector('#compare')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

openAgent?.addEventListener('click', () => {
  if (agentModal?.showModal) agentModal.showModal();
});

agentBuild?.addEventListener('click', () => {
  if (agentReply) {
    agentReply.textContent = 'ה-AI מדרג ומסביר רק נתוני ספקים אמיתיים. אם חסר מלון, מזוודה, ארוחות, ביטוח או תנאי החזר, הוא יסמן שחסר מידע ולא ימציא.';
  }
  runSearch();
});

emptyState('מוכן לחיפוש', 'בחר יעד ולחץ מצא חבילות חכמות. יוצגו רק נתוני ספקים אמיתיים ומידע חסר יסומן בצורה ברורה.', 'אין באתר מחירי דמה.');
loadProviderStatus();
