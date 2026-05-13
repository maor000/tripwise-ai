const form = document.querySelector('#tripForm');
const dealGrid = document.querySelector('#dealGrid');
const providerStatus = document.querySelector('#providerStatus');
const agentStatus = document.querySelector('#agentStatus');

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
    .replaceAll('"', '&quot;');
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

function payload() {
  return {
    destination: document.querySelector('#destination').value.trim(),
    budget: Number(document.querySelector('#budget').value),
    travelers: document.querySelector('#travelers').value,
    style: document.querySelector('#style').value,
    priority: document.querySelector('#priority').value,
    notes: document.querySelector('#notes').value.trim(),
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

async function readJsonSafely(response) {
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();

  if (!contentType.includes('application/json')) {
    throw new Error('השרת החזיר דף שגיאה במקום נתוני ספק. פתח את הכתובת הראשית המעודכנת של האתר או רענן חזק עם Ctrl+F5.');
  }

  try {
    return text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error('התקבלה תשובה לא תקינה מהשרת. אין שימוש במחירי דמו, נסה שוב בעוד רגע.');
  }
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
  return {
    ...item,
    hotel: item.hotel || null,
    flight: item.flight || item,
    baggage: item.baggage || { included: null },
    meals: item.meals || { breakfastIncluded: null },
    refundable: item.refundable ?? null,
    cancellationPolicy: item.cancellationPolicy || {
      summary: 'תנאי ביטול והחזר נקבעים אצל הספק לפני ההזמנה.',
    },
    availabilityStatus: item.availabilityStatus || 'pending_verification',
    verificationStatus: item.verificationStatus || (item.verified ? 'verified' : 'pending_verification'),
    source: item.source || 'provider',
    supplierName: item.supplierName || 'Travelpayouts / Aviasales',
    missing_data: item.missing_data ?? true,
    missingFields: item.missingFields || ['hotel', 'baggage', 'meals', 'refundable_terms', 'insurance_price'],
    aiSummary:
      item.aiSummary ||
      'תוצאה אמיתית מספק טיסות. מלון, ארוחות, מזוודה, ביטוח ותנאי החזר לא נמסרו ולכן מסומנים כחסרים.',
  };
}

function providerErrorText(data) {
  const provider = (data.providers || []).find((item) => item.status === 'provider_error');
  if (!provider) return '';
  const detail = provider.providerMessage || provider.error || data.message || '';
  return detail
    ? `Travelpayouts מחובר, אבל החזיר שגיאה: ${detail}`
    : 'Travelpayouts מחובר, אבל החזיר שגיאה בזמן החיפוש. ייתכן שהטוקן אינו מתאים למסלול הזה או שאין הרשאה לנתונים האלה.';
}

function render(items = [], data = {}, request = payload()) {
  const providerProblem = providerErrorText(data);

  if (providerProblem) {
    empty('שגיאת ספק', `${providerProblem}. אין באתר מחירי דמו ולא נוצרו חבילות מזויפות.`, true);
    return;
  }

  if (!items.length) {
    empty(
      'לא נמצאו תוצאות אמיתיות',
      'הספק מחובר, אבל לא החזיר תוצאות לבקשה הזו. נסה יעד אחר, תקציב אחר או תאריך אחר. אין באתר מחירי דמו.'
    );
    return;
  }

  const insuranceNeeds = selectedInsurance(request);

  dealGrid.innerHTML = items
    .map(normalizeProviderResult)
    .map((item) => {
      const worthiness = worthinessText(item, request);
      return `<article class="card">
        <div class="badges">
          <span class="badge good">${esc(item.verificationStatus)}</span>
          <span class="badge">${esc(item.source)}</span>
          <span class="badge">${item.refundable === true ? 'ניתן להחזר' : 'לפי תנאי ספק'}</span>
          ${item.missing_data ? '<span class="badge warn">חסר מידע</span>' : ''}
        </div>
        <h3>${esc(item.destination || 'יעד מהספק')}</h3>
        <p>${esc(item.aiSummary)}</p>
        <div class="facts">
          <span>ספק: ${esc(item.supplierName)}</span>
          <span>נבדק: ${esc(item.lastCheckedAt || 'עכשיו')}</span>
          <span>סטטוס זמינות: ${esc(item.availabilityStatus)}</span>
          <span>מזוודה: ${item.baggage?.included === true ? 'כלולה' : 'לא נמסר מהספק'}</span>
          <span>ארוחת בוקר: ${item.meals?.breakfastIncluded === true ? 'כלולה' : 'לא נמסר מהספק'}</span>
          <span>ביטול/החזר: ${esc(item.cancellationPolicy?.summary || 'לפי תנאי הספק')}</span>
          <span>ביטוח לבדיקה: ${insuranceNeeds.length ? esc(insuranceNeeds.join(', ')) : 'לא נבחר ביטוח'}</span>
          <span>מחיר ביטוח: צריך חיבור ספק ביטוח כדי להציג מחיר אמיתי.</span>
          ${worthiness ? `<span>כדאיות: ${esc(worthiness)}</span>` : ''}
          ${item.missing_data ? `<span>חסר מידע: ${esc((item.missingFields || []).join(', '))}</span>` : ''}
        </div>
        <strong class="price">${money(item.price, item.currency)}</strong>
        ${item.supplierUrl ? `<br><a class="booking" href="${esc(item.supplierUrl)}" target="_blank" rel="noopener">פתח הזמנה אצל הספק</a>` : ''}
      </article>`;
    })
    .join('');
}

async function loadStatus() {
  try {
    const response = await fetch('/api/providers/status', { cache: 'no-store' });
    const data = await readJsonSafely(response);
    const providers = (data.providers || [])
      .map((provider) => `${provider.name}: ${provider.configured ? 'מחובר' : 'לא מוגדר'}`)
      .join(' | ');

    providerStatus.textContent = providers || 'אין ספקים מוגדרים';
    agentStatus.textContent = data.openaiConfigured ? 'AI מחובר' : 'AI בסיסי, חסר OPENAI_API_KEY';
  } catch (error) {
    providerStatus.textContent = 'לא ניתן לבדוק ספקים כרגע';
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const request = payload();
  empty('בודק ספקים...', 'פונה לשרת בלבד. מפתחות API לא נחשפים בדפדפן.');

  try {
    const response = await fetch('/api/search/packages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      cache: 'no-store',
    });

    const data = await readJsonSafely(response);

    if (!response.ok) {
      throw new Error(data.message || data.error || `Provider API returned ${response.status}`);
    }

    const results = data.packages || data.results || data.flights || [];
    render(results, data, request);
    agentStatus.textContent = results.length ? 'נמצאו תוצאות ספק אמיתיות' : 'אין תוצאות ספק לבקשה הזו';
  } catch (error) {
    empty('שגיאת חיבור', error.message, true);
  }
});

empty(
  'מוכן לחיפוש',
  'בחר יעד ולחץ מצא ובדוק חבילה. המערכת תציג רק נתוני ספקים אמיתיים ותסמן מידע חסר.'
);
loadStatus();
