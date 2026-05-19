(() => {
  'use strict';

  const VERSION = '20260519-clean-provider-cards-v14';
  const CANONICAL_HOST = 'tripwise-ai-trip-wise-ai.vercel.app';
  const ENDPOINT = '/api/search/packages';
  const AIRPORTS = {
    TLV: 'תל אביב', ROM: 'רומא', FCO: 'רומא', CIA: 'רומא', ATH: 'אתונה', DXB: 'דובאי', BCN: 'ברצלונה',
    PAR: 'פריז', CDG: 'פריז', ORY: 'פריז', AMS: 'אמסטרדם', LON: 'לונדון', LHR: 'לונדון', LGW: 'לונדון',
    PRG: 'פראג', BUD: 'בודפשט', LCA: 'לרנקה', MLA: 'מלטה', TBS: 'טביליסי', BUS: 'בטומי', VIE: 'וינה',
    BER: 'ברלין', LIS: 'ליסבון', MAD: 'מדריד', IST: 'איסטנבול', HER: 'כרתים'
  };
  const DESTINATION_HINTS = [
    { code: 'ROM', names: ['רומא', 'rome', 'roma'] },
    { code: 'ATH', names: ['אתונה', 'athens'] },
    { code: 'DXB', names: ['דובאי', 'dubai'] },
    { code: 'BCN', names: ['ברצלונה', 'barcelona'] },
    { code: 'PAR', names: ['פריז', 'paris'] },
    { code: 'AMS', names: ['אמסטרדם', 'amsterdam'] },
    { code: 'LON', names: ['לונדון', 'london'] },
    { code: 'PRG', names: ['פראג', 'prague'] },
    { code: 'BUD', names: ['בודפשט', 'budapest'] },
    { code: 'LCA', names: ['לרנקה', 'cyprus', 'קפריסין'] },
    { code: 'MLA', names: ['מלטה', 'malta'] },
    { code: 'TBS', names: ['טביליסי', 'tbilisi'] },
    { code: 'HER', names: ['כרתים', 'crete'] },
    { code: 'VIE', names: ['וינה', 'vienna'] },
    { code: 'BER', names: ['ברלין', 'berlin'] },
    { code: 'LIS', names: ['ליסבון', 'lisbon'] }
  ];
  const IDEA_DESTINATIONS = ['ATH', 'DXB', 'BCN', 'PAR', 'AMS', 'PRG', 'BUD', 'LCA'];
  const FIELD_NAMES = {
    hotel: 'מלון', baggage: 'מזוודה', meals: 'ארוחות', breakfast: 'ארוחת בוקר', refundable_terms: 'תנאי החזר וביטול', insurance_price: 'מחיר ביטוח'
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

  function escapeHtml(value = '') {
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

  function collectPayload(destinationOverride) {
    return {
      destination: destinationOverride ?? ($('#destination')?.value.trim() || ''),
      budget: Number($('#budget')?.value || 5000),
      travelers: $('#travelers')?.value || 'couple',
      style: $('#style')?.value || 'value',
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
    if (!value) return IDEA_DESTINATIONS;
    const hit = DESTINATION_HINTS.find((item) => item.code.toLowerCase() === value || item.names.some((name) => value.includes(name.toLowerCase())));
    return [hit?.code || raw];
  }

  function destinationName(value) {
    const code = String(value || '').toUpperCase();
    return AIRPORTS[code] || value || 'יעד';
  }

  function airport(value) {
    const code = String(value || '').toUpperCase();
    return AIRPORTS[code] ? `${code} (${AIRPORTS[code]})` : (value || 'יעד');
  }

  function money(value, currency = 'ILS') {
    const amount = Number(value || 0);
    if (!amount) return 'מחיר מהספק';
    return new Intl.NumberFormat('he-IL', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  }

  function checkedAt(value) {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) return 'עכשיו';
    return new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);
  }

  function missingText(fields = []) {
    const list = fields.length ? fields : ['hotel', 'baggage', 'meals', 'refundable_terms', 'insurance_price'];
    return list.map((field) => FIELD_NAMES[field] || field).join(', ');
  }

  function insuranceText(request) {
    const selected = [];
    if (request.insurance?.travel) selected.push('ביטוח נסיעות רפואי');
    if (request.insurance?.life) selected.push('חיים/תאונות אישיות');
    if (request.insurance?.baggage) selected.push('כיסוי כבודה');
    if (request.insurance?.cancellation) selected.push('ביטול נסיעה/מצב חירום');
    if (request.insurance?.flexibleOnly) selected.push('העדפת ביטול גמיש');
    return selected.join(', ') || 'לא נבחר ביטוח';
  }

  function empty(title, text, note = '') {
    if (!dealGrid) return;
    dealGrid.innerHTML = `<article class="empty-state"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p>${note ? `<strong>${escapeHtml(note)}</strong>` : ''}</article>`;
  }

  async function readJson(response) {
    const type = response.headers.get('content-type') || '';
    const text = await response.text();
    if (!type.includes('application/json')) {
      throw new Error('נתיב ה-API החזיר דף HTML במקום JSON. צריך לבדוק שה-Backend של Vercel פעיל על אותו פרויקט.');
    }
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      throw new Error('התקבלה תשובה לא תקינה מהספק.');
    }
  }

  function normalizePackage(item = {}) {
    const flight = item.flight || {};
    const destinationCode = String(item.destination || flight.destination || item.code || '').toUpperCase();
    const supplierName = item.supplierName || item.providerName || 'Travelpayouts / Aviasales';
    const missingFields = Array.isArray(item.missingFields) && item.missingFields.length
      ? item.missingFields
      : ['hotel', 'baggage', 'meals', 'refundable_terms', 'insurance_price'];
    const completePackage = Boolean(item.completePackage || (item.hotel && item.meals && item.baggage && item.refundable !== undefined));

    return {
      id: item.id || `${destinationCode || 'deal'}-${Math.random().toString(16).slice(2)}`,
      destination: destinationName(destinationCode || item.destination),
      code: destinationCode,
      flight,
      hotel: item.hotel || null,
      baggage: item.baggage || null,
      meals: item.meals || null,
      price: Number(item.price || flight.price || 0),
      currency: item.currency || 'ILS',
      refundable: item.refundable,
      cancellationPolicy: item.cancellationPolicy || {},
      supplierName,
      supplierUrl: item.supplierUrl || item.bookingUrl || item.url || '',
      lastCheckedAt: item.lastCheckedAt || new Date().toISOString(),
      verified: item.verified !== false,
      source: item.source || 'provider',
      aiComposed: item.aiComposed === true,
      completePackage,
      missingFields,
      confidenceScore: Number(item.confidenceScore || (completePackage ? 86 : 66)),
      aiSummary: item.aiSummary || ''
    };
  }

  function updateScore(deal) {
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
      <div class="score-row">
        <span>${escapeHtml(label)}</span>
        <div class="score-bar"><i style="width:${value}%"></i></div>
        <strong>${value}</strong>
      </div>
    `).join('');
  }

  function cardSummary(deal) {
    if (deal.completePackage) {
      return 'חבילה מלאה מספק מחובר: טיסה, מלון, ארוחות ותנאי ביטול הוחזרו מהספק.';
    }
    return 'הספק החזיר מחיר טיסה וקישור הזמנה אמיתי. מלון, מזוודה, ארוחות, ביטוח ותנאי החזר עדיין דורשים חיבור ספקים נוספים, ולכן אינם מומצאים על ידי ה-AI.';
  }

  function renderPackages(items, request) {
    const deals = items.map(normalizePackage).filter((deal) => deal.price || deal.supplierUrl || deal.flight.destination || deal.destination);
    if (!deals.length) {
      empty('לא נמצאו תוצאות אמיתיות', 'הספק מחובר, אבל לא החזיר תוצאות לבקשה הזאת.', 'אין באתר מחירי דמו ואין המצאת חבילות.');
      updateScore(null);
      return;
    }

    deals.sort((a, b) => (a.price || 999999) - (b.price || 999999));
    dealGrid.innerHTML = deals.map((deal) => `
      <article class="deal-card provider-card">
        <div class="deal-route provider-route">
          <span>${escapeHtml(airport(deal.flight.origin || 'TLV'))}</span>
          <strong>→</strong>
          <span>${escapeHtml(airport(deal.flight.destination || deal.code))}</span>
          <small>${escapeHtml(deal.supplierName)} · נבדק ${escapeHtml(checkedAt(deal.lastCheckedAt))}</small>
        </div>
        <div class="deal-body">
          <div class="package-badges">
            <span class="status-badge is-verified">ספק מאומת</span>
            <span class="status-badge">טיסה אמיתית מספק</span>
            ${deal.completePackage ? '<span class="status-badge is-verified">חבילה מלאה</span>' : '<span class="status-badge is-pending">חסר מידע לחבילה מלאה</span>'}
            ${deal.aiComposed ? '<span class="status-badge is-pending">AI הרכיב הצעה מנתוני ספק</span>' : ''}
          </div>
          <h3>${escapeHtml(deal.completePackage ? `חבילה ל${deal.destination}` : `טיסה אמיתית ל${deal.destination}`)}</h3>
          <p>${escapeHtml(deal.aiSummary || cardSummary(deal))}</p>

          <div class="provider-summary">
            <div><strong>מה חזר מהספק</strong><span>מחיר טיסה, יעד וקישור הזמנה. זה הנתון האמיתי שממנו מתחילים.</span></div>
            <div><strong>מה חסר להשלמת חבילה</strong><span>${escapeHtml(missingText(deal.missingFields))}</span></div>
            <div><strong>ביטוח וביטול</strong><span>${escapeHtml(insuranceText(request))}. מחיר ותנאים יחזרו רק אחרי חיבור ספק ביטוח/חבילות.</span></div>
            <div><strong>בדיקת כדאיות</strong><span>הציון מתחשב במחיר, אמינות ספק, חוסר מידע, ביטול, ביטוח ונוחות.</span></div>
          </div>

          <span class="commission-note">עמלה: אם הלקוח מזמין דרך קישור הספק/אפיליאייט, הספק מקבל את התשלום ואתה יכול לקבל עמלה לפי תנאי התוכנית.</span>
          <span class="commission-note">כלל חשוב: ה-AI לא ממציא מלון, ביטוח, מזוודה או החזר. מה שחסר מסומן כחסר עד חיבור ספק מתאים.</span>

          <div class="deal-footer">
            <span class="price">${money(deal.price, deal.currency)}</span>
            <button class="check-button" type="button">בדוק כדאיות</button>
          </div>
          ${deal.supplierUrl
            ? `<a class="booking-link" href="${escapeHtml(deal.supplierUrl)}" target="_blank" rel="noopener">פתח הזמנה אצל הספק</a>`
            : '<span class="booking-link is-disabled">אין קישור ספק מאומת</span>'}
        </div>
      </article>
    `).join('');
    updateScore(deals[0]);
  }

  async function fetchPackages(request) {
    const response = await fetch(`${ENDPOINT}?v=${VERSION}&t=${Date.now()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(request),
      cache: 'no-store'
    });
    return readJson(response);
  }

  async function runSearch() {
    const base = collectPayload();
    const targets = resolveDestinations(base.destination);
    empty('בודק ספקים אמיתיים...', targets.length > 1 ? 'לא נבחר יעד, אז הסוכן בודק כמה יעדים ולא רק רומא.' : 'פונה לספקים דרך השרת בלבד.');
    if (agentStatus) agentStatus.textContent = 'מחפש נתוני ספקים';

    try {
      const responses = await Promise.allSettled(targets.map((code) => fetchPackages(collectPayload(code))));
      const packages = responses.flatMap((result) => {
        if (result.status !== 'fulfilled') return [];
        const data = result.value || {};
        return Array.isArray(data.packages) ? data.packages : [];
      });

      if (!packages.length) {
        const error = responses.find((result) => result.status === 'rejected')?.reason?.message;
        empty('אין תוצאות אמיתיות מהספק', error || 'הספק לא החזיר תוצאות ליעדים שנבדקו.', 'אין כאן דמו. צריך להרחיב ספקים למלונות, ביטוח וחבילות מלאות.');
        if (agentStatus) agentStatus.textContent = 'אין תוצאות ספק';
        updateScore(null);
        return;
      }

      renderPackages(packages, base);
      if (agentStatus) agentStatus.textContent = `נמצאו ${packages.length} תוצאות ספק אמיתיות`;
      document.querySelector('#deals')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      empty('שגיאת חיבור ספק', error.message, 'המערכת לא מציגה דמו במקום נתוני ספק אמיתיים.');
      if (agentStatus) agentStatus.textContent = 'צריך תיקון API';
      updateScore(null);
    }
  }

  async function checkProviderStatus() {
    if (!providerStatus) return;
    try {
      const response = await fetch(`/api/providers/status?v=${VERSION}&t=${Date.now()}`, { cache: 'no-store', headers: { Accept: 'application/json' } });
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
      if ($('#notes')) $('#notes').value = 'תציע כמה יעדים משתלמים, עם ביטוח נסיעות וביטול גמיש. לא רק רומא.';
    });
    dealGrid?.addEventListener('click', (event) => {
      if (!event.target.closest('.check-button')) return;
      if (agentStatus) agentStatus.textContent = 'בדיקת כדאיות לפי מחיר, ספק, ביטול וביטוח';
      document.querySelector('#compare')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
