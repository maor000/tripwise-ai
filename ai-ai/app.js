const API_ENDPOINT = "/api/search/packages";
const PROVIDER_STATUS_ENDPOINT = "/api/providers/status";

const dealGrid = document.querySelector("#dealGrid");
const form = document.querySelector("#tripForm");
const destination = document.querySelector("#destination");
const agentStatus = document.querySelector("#agentStatus");
const quickIdea = document.querySelector("#quickIdea");
const scoreValue = document.querySelector("#scoreValue");
const scoreDetails = document.querySelector("#scoreDetails");
const modal = document.querySelector("#agentModal");
const agentReply = document.querySelector("#agentReply");

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(value, currency = "ILS") {
  const amount = Number(value || 0);
  if (!amount) return "מחיר מהספק";
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(amount);
}

function getSearchPayload() {
  return {
    destination: destination.value.trim(),
    budget: Number(document.querySelector("#budget").value),
    travelers: document.querySelector("#travelers").value,
    style: document.querySelector("#style").value,
    notes: document.querySelector("#notes").value.trim(),
    locale: "he-IL",
    currency: "ILS"
  };
}

function labelForVerification(status, source) {
  if (source === "mock") return "Mock בלבד";
  if (status === "verified") return "מאומת מספק";
  if (status === "pending") return "ממתין לאימות";
  if (status === "missing_data") return "חסר מידע";
  return "בדיקת ספק";
}

function labelForBoolean(value, yes, no, unknown = "לא נמסר מהספק") {
  if (value === true) return yes;
  if (value === false) return no;
  return unknown;
}

function timeLabel(value) {
  if (!value) return "לא נבדק";
  try {
    return new Intl.DateTimeFormat("he-IL", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit"
    }).format(new Date(value));
  } catch {
    return "לא נבדק";
  }
}

function emptyState(title, text, actionText = "") {
  dealGrid.innerHTML = `
    <article class="empty-state">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(text)}</p>
      ${actionText ? `<strong>${escapeHtml(actionText)}</strong>` : ""}
    </article>
  `;
}

function renderLoading() {
  dealGrid.innerHTML = `
    <article class="empty-state">
      <h3>בודק ספקים אמיתיים...</h3>
      <p>המערכת פונה ל-API בצד שרת בלבד. לא נציג חבילה אם אין מקור ספק ברור.</p>
    </article>
  `;
}

function normalizePackage(item) {
  const flight = item.flight || null;
  const hotel = item.hotel || null;
  const baggage = item.baggage || flight?.baggage || {};
  const meals = item.meals || {};
  const cancellationPolicy = item.cancellationPolicy || {};
  const scoreDetailsMap = {
    "אמינות": item.verificationStatus === "verified" ? 92 : item.source === "mock" ? 0 : 68,
    "מחיר": item.price ? 82 : 0,
    "ביטול": item.refundable === true ? 88 : item.refundable === false ? 45 : 55,
    "מזוודה": baggage.included === true ? 85 : baggage.included === false ? 40 : 50,
    "ארוחות": meals.breakfastIncluded === true ? 85 : meals.breakfastIncluded === false ? 40 : 50
  };

  return {
    id: item.id || crypto.randomUUID(),
    title: hotel?.name || flight?.airline || `חבילה ל-${item.destination || "יעד נבחר"}`,
    destination: item.destination || flight?.destination || "",
    dates: item.dates || flight?.dates || {},
    hotel,
    flight,
    baggage,
    meals,
    price: Number(item.price || item.price?.amount || 0),
    currency: item.currency || item.price?.currency || "ILS",
    refundable: item.refundable,
    cancellationPolicy,
    supplierName: item.supplierName || flight?.supplierName || "ספק מחובר",
    supplierUrl: item.supplierUrl || item.bookingUrl || flight?.supplierUrl || "",
    lastCheckedAt: item.lastCheckedAt || item.checkedAt || new Date().toISOString(),
    availabilityStatus: item.availabilityStatus || "pending_verification",
    verificationStatus: item.verificationStatus || (item.source === "mock" ? "mock" : "pending"),
    confidenceScore: Number(item.confidenceScore || item.aiScore || item.score || 0),
    source: item.source || "provider",
    verified: item.verified === true,
    missing_data: item.missing_data === true,
    missingFields: item.missingFields || [],
    aiComposed: item.aiComposed === true,
    aiWarning: item.aiWarning || item.warning || "",
    aiSummary: item.aiSummary || item.aiReason || "המערכת מדרגת רק נתוני ספק אמיתיים ולא ממציאה פרטים חסרים.",
    details: item.details || item.scoreBreakdown || scoreDetailsMap
  };
}

function renderBadges(deal) {
  const verificationClass = deal.source === "mock" ? "is-mock" : deal.verificationStatus === "verified" ? "is-verified" : "is-pending";
  const sourceLabel = deal.source === "ai_composed" ? "AI-composed" : deal.source === "mock" ? "Mock" : "Provider";

  return `
    <div class="package-badges" aria-label="סטטוס חבילה">
      <span class="status-badge ${verificationClass}">${labelForVerification(deal.verificationStatus, deal.source)}</span>
      <span class="status-badge">${escapeHtml(sourceLabel)}</span>
      <span class="status-badge">${escapeHtml(deal.availabilityStatus)}</span>
    </div>
  `;
}

function renderPackageFacts(deal) {
  return `
    <dl class="package-facts">
      <div><dt>ספק</dt><dd>${escapeHtml(deal.supplierName)}</dd></div>
      <div><dt>נבדק</dt><dd>${timeLabel(deal.lastCheckedAt)}</dd></div>
      <div><dt>ביטול</dt><dd>${labelForBoolean(deal.refundable, "ניתן להחזר", "לא ניתן להחזר", "לפי תנאי ספק")}</dd></div>
      <div><dt>מזוודה</dt><dd>${labelForBoolean(deal.baggage?.included, "כלולה", "לא כלולה")}</dd></div>
      <div><dt>בוקר</dt><dd>${labelForBoolean(deal.meals?.breakfastIncluded, "כלולה", "לא כלולה")}</dd></div>
    </dl>
  `;
}

function renderWarnings(deal) {
  const warnings = [];

  if (deal.aiComposed) warnings.push("אזהרה: זו חבילה שה-AI הרכיב מנתוני ספקים. חייבים לוודא כל רכיב לפני הזמנה.");
  if (deal.missing_data) warnings.push(`חסר מידע: ${deal.missingFields.join(", ") || "הספק לא החזיר את כל הפרטים"}. ה-AI לא משלים לבד.`);
  if (deal.source === "mock") warnings.push("Mock: נתון פיתוח בלבד. אסור למכור או להציג כחבילה אמיתית.");
  if (deal.aiWarning) warnings.push(deal.aiWarning);

  if (!warnings.length) return "";

  return `
    <div class="package-warnings">
      ${warnings.map((warning) => `<p>${escapeHtml(warning)}</p>`).join("")}
    </div>
  `;
}

function renderDeals(packages) {
  if (!packages.length) {
    emptyState(
      "לא נמצאו חבילות אמיתיות",
      "Provider API is not configured yet, או שהספק לא החזיר תוצאות לבקשה הזו.",
      "המערכת לא מציגה מחירי דמו ולא ממציאה חבילות."
    );
    return;
  }

  dealGrid.innerHTML = packages
    .map(
      (deal) => `
        <article class="deal-card ${deal.source === "mock" ? "mock-card" : ""}">
          <div class="deal-body">
            ${renderBadges(deal)}
            <div class="deal-meta">
              <span class="pill">${escapeHtml(deal.supplierName)}</span>
              <span>${escapeHtml(deal.destination || "יעד מהספק")}</span>
            </div>
            <h3>${escapeHtml(deal.title)}</h3>
            <p>${escapeHtml(deal.aiSummary)}</p>
            ${renderPackageFacts(deal)}
            <span class="commission-note">${escapeHtml(deal.cancellationPolicy?.summary || "תנאי הביטול יוצגו לפי הספק לפני ההזמנה.")}</span>
            ${renderWarnings(deal)}
            <div class="deal-footer">
              <span class="price">${money(deal.price, deal.currency)}</span>
              <button class="check-button" type="button" data-package='${encodeURIComponent(JSON.stringify(deal))}'>בדוק כדאיות</button>
            </div>
            ${
              deal.supplierUrl
                ? `<a class="booking-link" href="${escapeHtml(deal.supplierUrl)}" target="_blank" rel="noopener">פתח הזמנה אצל הספק</a>`
                : `<span class="booking-link is-disabled">אין קישור הזמנה מאומת</span>`
            }
          </div>
        </article>
      `
    )
    .join("");
}

function renderScore(deal) {
  scoreValue.textContent = deal.confidenceScore || deal.score || "--";
  const entries = Object.entries(deal.details || {});

  if (!entries.length) {
    scoreDetails.innerHTML = `
      <p class="score-empty">הספק החזיר חבילה, אבל לא החזיר מספיק נתונים לפירוט ציון מלא.</p>
    `;
    return;
  }

  scoreDetails.innerHTML = entries
    .map(
      ([label, value]) => `
        <div class="score-row">
          <span>${escapeHtml(label)}</span>
          <div class="bar" aria-hidden="true"><i style="width:${Number(value)}%"></i></div>
          <strong>${Number(value)}</strong>
        </div>
      `
    )
    .join("");
}

async function loadProviderStatus() {
  try {
    const response = await fetch(PROVIDER_STATUS_ENDPOINT);
    if (!response.ok) return;
    const data = await response.json();
    const connected = (data.providers || []).filter((provider) => provider.configured && provider.source === "provider");
    agentStatus.textContent = connected.length ? `מחובר לספק: ${connected.map((provider) => provider.name).join(", ")}` : "Provider API is not configured yet.";
  } catch {
    agentStatus.textContent = "בודק חיבור ספקים";
  }
}

async function searchPackages() {
  renderLoading();
  agentStatus.textContent = "מחפש חבילות מספקים";

  try {
    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(getSearchPayload())
    });

    if (!response.ok) throw new Error(`Provider API returned ${response.status}`);

    const data = await response.json();
    const packages = (data.packages || data.results || []).map(normalizePackage);
    renderDeals(packages);

    if (packages[0]) {
      renderScore(packages[0]);
      const realCount = packages.filter((item) => item.source === "provider").length;
      agentStatus.textContent = `נמצאו ${realCount} תוצאות ספק. ${data.ai?.missing_data ? "יש פרטים חסרים שסומנו." : ""}`;
    } else {
      scoreValue.textContent = "--";
      scoreDetails.innerHTML = "";
      agentStatus.textContent = data.providers?.some((provider) => provider.configured)
        ? "הספק מחובר אבל אין תוצאות לבקשה"
        : "Provider API is not configured yet.";
    }

    document.querySelector("#deals").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    emptyState(
      "שגיאת ספק",
      "האתר לא מציג דמו. הייתה שגיאה בקריאת ספק הנסיעות או שה-API עדיין לא מוגדר.",
      error.message
    );
    scoreValue.textContent = "--";
    scoreDetails.innerHTML = "";
    agentStatus.textContent = "נדרש תיקון חיבור ספק";
  }
}

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((item) => item.classList.remove("is-active"));
    tab.classList.add("is-active");
    if (tab.dataset.mode !== "known") {
      destination.value = "";
      destination.placeholder = tab.dataset.mode === "ideas" ? "אפשר להשאיר ריק, הסוכן יציע" : "הסוכן ירכיב יעד וחבילה";
    } else {
      destination.placeholder = "לדוגמה: כרתים, רומא, דובאי";
    }
  });
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  searchPackages();
});

quickIdea.addEventListener("click", () => {
  destination.value = "";
  document.querySelector("#style").value = "cheap";
  searchPackages();
});

dealGrid.addEventListener("click", (event) => {
  const button = event.target.closest(".check-button");
  if (!button) return;
  const deal = JSON.parse(decodeURIComponent(button.dataset.package));
  renderScore(deal);
  agentStatus.textContent = `בדיקת כדאיות: ${deal.title}`;
  document.querySelector("#compare").scrollIntoView({ behavior: "smooth", block: "center" });
});

document.querySelector("#openAgent").addEventListener("click", () => {
  modal.showModal();
});

document.querySelector("#agentBuild").addEventListener("click", () => {
  agentReply.textContent =
    "ה-AI מדרג ומסביר רק נתוני ספקים אמיתיים. אם חסר מלון, מזוודה, ארוחות או תנאי החזר, הוא יסמן missing_data ולא ימציא.";
});

emptyState(
  "מוכן לחיבור ספקים",
  "בחר יעד או בקש רעיון. חבילות יופיעו רק מספק/API אמיתי, או mock מסומן בפיתוח בלבד.",
  "אין באתר מחירי דמו."
);

loadProviderStatus();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      agentStatus.textContent = "האתר עובד, התקנת אפליקציה תופעל בשרת";
    });
  });
}

