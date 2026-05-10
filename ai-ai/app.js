const API_ENDPOINT = "/api/packages/search";

const dealGrid = document.querySelector("#dealGrid");
const form = document.querySelector("#tripForm");
const destination = document.querySelector("#destination");
const agentStatus = document.querySelector("#agentStatus");
const quickIdea = document.querySelector("#quickIdea");
const scoreValue = document.querySelector("#scoreValue");
const scoreDetails = document.querySelector("#scoreDetails");
const modal = document.querySelector("#agentModal");
const agentReply = document.querySelector("#agentReply");

function money(value, currency = "ILS") {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(value);
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

function emptyState(title, text, actionText = "") {
  dealGrid.innerHTML = `
    <article class="empty-state">
      <h3>${title}</h3>
      <p>${text}</p>
      ${actionText ? `<strong>${actionText}</strong>` : ""}
    </article>
  `;
}

function renderLoading() {
  dealGrid.innerHTML = `
    <article class="empty-state">
      <h3>בודק ספקים אמיתיים...</h3>
      <p>המערכת מחפשת חבילות דרך נקודת API. לא יוצגו תוצאות אם אין ספק נסיעות מחובר.</p>
    </article>
  `;
}

function normalizePackage(item) {
  const commission = item.commission || item.affiliateCommission || item.partnerCommission || null;
  const cancellationPolicy = item.cancellationPolicy || item.refundPolicy || null;

  return {
    id: item.id || item.packageId || crypto.randomUUID(),
    title: item.title || item.hotelName || item.destination || "חבילת נופש",
    destination: item.destination || "",
    price: Number(item.price?.amount || item.price || 0),
    currency: item.price?.currency || item.currency || "ILS",
    tag: item.tag || item.provider || "ספק מחובר",
    meta: item.meta || [item.nights ? `${item.nights} לילות` : "", item.hotelRating ? `מלון ${item.hotelRating}` : "", item.mealPlan || ""].filter(Boolean).join(" · "),
    image: item.image || item.imageUrl || "",
    reason: item.reason || item.aiReason || "החבילה הגיעה מספק מחובר ותדורג לפי מחיר, טיסה, מלון, ארוחות וביטול.",
    bookingUrl: item.bookingUrl || item.url || "",
    commission,
    cancellationPolicy,
    emergencyRefundEligible: Boolean(item.emergencyRefundEligible || item.warCancellationEligible),
    commissionRefundable: item.commissionRefundable === true,
    disruptionSupport: item.disruptionSupport || null,
    replacementOptionsAvailable: Boolean(item.replacementOptionsAvailable),
    score: Number(item.score || item.aiScore || 0),
    details: item.details || item.scoreBreakdown || {}
  };
}

function formatCommission(commission) {
  if (!commission) return "עמלה: לפי הסכם ספק";
  if (typeof commission === "string") return `עמלה: ${commission}`;

  const type = commission.type || "fixed";
  const value = Number(commission.value || commission.amount || 0);
  const currency = commission.currency || "ILS";

  if (type === "percent") return `עמלה: ${value}% מהזמנה`;
  if (value > 0) return `עמלה: ${money(value, currency)}`;
  return "עמלה: לפי הסכם ספק";
}

function formatCancellation(deal) {
  if (deal.emergencyRefundEligible) {
    return "ביטול חירום: זכאי לבדיקה להחזר מלא לפי ספק/ביטוח";
  }

  if (deal.cancellationPolicy?.summary) {
    return `ביטול: ${deal.cancellationPolicy.summary}`;
  }

  if (typeof deal.cancellationPolicy === "string") {
    return `ביטול: ${deal.cancellationPolicy}`;
  }

  return "ביטול: יוצג לפי תנאי הספק לפני הזמנה";
}

function formatCommissionRefund(deal) {
  return deal.commissionRefundable
    ? "עמלת שירות: ניתנת לזיכוי לפי תנאי החבילה"
    : "עמלת שירות: אינה מזוכה בביטול";
}

function formatDisruptionSupport(deal) {
  if (deal.replacementOptionsAvailable) {
    return "תקלות: קיימת בדיקת חלופות אוטומטית";
  }

  if (deal.disruptionSupport?.summary) {
    return `תקלות: ${deal.disruptionSupport.summary}`;
  }

  return "תקלות: טיפול לפי תנאי ספק וזמינות חלופות";
}

function renderDeals(packages) {
  if (!packages.length) {
    emptyState(
      "לא נמצאו חבילות אמיתיות",
      "אין עדיין תוצאות מספק נסיעות מחובר. צריך לחבר API או שותף Affiliate כדי להציג מחירים אמיתיים.",
      "השלב הבא: לחבר ספק כמו Travelpayouts, Expedia Rapid, Hotelbeds או הסכם ישיר."
    );
    return;
  }

  dealGrid.innerHTML = packages
    .map(
      (deal) => `
        <article class="deal-card">
          <div class="deal-image ${deal.image ? "" : "no-image"}" ${deal.image ? `style="background-image:url('${deal.image}')"` : ""}></div>
          <div class="deal-body">
            <div class="deal-meta">
              <span class="pill">${deal.tag}</span>
              <span>${deal.meta || "פרטים מהספק"}</span>
            </div>
            <h3>${deal.title}</h3>
            <p>${deal.reason}</p>
            <span class="commission-note">${formatCommission(deal.commission)}</span>
            <span class="commission-note">${formatCancellation(deal)}</span>
            <span class="commission-note">${formatCommissionRefund(deal)}</span>
            <span class="commission-note">${formatDisruptionSupport(deal)}</span>
            <div class="deal-footer">
              <span class="price">${deal.price ? money(deal.price, deal.currency) : "מחיר מהספק"}</span>
              <button class="check-button" type="button" data-package='${encodeURIComponent(JSON.stringify(deal))}'>בדוק כדאיות</button>
            </div>
            ${deal.bookingUrl ? `<a class="booking-link" href="${deal.bookingUrl}" target="_blank" rel="noopener">המשך להזמנה</a>` : ""}
          </div>
        </article>
      `
    )
    .join("");
}

function renderScore(deal) {
  scoreValue.textContent = deal.score || "--";
  const entries = Object.entries(deal.details || {});

  if (!entries.length) {
    scoreDetails.innerHTML = `
      <p class="score-empty">הספק החזיר חבילה, אבל עדיין לא חזר פירוט ציון. נחבר כאן את מנוע הדירוג של ה-AI.</p>
    `;
    return;
  }

  scoreDetails.innerHTML = entries
    .map(
      ([label, value]) => `
        <div class="score-row">
          <span>${label}</span>
          <div class="bar" aria-hidden="true"><i style="width:${Number(value)}%"></i></div>
          <strong>${Number(value)}</strong>
        </div>
      `
    )
    .join("");
}

async function searchPackages() {
  renderLoading();
  agentStatus.textContent = "מחפש חבילות אמיתיות";

  try {
    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(getSearchPayload())
    });

    if (!response.ok) {
      throw new Error(`Provider API returned ${response.status}`);
    }

    const data = await response.json();
    const packages = (data.packages || data.results || []).map(normalizePackage);
    renderDeals(packages);

    if (packages[0]) {
      renderScore(packages[0]);
      agentStatus.textContent = `נמצאו ${packages.length} חבילות אמיתיות`;
    } else {
      scoreValue.textContent = "--";
      scoreDetails.innerHTML = "";
      agentStatus.textContent = "אין חבילות מהספק";
    }

    document.querySelector("#deals").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    emptyState(
      "אין עדיין חיבור לספק חי",
      "האתר מוכן לקבל חבילות אמיתיות דרך /api/packages/search, אבל כרגע אין Backend או ספק נסיעות מחובר. בכוונה אין כאן דאטה מדומה.",
      "צריך לבחור ספק חבילות ולחבר API/עמלות."
    );
    scoreValue.textContent = "--";
    scoreDetails.innerHTML = "";
    agentStatus.textContent = "נדרש חיבור API אמיתי";
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
  agentStatus.textContent = `בדקתי כדאיות: ${deal.title}`;
  document.querySelector("#compare").scrollIntoView({ behavior: "smooth", block: "center" });
});

document.querySelector("#openAgent").addEventListener("click", () => {
  modal.showModal();
});

document.querySelector("#agentBuild").addEventListener("click", () => {
  agentReply.textContent =
    "כדי לבנות חבילה אמיתית צריך לחבר ספק נסיעות חי. אחרי החיבור, הסוכן יקבל טיסות, מלונות, ארוחות, ביטולים ועמלות, ואז יחזיר המלצה בלי דאטה מדומה.";
});

emptyState(
  "מוכן לחיבור ספקים",
  "בחר יעד או בקש רעיון. לאחר חיבור API אמיתי, החבילות יופיעו כאן בזמן אמת.",
  "אין באתר מחירי דמו."
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      agentStatus.textContent = "האתר עובד, התקנת אפליקציה תופעל בשרת";
    });
  });
}
