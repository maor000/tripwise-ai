const form = document.querySelector('#tripForm');
const dealGrid = document.querySelector('#dealGrid');
const providerStatus = document.querySelector('#providerStatus');
const agentStatus = document.querySelector('#agentStatus');
const openAgent = document.querySelector('#openAgent');
const agentModal = document.querySelector('#agentModal');
const agentBuild = document.querySelector('#agentBuild');
const agentReply = document.querySelector('#agentReply');
const quickIdea = document.querySelector('#quickIdea');
const scoreValue = document.querySelector('#scoreValue');
const scoreDetails = document.querySelector('#scoreDetails');

const FRONTEND_VERSION = '20260514-real-provider-cards';
const PACKAGE_ENDPOINTS = ['/api/search/packages', '/api/packages/search'];
const PROVIDER_STATUS_ENDPOINT = '/api/providers/status';

const DESTINATION_NAMES = {
  ROM: 'רומא',
  HER: 'כרתים',
  DXB: 'דובאי',
  PAR: 'פריז',
  LON: 'לונדון',
  ATH: 'אתונה',
  TLV: 'תל אביב',
};

const HEBREW_FIELD_NAMES = {
  hotel: 'מלון',
  baggage: 'מזוודה',
  meals: 'ארוחות',
  refundable_terms: 'תנאי החזר וביטול',
  insurance_price: 'מחיר ביטוח',
};

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((reg) => reg.unregister())).catch(() => {});
}

if ('caches' in window) {
  caches.keys().then((keys) => keys.forEach((key) => caches.delete(key))).catch(() => {});
}

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

function money(value, currency = 'ILS') {
  const numeric = Number(value);
  if (!numeric) return 'מחיר מהספק';
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(numeric);
}

function timeLabel(value) {
  if (!value) return 'עכשיו';
  try {
    return new Intl.DateTimeFormat('he-IL', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return 'עכשיו';
  }
}

function destinationName(value) {
  const code = String(value || '').trim().toUpperCase();
  return DESTINATION_NAMES[code] || value || 'יעד מהספק';
}

function booleanLabel(value, yes, no, unknown = 'לא נמסר מהספק') {
  if (value === true) return yes;
  if (value === false) return no;
  return unknown;
}

function missingLabel(fields = []) {
  const translated = fields.map((field) => HEBREW_FIELD_NAMES[field] || field).filter(Boolean);
  return translated.length ? translated.join(', ') : 'מידע שלא חזר מהספק';
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

function normalizeDeal(item = {}) {
  const flight = item.flight || {};
  const hotel = item.hotel || null;
  const destination = destinationName(item.destination || flight.destination);
  const missingFields = item.missingFields || [];
  const isCompletePackage = Boolean(hotel && item.meals && item.baggage && item.refundable !== null && item.refundable !== undefined);

  return {
    ...item,
    destination,
    flight,
    hotel,
    baggage: item.baggage || { included: null },
    meals: item.meals || { breakfastIncluded: null },
    source: item.source || 'provider',
    supplierName: item.supplierName || 'Travelpayouts / Aviasales',
    supplierUrl: item.supplierUrl || item.bookingUrl || '',
    lastCheckedAt: item.lastCheckedAt || new Date().toISOString(),
    availabilityStatus: item.availabilityStatus || 'pending_verification',
    verificationStatus: item.verificationStatus || (item.verified ? 'verified' : 'pending_verification'),
    confidenceScore: Number(item.confidenceScore || item.score || 0),
    missing_data: item.missing_data ?? missingFields.length > 0 || !isCompletePackage,
    missingFields: missingFields.length ? missingFields : isCompletePackage ? [] : ['hotel', 'baggage', 'meals', 'refundable_terms', 'insurance_price'],
    isCompletePackage,
  };
}

function providerTypeLabel(deal) {
  if (deal.source === 'mock') return 'לא אמיתי';
  if (deal.source === 'ai_composed' || deal.aiComposed) return 'AI הרכיב מנתוני ספק';
  if (deal.isCompletePackage) return 'חבילה מלאה מספק';
  return 'תוצאת טיסה מספק';
}

function verificationLabel(deal) {
  if (deal.source === 'mock') return 'לא מאומת';
  if (deal.verificationStatus === 'verified') return 'ספק מאומת';
  return 'ממתין לאימות';
}

function availabilityLabel(status) {
  const labels = {
    available: 'זמין מהספק',
    unavailable: 'לא זמין',
    provider_timeout: 'ספק לא ענה בזמן',
    provider_error: 'שגיאת ספק',
    pending_verification: 'דורש אימות בהזמנה',
    price_changed: 'מחיר השתנה',
    no_results: 'אין תוצאות',
  };
  return labels[status] || status || 'דורש אימות';
}

function badgeClass(deal) {
  if (deal.source === 'mock') return 'is-mock';
  if (deal.verificationStatus === 'verified') return 'is-verified';
  return 'is-pending';
}

function worthinessText(deal, request) {
  const parts = [];
  if (Number(deal.price) && Number(request.budget) && Number(deal.price) <= Number(request.budget)) {
    parts.push('המחיר עומד בתקציב שבחרת.');
  }
  if (request.priority === 'cheap') parts.push('הדירוג נותן עדיפות למחיר נמוך.');
  if (request.priority === 'comfort') parts.push('הדירוג נותן עדיפות לנוחות, שעות טיסה ופחות חוסר ודאות.');
  if (request.priority === 'flexible') parts.push('הדירוג נותן עדיפות לביטול גמיש והחזר ברור.');
  if (request.priority === 'premium') parts.push('הדירוג נותן עדיפות לרמה גבוהה ושירות טוב יותר.');
  if (deal.missing_data) parts.push('יש מידע חסר ולכן זו עדיין לא חבילה מלאה לסגירה אוטומטית.');
  return parts.join(' ');
}

function insuranceText(request) {
  const selected = [];
  if (request.insurance?.travel) selected.push('ביטוח נסיעות רפואי');
  if (request.insurance?.life) selected.push('הרחבת חיים/תאונות אישיות');
  if (request.insurance?.baggage) selected.push('כיסוי כבודה');
  if (request.insurance?.cancellation) selected.push('ביטול נסיעה/מצב חירום');
  if (request.insurance?.flexibleOnly) selected.push('להעדיף אפשרות ביטול');
  return selected.length ? selected.join(', ') : 'לא נבחר ביטוח לבדיקה';
}

function renderBadges(deal) {
  return `
    <div class="package-badges" aria-label="סטטוס תוצאה">
      <span class="status-badge ${badgeClass(deal)}">${escapeHtml(verificationLabel(deal))}</span>
      <span class="status-badge">${escapeHtml(providerTypeLabel(deal))}</span>
      <span class="status-badge">${escapeHtml(availabilityLabel(deal.availabilityStatus))}</span>
      ${deal.missing_data ? '<span class="status-badge is-pending">חסר מידע</span>' : ''}
    </div>
  `;
}

function renderRouteVisual(deal) {
  const origin = deal.flight?.origin || 'TLV';
  const destination = deal.flight?.destination || deal.destination;
  return `
    <div class="deal-route" aria-label="מסלול טיסה">
      <span>${escapeHtml(origin)}</span>
      <strong>→</strong>
      <span>${escapeHtml(destination)}</span>
      <small>${deal.isCompletePackage ? 'חבילה מלאה' : 'טיסה אמיתית מספק'}</small>
    </div>
  `;
}

function renderFacts(deal, request) {
  return `
    <dl class="package-facts">
      <div><dt>ספק</dt><dd>${escapeHtml(deal.supplierName)}</dd></div>
      <div><dt>נבדק</dt><dd>${escapeHtml(timeLabel(deal.lastCheckedAt))}</dd></div>
      <div><dt>טיסה</dt><dd>${escapeHtml(deal.flight?.origin || 'TLV')} → ${escapeHtml(deal.flight?.destination || deal.destination)}</dd></div>
      <div><dt>מלון</dt><dd>${deal.hotel?.name ? escapeHtml(deal.hotel.name) : 'לא חזר מהספק'}</dd></div>
      <div><dt>מזוודה</dt><dd>${escapeHtml(booleanLabel(deal.baggage?.included, 'כלולה', 'לא כלולה'))}</dd></div>
      <div><dt>ארוחת בוקר</dt><dd>${escapeHtml(booleanLabel(deal.meals?.breakfastIncluded, 'כלולה', 'לא כלולה'))}</dd></div>
      <div><dt>ביטול</dt><dd>${escapeHtml(booleanLabel(deal.refundable, 'אפשרות החזר', 'ללא החזר', 'לפי תנאי ספק'))}</dd></div>
      <div><dt>ביטוח לבדיקה</dt><dd>${escapeHtml(insuranceText(request))}</dd></div>
    </dl>
  `;
}

function renderWarnings(deal) {
  const warnings = [];
  if (deal.aiComposed) warnings.push('זו חבילה שה-AI הרכיב מנתוני ספקים. חייבים לוודא כל רכיב לפני הזמנה.');
  if (deal.missing_data) warnings.push(`חסר מידע: ${missingLabel(deal.missingFields)}. ה-AI לא משלים לבד מחיר, מלון, ביטוח או החזר.`);
  if (deal.source === 'mock') warnings.push('Mock: נתון פיתוח בלבד. אסור למכור או להציג כחבילה אמיתית.');
  if (!warnings.length) return '';
  return `<div class="package-warnings">${warnings.map((warning) => `<p>${escapeHtml(warning)}</p>`).join('')}</div>`;
}

function renderDeals(packages, request = formPayload()) {
  const normalized = packages.map(normalizeDeal);

  if (!normalized.length) {
    emptyState(
      'לא נמצאו תוצאות אמיתיות',
      'הספק מחובר, אבל לא החזיר תוצאות לבקשה הזו. נסה יעד אחר, תקציב אחר או תאריך אחר.',
      'אין באתר מחירי דמה ואין המצאת חבילות.'
    );
    renderScore(null);
    return;
  }

  dealGrid.innerHTML = normalized
    .map((deal) => {
      const title = deal.isCompletePackage ? `חבילה ל${deal.destination}` : `טיסה אמיתית ל${deal.destination}`;
      const summary = deal.aiSummary || (deal.isCompletePackage
        ? 'החבילה הגיעה מספק מחובר ותדורג לפי מחיר, טיסה, מלון, ארוחות וביטול.'
        : 'הספק החזיר כרגע נתון טיסה אמיתי. מלון, ארוחות, מזוודה, ביטוח והחזר מסומנים כחסרים עד חיבור ספקים נוספים.');

      return `
        <article class="deal-card ${deal.source === 'mock' ? 'mock-card' : ''}">
          ${renderRouteVisual(deal)}
          <div class="deal-body">
            ${renderBadges(deal)}
            <div class="deal-meta">
              <span class="pill">${escapeHtml(deal.supplierName)}</span>
              <span>${escapeHtml(providerTypeLabel(deal))}</span>
            </div>
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(summary)}</p>
            ${renderFacts(deal, request)}
            <span class="commission-note">${escapeHtml(deal.cancellationPolicy?.summary || 'תנאי הביטול יוצגו לפי הספק לפני ההזמנה. עמלת שירות אינה מוחזרת אם הוצגה מראש.')}</span>
            <span class="commission-note">כדאיות: ${escapeHtml(worthinessText(deal, request) || 'צריך להשוות מול תוצאות נוספות מהספק.')}</span>
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
    })
    .join('');

  renderScore(normalized[0]);
}

function renderScore(deal) {
  if (!scoreValue || !scoreDetails) return;

  if (!deal) {
    scoreValue.textContent = '--';
    scoreDetails.innerHTML = '<p class="score-empty">אין עדיין תוצאה לבדיקה.</p>';
    return;
  }

  const priceScore = deal.price ? 82 : 0;
  const supplierScore = deal.verificationStatus === 'verified' ? 92 : 65;
  const completenessScore = deal.isCompletePackage ? 90 : 48;
  const refundScore = deal.refundable === true ? 88 : deal.refundable === false ? 45 : 55;
  const total = Math.round((priceScore + supplierScore + completenessScore + refundScore) / 4);

  scoreValue.textContent = deal.confidenceScore || total;
  const rows = [
    ['מחיר', priceScore],
    ['אמינות ספק', supplierScore],
    ['שלמות חבילה', completenessScore],
    ['ביטול והחזר', refundScore],
  ];

  scoreDetails.innerHTML = rows
    .map(([label, value]) => `
      <div class="score-row">
        <span>${escapeHtml(label)}</span>
        <div class="score-bar"><i style="width:${value}%"></i></div>
        <strong>${value}</strong>
      </div>
    `)
    .join('');
}

async function readJsonSafely(response, endpoint) {
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();

  if (!contentType.includes('application/json')) {
    if (response.status === 404 || text.includes('The page could not be found')) {
      throw new Error(`הנתיב ${endpoint} לא החזיר API תקין. האתר ינסה נתיב נוסף.`);
    }
    throw new Error('השרת החזיר תשובה שאינה JSON. לא מוצגות חבילות שלא הגיעו מספק אמיתי.');
  }

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error('התקבלה תשובה לא תקינה מהשרת. אין שימוש במחירי דמה.');
  }
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

  throw new Error(`לא הצלחתי לקבל נתוני ספק מאף נתיב API. ${errors.join(' | ')}`);
}

function providerErrorText(data) {
  const provider = (data.providers || []).find((item) => item.status === 'provider_error');
  if (!provider && data.state !== 'provider_error') return '';
  return provider?.providerMessage || provider?.error || data.message || 'הספק החזיר שגיאה בזמן החיפוש.';
}

async function runSearch() {
  const request = formPayload();
  emptyState('בודק ספקים אמיתיים...', 'פונה לשרת בלבד. מפתחות API לא נחשפים בדפדפן.');
  if (agentStatus) agentStatus.textContent = 'מחפש נתוני ספקים';

  try {
    const { data, endpoint } = await postPackageSearch(request);
    const providerProblem = providerErrorText(data);

    if (providerProblem) {
      emptyState('שגיאת ספק', `${providerProblem}. אין באתר מחירי דמה ולא נוצרו חבילות מזויפות.`, 'בדוק יעד אחר או הרשאות ספק.');
      renderScore(null);
      if (agentStatus) agentStatus.textContent = 'צריך לבדוק חיבור ספק';
      return;
    }

    const results = data.packages || data.results || data.flights || [];
    renderDeals(results, request);
    if (agentStatus) {
      agentStatus.textContent = results.length ? `נמצאו ${results.length} תוצאות אמיתיות דרך ${endpoint}` : 'אין תוצאות ספק לבקשה הזו';
    }
  } catch (error) {
    emptyState('שגיאת חיבור', error.message, 'המערכת לא תציג נתוני דמה במקום ספק אמיתי.');
    renderScore(null);
    if (agentStatus) agentStatus.textContent = 'צריך לבדוק חיבור ספק';
  }
}

async function loadStatus() {
  if (!providerStatus) return;

  try {
    const response = await fetch(apiUrl(PROVIDER_STATUS_ENDPOINT), { cache: 'no-store' });
    const data = await readJsonSafely(response, PROVIDER_STATUS_ENDPOINT);
    const providers = (data.providers || [])
      .map((provider) => `${provider.name}: ${provider.configured ? 'מחובר' : 'לא מוגדר'}`)
      .join(' | ');

    providerStatus.textContent = providers || 'אין ספקים מוגדרים';
    if (agentStatus) agentStatus.textContent = data.openaiConfigured ? 'AI מחובר' : 'AI בסיסי, חסר OPENAI_API_KEY';
  } catch {
    providerStatus.textContent = 'לא ניתן לבדוק ספקים כרגע';
  }
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  await runSearch();
});

quickIdea?.addEventListener('click', () => {
  const destination = document.querySelector('#destination');
  const priority = document.querySelector('#priority');
  const notes = document.querySelector('#notes');
  if (destination) destination.value = '';
  if (priority) priority.value = 'value';
  if (notes) notes.value = 'תציע יעד משתלם עם ביטוח נסיעות וביטול גמיש';
});

openAgent?.addEventListener('click', () => {
  if (agentModal?.showModal) agentModal.showModal();
});

agentBuild?.addEventListener('click', async () => {
  if (agentReply) {
    agentReply.textContent = 'אני בודק ספקים אמיתיים. אם חסר מלון, ביטוח או תנאי החזר, אסמן את זה ולא אמציא.';
  }
  await runSearch();
});

emptyState(
  'מוכן לחיפוש',
  'בחר יעד ולחץ מצא חבילות חכמות. המערכת תציג רק נתוני ספקים אמיתיים ותסמן מידע חסר בצורה ברורה.'
);
loadStatus();
