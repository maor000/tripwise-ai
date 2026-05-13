const form = document.querySelector('#tripForm');
const dealGrid = document.querySelector('#dealGrid');
const providerStatus = document.querySelector('#providerStatus');
const agentStatus = document.querySelector('#agentStatus');

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

function payload() {
  return {
    destination: document.querySelector('#destination').value.trim(),
    budget: Number(document.querySelector('#budget').value),
    travelers: document.querySelector('#travelers').value,
    style: document.querySelector('#style').value,
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
    throw new Error('השרת החזיר דף שגיאה במקום JSON. זה אומר שהמסלול של הספק לא נמצא או שהפריסה עדיין לא התעדכנה.');
  }

  try {
    return text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error('התקבלה תשובה לא תקינה מהספק. נסה שוב בעוד רגע.');
  }
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
    missing_data: true,
    missingFields: item.missingFields || ['hotel', 'baggage', 'meals', 'refundable_terms'],
    aiSummary:
      item.aiSummary ||
      'תוצאה אמיתית מספק טיסות. מלון, ארוחות, מזוודה ותנאי החזר לא נמסרו ולכן מסומנים כחסרים.',
  };
}

function render(items = []) {
  if (!items.length) {
    empty(
      'לא נמצאו תוצאות אמיתיות',
      'הספק מחובר, אבל לא החזיר תוצאות לבקשה הזו. נסה יעד אחר או תקציב אחר. אין באתר מחירי דמו.'
    );
    return;
  }

  dealGrid.innerHTML = items
    .map(normalizeProviderResult)
    .map(
      (item) => `<article class="card">
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
          ${item.missing_data ? `<span>חסר מידע: ${esc((item.missingFields || []).join(', '))}</span>` : ''}
        </div>
        <strong class="price">${money(item.price, item.currency)}</strong>
        ${item.supplierUrl ? `<br><a class="booking" href="${esc(item.supplierUrl)}" target="_blank" rel="noopener">פתח הזמנה אצל הספק</a>` : ''}
      </article>`
    )
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
  empty('בודק ספקים...', 'פונה לשרת בלבד. מפתחות API לא נחשפים בדפדפן.');

  try {
    const response = await fetch('/api/search/packages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload()),
      cache: 'no-store',
    });

    const data = await readJsonSafely(response);

    if (!response.ok) {
      throw new Error(data.message || data.error || `Provider API returned ${response.status}`);
    }

    const results = data.packages || data.results || data.flights || [];
    render(results);
    agentStatus.textContent = results.length ? 'נמצאו תוצאות ספק אמיתיות' : 'אין תוצאות ספק לבקשה הזו';
  } catch (error) {
    empty('שגיאת ספק', error.message, true);
  }
});

empty(
  'מוכן לחיפוש',
  'בחר יעד ולחץ מצא חבילות. המערכת תציג רק נתוני ספקים אמיתיים ותסמן מידע חסר.'
);
loadStatus();
