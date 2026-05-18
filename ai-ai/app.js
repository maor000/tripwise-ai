(() => {
  'use strict';

  const VERSION = '20260518-provider-components-v11';
  const AIRPORTS = {
    TLV: 'תל אביב', ROM: 'רומא', FCO: 'רומא', CIA: 'רומא', HER: 'כרתים', ATH: 'אתונה',
    DXB: 'דובאי', PAR: 'פריז', CDG: 'פריז', ORY: 'פריז', LON: 'לונדון', LHR: 'לונדון',
    LGW: 'לונדון', AMS: 'אמסטרדם', BCN: 'ברצלונה', MAD: 'מדריד', IST: 'איסטנבול',
    LCA: 'לרנקה', BUD: 'בודפשט', PRG: 'פראג', VIE: 'וינה', BER: 'ברלין', LIS: 'ליסבון',
    MLA: 'מלטה', TBS: 'טביליסי', BUS: 'בטומי'
  };
  const FIELD_NAMES = {
    hotel: 'מלון',
    baggage: 'מזוודה',
    meals: 'ארוחות',
    refundable_terms: 'תנאי החזר וביטול',
    insurance_price: 'מחיר ביטוח'
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

  function checked(id) {
    return Boolean($('#' + id)?.checked);
  }

  function payload() {
    return {
      destination: $('#destination')?.value.trim() || '',
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

  function airport(value) {
    const code = String(value || '').toUpperCase();
    return AIRPORTS[code] ? `${code} (${AIRPORTS[code]})` : (value || 'יעד מספק');
  }

  function destinationName(value) {
    const code = String(value || '').toUpperCase();
    return AIRPORTS[code] || value || 'יעד מספק';
  }

  function money(value, currency = 'ILS') {
    const amount = Number(value || 0);
    if (!amount) return 'מחיר מהספק';
    return new Intl.NumberFormat('he-IL', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  }

  function checkedAt(value) {
    try {
      return new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
    } catch {
      return 'עכשיו';
    }
  }

  function missingText(fields = []) {
    const list = fields.length ? fields : ['hotel', 'baggage', 'meals', 'refundable_terms', 'insurance_price'];
    return list.map((field) => FIELD_NAMES[field] || field).join(', ');
  }

  function isFlightOnlyProvider(deal) {
    const supplier = String(deal.supplierName || '').toLowerCase();
    return supplier.includes('travelpayouts') || supplier.includes('aviasales');
  }

  function componentText(field, deal) {
    if (!isFlightOnlyProvider(deal)) return 'נדרש אימות מול הספק';
    const labels = {
      hotel: 'נדרש חיבור ספק מלונות',
      baggage: 'לא נמסר ב-API הטיסות',
      meals: 'נדרש ספק מלונות/חבילות',
      breakfast: 'נדרש ספק מלונות/חבילות',
      refundable: 'נדרש אימות תנאי כרטיס',
      cancellation: 'נדרש אימות תנאי ספק/ביטוח',
      insurance: 'נדרש חיבור ספק ביטוח'
    };
    return labels[field] || 'נדרש ספק נוסף';
  }

  function boolText(value, yes, no, unknown) {
    if (value === true) return yes;
    if (value === false) return no;
    return unknown;
  }

  function worthinessText(deal) {
    if (deal.completePackage) return 'כדאיות: חבילה מלאה מספק מחובר. הדירוג לפי מחיר, נוחות, ביטול, ביטוח ואמינות.';
    return 'כדאיות: המחיר וקישור ההזמנה הגיעו מספק טיסות אמיתי. כדי להפוך את זה לחבילה מלאה צריך לחבר ספק מלונות, ביטוח ותנאי ביטול.';
  }

  function empty(title, text, note = '') {
    if (!dealGrid) return;
    dealGrid.innerHTML = `<article class="empty-state"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p>${note ? `<strong>${escapeHtml(note)}</strong>` : ''}</article>`;
  }

  async function readJson(response) {
    const type = response.headers.get('content-type') || '';
    const text = await response.text();
    if (!type.includes('application/json')) {
      throw new Error('השרת לא החזיר JSON. זה בדרך כלל אומר שנתיב ה-API לא עלה נכון ב-Vercel.');
    }
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      throw new Error('התקבלה תשובה לא תקינה מהספק.');
    }
  }

  function normalizePackage(item = {}) {
    const flight = item.flight || {};
    const code = item.destination || flight.destination || '';
    const missingFields = Array.isArray(item.missingFields) ? item.missingFields : ['hotel', 'baggage', 'meals', 'refundable_terms', 'insurance_price'];
    const completePackage = Boolean(item.completePackage || (item.hotel && item.meals && item.baggage && item.refundable != null));

    return {
      id: item.id || Math.random().toString(16).slice(2),
      destination: destinationName(code),
      code,
      flight,
      hotel: item.hotel || null,
      baggage: item.baggage || { included: null },
      meals: item.meals || { breakfastIncluded: null },
      price: Number(item.price || flight.price || 0),
      currency: item.currency || 'ILS',
      refundable: item.refundable,
      cancellationPolicy: item.cancellationPolicy || {},
      supplierName: item.supplierName || 'Travelpayouts / Aviasales',
      supplierUrl: item.supplierUrl || item.bookingUrl || '',
      lastCheckedAt: item.lastCheckedAt || new Date().toISOString(),
      verified: item.verified !== false,
      source: item.source || 'provider',
      aiComposed: item.aiComposed === true,
      completePackage,
      missing_data: item.missing_data ?? !completePackage,
      missingFields,
      confidenceScore: Number(item.confidenceScore || 70),
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
      ['אמינות ספק', deal.verified ? 92 : 60],
      ['שלמות חבילה', deal.completePackage ? 90 : 45],
      ['ביטול והחזר', deal.refundable === true ? 88 : 55],
      ['ביטוח', deal.missingFields.includes('insurance_price') ? 40 : 75]
    ];

    scoreValue.textContent = deal.confidenceScore || Math.round(rows.reduce((sum, row) => sum + row[1], 0) / rows.length);
    scoreDetails.innerHTML = rows.map(([label, value]) => `
      <div class="score-row">
        <span>${escapeHtml(label)}</span>
        <div class="score-bar"><i style="width:${value}%"></i></div>
        <strong>${value}</strong>
      </div>
    `).join('');
  }

  function insuranceText(request) {
    const selected = [];
    if (request.insurance.travel) selected.push('ביטוח נסיעות רפואי');
    if (request.insurance.life) selected.push('חיים/תאונות אישיות');
    if (request.insurance.baggage) selected.push('כיסוי כבודה');
    if (request.insurance.cancellation) selected.push('ביטול נסיעה/מצב חירום');
    if (request.insurance.flexibleOnly) selected.push('העדפת ביטול גמיש');
    return selected.join(', ') || 'לא נבחר ביטוח';
  }

  function renderPackages(items, request) {
    const deals = items.map(normalizePackage);
    if (!deals.length) {
      empty('לא נמצאו תוצאות אמיתיות', 'הספק מחובר, אבל לא החזיר תוצאות לבקשה הזו.', 'אין באתר מחירי דמה ואין המצאת חבילות.');
      updateScore(null);
      return;
    }

    dealGrid.innerHTML = deals.map((deal) => {
      const title = deal.completePackage ? `חבילה ל${deal.destination}` : `טיסה אמיתית ל${deal.destination}`;
      const summary = deal.aiSummary || 'מה שחזר מהספק: מחיר טיסה וקישור הזמנה. מלון, ארוחות, מזוודה, ביטוח ותנאי החזר דורשים חיבור ספקים נוספים, ולכן הם מסומנים כחסרים ולא מומצאים.';
      const bookingText = deal.completePackage ? 'פתח הזמנה אצל הספק' : 'פתח טיסה אצל הספק';

      return `
        <article class="deal-card provider-card">
          <div class="provider-route">
            <span>${escapeHtml(airport(deal.flight.origin || 'TLV'))}</span>
            <strong>→</strong>
            <span>${escapeHtml(airport(deal.flight.destination || deal.code))}</span>
          </div>
          <div class="deal-body">
            <div class="package-badges">
              <span class="status-badge is-verified">ספק מאומת</span>
              <span class="status-badge">טיסה אמיתית מספק</span>
              <span class="status-badge is-pending">לא חבילה מלאה עדיין</span>
            </div>
            <p class="supplier-line">${escapeHtml(deal.supplierName)} · נבדק ${escapeHtml(checkedAt(deal.lastCheckedAt))}</p>
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(summary)}</p>
            <dl class="package-facts compact-facts">
              <div><dt>מלון</dt><dd>${deal.hotel?.name ? escapeHtml(deal.hotel.name) : componentText('hotel', deal)}</dd></div>
              <div><dt>מזוודה</dt><dd>${boolText(deal.baggage?.included, 'כלולה', 'לא כלולה', componentText('baggage', deal))}</dd></div>
              <div><dt>ארוחת בוקר</dt><dd>${boolText(deal.meals?.breakfastIncluded, 'כלולה', 'לא כלולה', componentText('breakfast', deal))}</dd></div>
              <div><dt>ביטול</dt><dd>${boolText(deal.refundable, 'יש החזר לפי ספק', 'ללא החזר לפי ספק', componentText('cancellation', deal))}</dd></div>
              <div><dt>ביטוח</dt><dd>${escapeHtml(`${insuranceText(request)} · ${componentText('insurance', deal)}`)}</dd></div>
            </dl>
            <span class="commission-note">${escapeHtml(worthinessText(deal))}</span>
            <span class="commission-note">ביטול: ${escapeHtml(deal.cancellationPolicy.summary || 'תנאי מלחמה, חירום והחזר נקבעים אצל הספק או פוליסת הביטוח לפני ההזמנה.')}</span>
            <div class="package-warnings">
              <p>מה שחזר מהספק: מחיר טיסה וקישור הזמנה. מה שעדיין דורש ספקים נוספים: ${escapeHtml(missingText(deal.missingFields))}. ה-AI לא ממציא מלון, ביטוח, מזוודה או החזר.</p>
            </div>
            <div class="deal-footer">
              <span class="price">${money(deal.price, deal.currency)}</span>
              <button class="check-button" type="button" data-id="${escapeHtml(deal.id)}">בדוק כדאיות</button>
            </div>
            ${deal.supplierUrl
              ? `<a class="booking-link" href="${escapeHtml(deal.supplierUrl)}" target="_blank" rel="noopener">${bookingText}</a>`
              : '<span class="booking-link is-disabled">אין קישור ספק מאומת</span>'}
          </div>
        </article>
      `;
    }).join('');

    updateScore(deals[0]);
  }

  async function runSearch() {
    const request = payload();
    empty('בודק ספקים אמיתיים...', 'פונה לשרת בלבד. מפתחות API לא נחשפים בדפדפן.');
    if (agentStatus) agentStatus.textContent = 'מחפש נתוני ספקים';

    try {
      const response = await fetch(`/api/search/packages?v=${VERSION}&t=${Date.now()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(request),
        cache: 'no-store'
      });
      const data = await readJson(response);
      const packages = data.packages || [];

      if (!packages.length) {
        const providerError = (data.providers || []).find((provider) => provider.status === 'provider_error');
        empty(
          providerError ? 'שגיאת ספק' : 'אין תוצאות אמיתיות',
          providerError?.providerMessage || providerError?.error || data.message || 'הספק לא החזיר תוצאות.',
          'אין באתר מחירי דמה.'
        );
        if (agentStatus) agentStatus.textContent = providerError ? 'צריך לבדוק ספק' : 'אין תוצאות לבקשה';
        updateScore(null);
        return;
      }

      renderPackages(packages, request);
      if (agentStatus) agentStatus.textContent = `נמצאו ${packages.length} טיסות אמיתיות מספק`;
      document.querySelector('#deals')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      empty('שגיאת חיבור ספק', error.message, 'המערכת לא מציגה דמו במקום נתונים אמיתיים.');
      if (agentStatus) agentStatus.textContent = 'צריך תיקון API';
      updateScore(null);
    }
  }

  async function checkProviderStatus() {
    if (!providerStatus) return;
    try {
      const response = await fetch(`/api/providers/status?v=${VERSION}&t=${Date.now()}`, { cache: 'no-store' });
      const data = await readJson(response);
      providerStatus.textContent = (data.providers || [])
        .map((provider) => `${provider.name}: ${provider.configured ? 'מחובר' : 'לא מוגדר'}`)
        .join(' | ') || 'אין ספקים';
      if (agentStatus) agentStatus.textContent = data.openaiConfigured ? 'AI מחובר' : 'AI בסיסי';
    } catch {
      providerStatus.textContent = 'לא ניתן לבדוק ספקים כרגע';
    }
  }

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    runSearch();
  });

  quickIdea?.addEventListener('click', () => {
    if ($('#destination')) $('#destination').value = '';
    if ($('#priority')) $('#priority').value = 'value';
    if ($('#notes')) $('#notes').value = 'תציע כמה יעדים משתלמים עם ביטוח נסיעות וביטול גמיש, לא רק רומא';
  });

  dealGrid?.addEventListener('click', (event) => {
    const button = event.target.closest('.check-button');
    if (!button) return;
    const card = button.closest('.deal-card');
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (agentStatus) agentStatus.textContent = 'בדיקת כדאיות עודכנה לפי מחיר, ספק, ביטול וביטוח';
  });

  openAgent?.addEventListener('click', () => {
    if (agentReply) {
      agentReply.textContent = 'הסוכן מדרג ומסביר רק נתוני ספקים אמיתיים. אם חסר מלון, ביטוח, מזוודה או החזר הוא יסמן שחסר ולא ימציא.';
    }
    if (agentModal?.showModal) agentModal.showModal();
  });

  agentBuild?.addEventListener('click', runSearch);

  empty(
    'מוכן לחיפוש',
    'בחר יעד או השאר יעד ריק כדי שהסוכן יחפש כמה יעדים משתלמים ולא יינעל על רומא בלבד.',
    'כרגע הספק המחובר מחזיר טיסות אמיתיות. מלונות, ביטוח וחבילות מלאות דורשים ספקים נוספים ויסומנו כחסרים.'
  );
  checkProviderStatus();
})();
