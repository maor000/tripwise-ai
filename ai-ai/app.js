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

const FRONTEND_VERSION = '20260513-api-fallback';
const PACKAGE_ENDPOINTS = ['/api/search/packages', '/api/packages/search'];
const PROVIDER_STATUS_ENDPOINT = '/api/providers/status';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((reg) => reg.unregister())).catch(() => {});
}
if ('caches' in window) {
  caches.keys().then((keys) => keys.forEach((key) => caches.delete(key))).catch(() => {});
}

const LABELS = {
  travelInsurance: 'ביטוח נסיעות רפואי',
  lifeInsurance: 'הרחבת חיים/תאונות אישיות',
  baggageInsurance: 'כיסוי כבודה',
  cancelInsurance: 'ביטול נסיעה/מצב חירום',
  flexibleOnly: 'העדפת חבילות שניתן לבטל',
};

function esc(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function money(value, currency = 'ILS') {
  return Number(value)
    ? new Intl.NumberFormat('he-IL', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }).format(Number(value))
    : 'מחיר מהספק';
}

function checked(id) {
  return Boolean(document.querySelector(`#${id}`)?.checked);
}

function apiUrl(path) {
  return `${path}?v=${encodeURIComponent(FRONTEND_VERSION)}&t=${Date.now()}`;
}

function payload() {
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

function empty(title, text, isError = false) {
  dealGrid.innerHTML = `<article class="empty"><h3>${esc(title)}</h3><p class="${isError ? 'error-note' : ''}">${esc(text)}</p></article>`;
}

function explainBadServerResponse(status, text, endpoint) {
  const clean = String(text || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (status === 401 || status === 403) {
    return 'השרת חסם את הקריאה לספק. המפתחות נשארים בצד שרת, אבל צריך לבדוק הרשאת Vercel או הרשאת ספק.';
  }
  if (status === 404 || clean.toLowerCase().includes('page could not be found')) {
    return `הנתיב ${endpoint} החזיר דף מערכת במקום נתוני ספק. האתר ינסה נתיב API נוסף לפני שהוא מציג שגיאה.`;
  }
  return 'השרת החזיר תשובה שאינה JSON. אין שימוש במחירי דמו, ולכן המערכת לא תציג חבילה שלא הגיעה מספק אמיתי.';
}

async function readJsonSafely(response, endpoint) {
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();

  if (!contentType.includes('application/json')) {
    throw new Error(explainBadServerResponse(response.status, text, endpoint));
  }

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error('התקבלה תשובה לא תקינה מהשרת. אין שימוש במחירי דמו, נסה שוב בעוד רגע.');
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

      if (!response.ok) {
        throw new Error(data.message || data.error || `Provider API returned ${response.status}`);
      }

      return { data, endpoint };
    } catch (error) {
      errors.push(`${endpoint}: ${error.message}`);
    }
  }

  throw new Error(`לא הצלחתי לקבל נתוני ספק מאף נתיב API. ${errors.join(' | ')}`);
}

function selectedInsurance(data = payload()) {
  const selected = [];
  if (data.insurance?.travel) selected.push(LABELS.travelInsurance);
  if (data.insurance?.life) selected.push(LABELS.lifeInsurance);
  if (data.insurance?.baggage) selected.push(LABELS.baggageInsurance);
  if (data.insurance?.cancellation) selected.push(LABELS.cancelInsurance);
  if (data.insurance?.flexibleOnly) selected.push(LABELS.flexibleOnly);
  return selected;
}

function worthinessText(item, request) {
  const parts = [];
  if (request.priority === 'cheap') parts.push('הדירוג נותן עדיפות למחיר נמוך.');
  if (request.priority === 'comfort') parts.push('הדירוג נותן עדיפות לנוחות, שעות טיסה ופחות חוסר ודאות.');
  if (request.priority === 'flexible') parts.push('הדירוג נותן עדיפות לתנאי ביטול והחזר ברורים.');
  if (request.priority === 'premium') parts.push('הדירוג נותן עדיפות לאיכות ולרמת שירות.');
  if (item.missing_data) parts.push('יש מידע חסר ולכן החבילה לא מסומנת כחבילה מלאה.');
  if (Number(item.price) && Number(request.budget) && Number(item.price) <= Number(request.budget)) parts.push('המחיר עומד בתקציב שבחרת.');
  return parts.join(' ');
}

function normalizeProviderResult(item) {
  const flight = item.flight || null;
  const hotel = item.hotel || null;
  const baggage = item.baggage || flight?.baggage || { included: null };
  const meals = item.meals || { breakfastIncluded: null };

  return {
    ...item,
    hotel,
    flight,
    baggage,
    meals,
    refundable: item.refundable ?? null,
    cancellationPolicy: item.cancellationPolicy || {
      summary: 'תנאי ביטול והחזר נקבעים אצל הספק לפני ההזמנה.',
    },
    availabilityStatus: item.availabilityStatus || 'pending_verification',
    verificationStatus: item.verificationStatus || (item.verified ? 'verified' : 'pending_verification'),
    source: item.source || 'provider',
    supplierName: item.supplierName || flight?.supplierName || 'Travelpayouts / Aviasales',
    supplierUrl: item.supplierUrl || item.bookingUrl || flight?.supplierUrl || '',
    missing_data: item.missing_data ?? true,
    missingFields: item.missingFields || ['hotel', 'baggage', 'meals', 'refundable_terms', 'insurance_price'],
    aiSummary:
      item.aiSummary ||
      'תוצאה אמיתית מספק נסיעות. מלון, ארוחות, מזוודה, ביטוח ותנאי החזר שלא נמסרו על ידי הספק מסומנים כחסרים.',
  };
}

function providerErrorText(data) {
  const provider = (data.providers || []).find((item) => item.status === 'provider_error');
  if (!provider && data.state !== 'provider_error') return '';
  const detail = provider?.providerMessage || provider?.error || data.message || '';
  return detail
    ? `Travelpayouts מחובר, אבל החזיר שגיאה: ${detail}`
    : 'Travelpayouts מחובר, אבל החזיר שגיאה בזמן החיפוש. ייתכן שהטוקן אינו מתאים למסלול הזה או שאין הרשאה לנתונים האלה.';
}

function updateScore(items) {
  const first = items[0] ? normalizeProviderResult(items[0]) : null;
  if (!scoreValue || !scoreDetails) return;

  if (!first) {
    scoreValue.textContent = '--';
    scoreDetails.innerHTML = '';
    return;
  }

  const score = Number(first.confidenceScore || first.aiScore || first.score || 0);
  scoreValue.textContent = score || '--';
  const rows = {
    מחיר: first.price ? 82 : 0,
    אמינות: first.verificationStatus === 'verified' ? 92 : 65,
    ביטול: first.refundable === true ? 88 : first.refundable === false ? 45 : 55,
    מזוודה: first.baggage?.included === true ? 85 : 50,
    ארוחות: first.meals?.breakfastIncluded === true ? 85 : 50,
  };

  scoreDetails.innerHTML = Object.entries(rows)
    .map(([label, value]) => `<div class="score-row"><span>${esc(label)}</span><div class="bar"><i style="width:${value}%"></i></div><strong>${value}</strong></div>`)
    .join('');
}

function render(items = [], data = {}, request = payload()) {
  const providerProblem = providerErrorText(data);

  if (providerProblem) {
    empty('שגיאת ספק', `${providerProblem}. אין באתר מחירי דמו ולא נוצרו חבילות מזויפות.`, true);
    updateScore([]);
    return;
  }

  if (!items.length) {
    empty(
      'לא נמצאו תוצאות אמיתיות',
      'הספק מחובר, אבל לא החזיר תוצאות לבקשה הזו. נסה יעד אחר, תקציב אחר או תאריך אחר. אין באתר מחירי דמו.'
    );
    updateScore([]);
    return;
  }

  const insuranceNeeds = selectedInsurance(request);

  dealGrid.innerHTML = items
    .map(normalizeProviderResult)
    .map((item) => {
      const worthiness = worthinessText(item, request);
      const sourceLabel = item.source === 'mock' ? 'Mock בלבד' : item.source === 'ai_composed' ? 'AI מורכב מנתוני ספק' : 'ספק אמיתי';
      const verificationLabel = item.verificationStatus === 'verified' ? 'מאומת' : item.verificationStatus === 'mock' ? 'לא אמיתי' : 'ממתין לאימות';
      return `<article class="card">
        <div class="badges">
          <span class="badge good">${esc(verificationLabel)}</span>
          <span class="badge">${esc(sourceLabel)}</span>
          <span class="badge">${esc(item.availabilityStatus)}</span>
          ${item.missing_data ? '<span class="badge warn">חסר מידע</span>' : ''}
        </div>
        <h3>${esc(item.destination || item.flight?.destination || 'יעד מהספק')}</h3>
        <p>${esc(item.aiSummary)}</p>
        <div class="facts">
          <span>ספק: ${esc(item.supplierName)}</span>
          <span>נבדק: ${esc(item.lastCheckedAt || new Date().toISOString())}</span>
          <span>סטטוס זמינות: ${esc(item.availabilityStatus)}</span>
          <span>טיסה: ${esc(item.flight?.origin || 'TLV')} → ${esc(item.flight?.destination || item.destination || 'יעד')}</span>
          <span>מזוודה: ${item.baggage?.included === true ? 'כלולה' : 'לא נמסר מהספק'}</span>
          <span>ארוחת בוקר: ${item.meals?.breakfastIncluded === true ? 'כלולה' : 'לא נמסר מהספק'}</span>
          <span>ביטול/החזר: ${esc(item.cancellationPolicy?.summary || 'לפי תנאי הספק')}</span>
          <span>ביטוח לבדיקה: ${insuranceNeeds.length ? esc(insuranceNeeds.join(', ')) : 'לא נבחר ביטוח'}</span>
          <span>מחיר ביטוח: צריך חיבור ספק ביטוח כדי להציג מחיר אמיתי.</span>
          ${worthiness ? `<span>כדאיות: ${esc(worthiness)}</span>` : ''}
          ${item.missing_data ? `<span>חסר מידע: ${esc((item.missingFields || []).join(', '))}</span>` : ''}
        </div>
        <strong class="price">${money(item.price, item.currency)}</strong>
        ${item.supplierUrl ? `<br><a class="booking" href="${esc(item.supplierUrl)}" target="_blank" rel="noopener">פתח הזמנה אצל הספק</a>` : '<br><span class="booking muted">אין קישור ספק מאומת</span>'}
      </article>`;
    })
    .join('');

  updateScore(items);
}

async function loadStatus() {
  try {
    const response = await fetch(apiUrl(PROVIDER_STATUS_ENDPOINT), { cache: 'no-store' });
    const data = await readJsonSafely(response, PROVIDER_STATUS_ENDPOINT);
    const providers = (data.providers || [])
      .map((provider) => `${provider.name}: ${provider.configured ? 'מחובר' : 'לא מוגדר'}`)
      .join(' | ');

    providerStatus.textContent = providers || 'אין ספקים מוגדרים';
    agentStatus.textContent = data.openaiConfigured ? 'AI מחובר' : 'AI בסיסי, חסר OPENAI_API_KEY';
  } catch {
    providerStatus.textContent = 'לא ניתן לבדוק ספקים כרגע';
  }
}

async function runSearch() {
  const request = payload();
  empty('בודק ספקים...', 'פונה לשרת בלבד. מפתחות API לא נחשפים בדפדפן.');
  agentStatus.textContent = 'מחפש חבילות מספקים';

  try {
    const { data, endpoint } = await postPackageSearch(request);
    const results = data.packages || data.results || data.flights || [];
    render(results, data, request);
    agentStatus.textContent = results.length
      ? `נמצאו תוצאות ספק אמיתיות דרך ${endpoint}`
      : 'אין תוצאות ספק לבקשה הזו';
  } catch (error) {
    empty('שגיאת חיבור', error.message, true);
    updateScore([]);
    agentStatus.textContent = 'צריך לבדוק חיבור ספק';
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  await runSearch();
});

quickIdea?.addEventListener('click', () => {
  document.querySelector('#destination').value = '';
  document.querySelector('#priority').value = 'value';
  document.querySelector('#notes').value = 'תציע יעד משתלם עם ביטוח נסיעות וביטול גמיש';
});

openAgent?.addEventListener('click', () => {
  if (agentModal?.showModal) agentModal.showModal();
});

agentBuild?.addEventListener('click', async () => {
  if (agentReply) agentReply.textContent = 'אני בודק עכשיו ספקים אמיתיים. אם חסר מלון, ביטוח או תנאי החזר, אסמן את זה ולא אמציא.';
  await runSearch();
});

empty(
  'מוכן לחיפוש',
  'בחר יעד ולחץ מצא ובדוק חבילה. המערכת תציג רק נתוני ספקים אמיתיים ותסמן מידע חסר.'
);
loadStatus();
