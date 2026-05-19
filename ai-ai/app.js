(() => {
  'use strict';

  const VERSION = '20260519-live-provider-cards-v16';
  const CANONICAL_HOST = 'tripwise-ai-trip-wise-ai.vercel.app';
  const ENDPOINT = '/api/search/packages';
  const STATUS_ENDPOINT = '/api/providers/status';

  const AIRPORTS = {
    TLV: 'תל אביב', ROM: 'רומא', FCO: 'רומא', CIA: 'רומא', ATH: 'אתונה', DXB: 'דובאי', BCN: 'ברצלונה',
    PAR: 'פריז', CDG: 'פריז', ORY: 'פריז', AMS: 'אמסטרדם', LON: 'לונדון', LHR: 'לונדון', LGW: 'לונדון',
    PRG: 'פראג', BUD: 'בודפשט', LCA: 'לרנקה', MLA: 'מלטה', TBS: 'טביליסי', BUS: 'בטומי', VIE: 'וינה',
    BER: 'ברלין', LIS: 'ליסבון', MAD: 'מדריד', IST: 'איסטנבול', HER: 'כרתים'
  };

  const DESTINATIONS = [
    { code: 'LCA', names: ['לרנקה', 'קפריסין', 'cyprus', 'larnaca'] },
    { code: 'ATH', names: ['אתונה', 'athens'] },
    { code: 'BUD', names: ['בודפשט', 'budapest'] },
    { code: 'PRG', names: ['פראג', 'prague'] },
    { code: 'HER', names: ['כרתים', 'crete'] },
    { code: 'IST', names: ['איסטנבול', 'istanbul'] },
    { code: 'ROM', names: ['רומא', 'rome', 'roma'] },
    { code: 'DXB', names: ['דובאי', 'dubai'] },
    { code: 'BCN', names: ['ברצלונה', 'barcelona'] },
    { code: 'PAR', names: ['פריז', 'paris'] },
    { code: 'AMS', names: ['אמסטרדם', 'amsterdam'] },
    { code: 'TBS', names: ['טביליסי', 'tbilisi'] },
    { code: 'BUS', names: ['בטומי', 'batumi'] }
  ];

  const DEFAULT_DESTINATIONS = ['LCA', 'ATH', 'BUD', 'PRG', 'HER', 'IST', 'ROM', 'DXB'];
  const FIELD_NAMES = {
    hotel: 'מלון', baggage: 'מזוודה', checked_baggage: 'מזוודה', meals: 'ארוחות', breakfast: 'ארוחת בוקר',
    refundable_terms: 'תנאי החזר וביטול', insurance_price: 'מחיר ביטוח', supplier_url: 'קישור ספק'
  };

  const $ = (selector) => document.querySelector(selector);
  const form = $('#tripForm');
  const dealGrid = $('#dealGrid');
  const providerStatus = $('#providerStatus');
  const agentStatus = $('#agentStatus');
  const scoreValue = $('#scoreValue');
  const scoreDetails = $('#scoreDetails');
  const quickIdea = $('#quickIdea');
  const openAgent = $('#openAgent');
  const agentModal = $('#agentModal');
  const agentBuild = $('#agentBuild');
  const agentReply = $('#agentReply');

  function html(value = '') {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function redirectToCanonical() {
    if (location.hostname.endsWith('.vercel.app') && location.hostname !== CANONICAL_HOST) {
      location.replace(`https://${CANONICAL_HOST}${location.pathname}${location.search}${location.hash}`);
    }
  }

  function checked(id) {
    return Boolean($('#' + id)?.checked);
  }

  function payload(destinationOverride) {
    return {
      destination: destinationOverride ?? ($('#destination')?.value.trim() || ''),
      budget: Number($('#budget')?.value || 5000),
      travelers: $('#travelers')?.value || 'couple',
      style: $('#style')?.value || 'beach',
      priority: $('#priority')?.value || 'value',
      notes: $('#notes')?.value.trim() || '',
      currency: 'ILS',
      locale: 'he-IL',
      insurance: {
        travel: checked('travelInsurance'),
        life: checked('lifeInsurance'),
        baggage: checked('baggageInsurance'),
        cancellation: checked('cancelInsurance'),
        flexibleOnly: checked('flexibleOnly')
      }
    };
  }

  function resolveDestinations(raw) {
    const value = String(raw || '').trim().toLowerCase();
    if (!value) return DEFAULT_DESTINATIONS;
    const found = DESTINATIONS.find((item) => item.code.toLowerCase() === value || item.names.some((name) => value.includes(name.toLowerCase())));
    return [found?.code || raw];
  }

  function airportName(value) {
    const code = String(value || '').trim().toUpperCase();
    return AIRPORTS[code] || value || 'יעד';
  }

  function airportLabel(value) {
    const code = String(value || '').trim().toUpperCase();
    return AIRPORTS[code] ? `${code} (${AIRPORTS[code]})` : (value || 'יעד');
  }

  function money(value, currency = 'ILS') {
    const amount = Number(value || 0);
    if (!amount) return 'מחיר מהספק';
    return new Intl.NumberFormat('he-IL', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  }

  function timeLabel(value) {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) return 'עכשיו';
    return new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);
  }

  function unique(values) {
    return Array.from(new Set(values.filter(Boolean)));
  }

  function missingLabels(fields = []) {
    const list = unique((fields.length ? fields : ['hotel', 'baggage', 'meals', 'refundable_terms', 'insurance_price']).map((field) => FIELD_NAMES[field] || field));
    return list;
  }

  function insuranceText(request) {
    const selected = [];
    if (request.insurance?.travel) selected.push('ביטוח נסיעות רפואי');
    if (request.insurance?.life) selected.push('חיים/תאונות אישיות');
    if (request.insurance?.baggage) selected.push('כיסוי כבודה');
    if (request.insurance?.cancellation) selected.push('ביטול נסיעה/מצב חירום');
    if (request.insurance?.flexibleOnly) selected.push('העדפת ביטול גמיש');
    return selected.length ? selected.join(', ') : 'לא נבחר ביטוח לבדיקה';
  }

  function empty(title, text, note = '') {
    if (!dealGrid) return;
    dealGrid.innerHTML = `<article class="empty-state"><h3>${html(title)}</h3><p>${html(text)}</p>${note ? `<strong>${html(note)}</strong>` : ''}</article>`;
  }

  async function readJson(response) {
    const type = response.headers.get('content-type') || '';
    const text = await response.text();
    if (!type.includes('application/json')) {
      throw new Error('השרת החזיר דף במקום JSON. צריך לוודא שה־Backend פעיל בפרויקט Vercel הנכון.');
    }
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      throw new Error('התקבלה תשובת ספק לא תקינה. האתר לא מציג מחירי דמה במקום זה.');
    }
  }

  async function fetchPackages(request) {
    const response = await fetch(`${ENDPOINT}?v=${VERSION}&t=${Date.now()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(request),
      cache: 'no-store'
    });
    const data = await readJson(response);
    if (!response.ok) throw new Error(data.message || data.error || 'שגיאת ספק');
    return data;
  }

  function normalize(item = {}) {
    const flight = item.flight || {};
    const code = String(item.destination || flight.destination || '').toUpperCase();
    const missingFields = Array.isArray(item.missingFields) ? item.missingFields : [];
    const completePackage = Boolean(item.completePackage || (item.hotel && item.meals && item.baggage && item.refundable !== undefined));
    const missingData = item.missing_data ?? !completePackage;

    return {
      id: item.id || `${code || 'deal'}-${Math.random().toString(16).slice(2)}`,
      code,
      destination: airportName(code || item.destination),
      flight,
      price: Number(item.price || flight.price || 0),
      currency: item.currency || 'ILS',
      supplierName: item.supplierName || 'Travelpayouts / Aviasales',
      supplierUrl: item.supplierUrl || item.bookingUrl || flight.supplierUrl || '',
      lastCheckedAt: item.lastCheckedAt || new Date().toISOString(),
      verified: item.verified !== false,
      source: item.source || 'provider',
      aiComposed: item.aiComposed === true,
      completePackage,
      missingData,
      missingFields: missingFields.length ? missingFields : missingData ? ['hotel', 'baggage', 'meals', 'refundable_terms', 'insurance_price'] : [],
      refundable: item.refundable,
      cancellationPolicy: item.cancellationPolicy || {},
      confidenceScore: Number(item.confidenceScore || (completePackage ? 86 : 66)),
      summary: item.aiSummary || ''
    };
  }

  function cardTitle(deal) {
    return deal.completePackage ? `חבילה ל${deal.destination}` : `טיסה אמיתית ל${deal.destination}`;
  }

  function cardSummary(deal) {
    if (deal.summary) return deal.summary;
    if (deal.completePackage) return 'החבילה הגיעה מספק מחובר ותדורג לפי מחיר, מלון, טיסה, ארוחות, ביטוח ותנאי ביטול.';
    return 'הספק החזיר מחיר טיסה וקישור הזמנה אמיתי. זו עדיין לא חבילת נופש מלאה עד שנחבר ספק מלונות, ביטוח ותנאי חבילות מלאים.';
  }

  function worthiness(deal, request) {
    const parts = [];
    if (deal.price && request.budget && deal.price <= request.budget) parts.push('המחיר עומד בתקציב שבחרת.');
    if (request.priority === 'cheap') parts.push('ניתנה עדיפות למחיר נמוך.');
    if (request.priority === 'comfort') parts.push('ניתנה עדיפות לנוחות ושעות טיסה.');
    if (request.priority === 'flexible') parts.push('ניתנה עדיפות לביטול גמיש והחזר ברור.');
    if (deal.missingData) parts.push('הציון יורד כי חסרים מלון, ביטוח או תנאי ביטול מלאים.');
    return parts.join(' ') || 'נדרש להשוות מול עוד ספקים לפני סגירה.';
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
      ['אמינות ספק', deal.verified ? 92 : 50],
      ['שלמות חבילה', deal.completePackage ? 90 : 42],
      ['ביטול והחזר', deal.refundable === true ? 84 : 52],
      ['ביטוח', deal.missingFields.includes('insurance_price') ? 35 : 80]
    ];
    scoreValue.textContent = deal.confidenceScore;
    scoreDetails.innerHTML = rows.map(([label, value]) => `
      <div class="score-row"><span>${html(label)}</span><div class="score-bar"><i style="width:${value}%"></i></div><strong>${value}</strong></div>
    `).join('');
  }

  function renderPackage(deal, request) {
    const missing = missingLabels(deal.missingFields);
    return `
      <article class="deal-card provider-card">
        <div class="deal-route provider-route">
          <span>${html(airportLabel(deal.flight.origin || 'TLV'))}</span>
          <strong>→</strong>
          <span>${html(airportLabel(deal.flight.destination || deal.code))}</span>
          <small>${html(deal.supplierName)} · נבדק ${html(timeLabel(deal.lastCheckedAt))}</small>
        </div>
        <div class="deal-body">
          <div class="package-badges">
            <span class="status-badge is-verified">ספק מאומת</span>
            <span class="status-badge">${deal.completePackage ? 'חבילה מלאה מספק' : 'טיסה אמיתית מספק'}</span>
            ${deal.missingData ? '<span class="status-badge is-pending">חסר מידע לחבילה מלאה</span>' : ''}
          </div>
          <h3>${html(cardTitle(deal))}</h3>
          <p>${html(cardSummary(deal))}</p>
          <div class="provider-summary compact-provider-summary">
            <div><strong>מה אמיתי עכשיו</strong><span>מחיר טיסה, יעד וקישור הזמנה מהספק.</span></div>
            <div><strong>מה חסר לחבילה מלאה</strong><span>${html(missing.join(' · ') || 'אין חוסר ידוע')}</span></div>
            <div><strong>ביטוח וביטול</strong><span>${html(insuranceText(request))}. החזר מלחמה/חירום יוצג רק אם ספק או פוליסה מאשרים.</span></div>
          </div>
          <span class="commission-note"><strong>בדיקת כדאיות:</strong> ${html(worthiness(deal, request))}</span>
          <span class="commission-note"><strong>עמלה:</strong> ההזמנה מתבצעת אצל הספק דרך קישור אפיליאייט. הספק מקבל את התשלום, ואתה יכול לקבל עמלה לפי תנאי התוכנית.</span>
          <span class="commission-note"><strong>כלל שקיפות:</strong> ה־AI לא ממציא מלון, ביטוח, מזוודה או החזר. מה שחסר מוצג כחסר עד חיבור ספק מתאים.</span>
          <div class="deal-footer">
            <span class="price">${money(deal.price, deal.currency)}</span>
            <button class="check-button" type="button" data-score="${deal.id}">בדוק כדאיות</button>
          </div>
          ${deal.supplierUrl ? `<a class="booking-link" href="${html(deal.supplierUrl)}" target="_blank" rel="noopener">פתח הזמנה אצל הספק</a>` : '<span class="booking-link is-disabled">אין קישור ספק מאומת</span>'}
        </div>
      </article>
    `;
  }

  function renderPackages(items, request) {
    const deals = items.map(normalize).filter((deal) => deal.price || deal.supplierUrl || deal.code);
    if (!deals.length) {
      empty('לא נמצאו תוצאות אמיתיות', 'הספק מחובר אבל לא החזיר תוצאות לבקשה הזו.', 'אין כאן דמו ואין המצאת חבילות.');
      renderScore(null);
      return;
    }
    deals.sort((a, b) => (a.price || 999999) - (b.price || 999999));
    window.__tripwiseDeals = deals;
    dealGrid.innerHTML = deals.map((deal) => renderPackage(deal, request)).join('');
    renderScore(deals[0]);
  }

  async function runSearch() {
    const baseRequest = payload();
    const destinations = resolveDestinations(baseRequest.destination);
    empty('בודק ספקים אמיתיים...', destinations.length > 1 ? 'לא נבחר יעד, לכן הסוכן בודק כמה יעדים ולא רק רומא.' : 'פונה לשרת בלבד. מפתחות API לא נחשפים בדפדפן.');
    if (agentStatus) agentStatus.textContent = 'מחפש נתוני ספקים';

    try {
      const responses = await Promise.allSettled(destinations.map((code) => fetchPackages(payload(code))));
      const packages = responses.flatMap((result) => {
        if (result.status !== 'fulfilled') return [];
        const data = result.value || {};
        return Array.isArray(data.packages) ? data.packages : [];
      });
      if (!packages.length) {
        const error = responses.find((result) => result.status === 'rejected')?.reason?.message;
        empty('אין תוצאות אמיתיות מהספק', error || 'הספק לא החזיר תוצאות ליעדים שנבדקו.', 'צריך לחבר עוד ספקי מלונות, ביטוח וחבילות מלאות.');
        if (agentStatus) agentStatus.textContent = 'אין תוצאות ספק';
        renderScore(null);
        return;
      }
      renderPackages(packages, baseRequest);
      if (agentStatus) agentStatus.textContent = `נמצאו ${packages.length} תוצאות ספק אמיתיות`;
      $('#deals')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      empty('שגיאת חיבור ספק', error.message, 'המערכת לא מציגה דמו במקום נתוני ספק אמיתיים.');
      if (agentStatus) agentStatus.textContent = 'צריך תיקון API';
      renderScore(null);
    }
  }

  async function checkProviderStatus() {
    if (!providerStatus) return;
    try {
      const response = await fetch(`${STATUS_ENDPOINT}?v=${VERSION}&t=${Date.now()}`, { cache: 'no-store', headers: { Accept: 'application/json' } });
      const data = await readJson(response);
      providerStatus.textContent = (data.providers || [])
        .map((provider) => `${provider.name}: ${provider.configured ? 'מחובר' : 'לא מוגדר'}`)
        .join(' | ') || 'אין ספקים מוגדרים';
      if (agentStatus) agentStatus.textContent = data.openaiConfigured ? 'AI מחובר' : 'AI בסיסי';
    } catch {
      providerStatus.textContent = 'לא ניתן לבדוק ספקים כרגע';
    }
  }

  function wireUi() {
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      runSearch();
    });
    quickIdea?.addEventListener('click', () => {
      if ($('#destination')) $('#destination').value = '';
      if ($('#priority')) $('#priority').value = 'value';
      if ($('#notes')) $('#notes').value = 'תציע כמה יעדים משתלמים עם ביטוח נסיעות וביטול גמיש. לא רק רומא.';
    });
    dealGrid?.addEventListener('click', (event) => {
      const button = event.target.closest('.check-button');
      if (!button) return;
      const deal = (window.__tripwiseDeals || []).find((item) => item.id === button.dataset.score) || (window.__tripwiseDeals || [])[0];
      renderScore(deal);
      if (agentStatus) agentStatus.textContent = 'בדיקת כדאיות לפי מחיר, ספק, ביטול וביטוח';
      $('#compare')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    openAgent?.addEventListener('click', () => {
      if (agentReply) agentReply.textContent = 'הסוכן מדרג ומסביר רק נתוני ספקים אמיתיים. אם חסר מלון, ביטוח, מזוודה או החזר הוא יסמן שחסר ולא ימציא.';
      if (agentModal?.showModal) agentModal.showModal();
    });
    agentBuild?.addEventListener('click', runSearch);
  }

  redirectToCanonical();
  wireUi();
  empty('מוכן לחיפוש', 'בחר יעד או השאר יעד ריק כדי שהסוכן יבדוק כמה יעדים משתלמים ולא יינעל על רומא בלבד.', 'כרגע הספק המחובר מחזיר טיסות אמיתיות. חבילות מלאות דורשות ספקי מלונות, ביטוח וחבילות.');
  checkProviderStatus();
})();
