function scorePackage(item) {
  const details = item.scoreBreakdown || item.details || {};
  const values = Object.values(details).map(Number).filter((value) => Number.isFinite(value));
  if (item.aiScore || item.score) return Number(item.aiScore || item.score);
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function normalizeProviderPackage(item, provider) {
  const priceAmount = Number(item.price?.amount || item.amount || item.price || 0);
  const currency = item.price?.currency || item.currency || "ILS";

  return {
    id: item.id || item.packageId || item.offerId,
    provider,
    title: item.title || item.hotelName || item.destination || "חבילת נופש",
    destination: item.destination || item.city || "",
    price: { amount: priceAmount, currency },
    nights: item.nights,
    hotelName: item.hotelName,
    hotelRating: item.hotelRating,
    mealPlan: item.mealPlan,
    imageUrl: item.imageUrl || item.image,
    bookingUrl: item.bookingUrl || item.url || item.deepLink,
    commission: item.commission || item.affiliateCommission || item.partnerCommission || null,
    cancellationPolicy: item.cancellationPolicy || item.refundPolicy || null,
    emergencyRefundEligible: Boolean(item.emergencyRefundEligible || item.warCancellationEligible),
    commissionRefundable: item.commissionRefundable === true,
    disruptionSupport: item.disruptionSupport || null,
    replacementOptionsAvailable: Boolean(item.replacementOptionsAvailable),
    aiScore: scorePackage(item),
    aiReason: item.aiReason || item.reason || "חבילה מספק מחובר. המערכת לא משלימה נתונים חסרים בעצמה.",
    scoreBreakdown: item.scoreBreakdown || item.details || {},
    checkedAt: new Date().toISOString()
  };
}

const airportByDestination = {
  "לונדון": "LON",
  "פריז": "PAR",
  "רומא": "ROM",
  "מילאנו": "MIL",
  "אתונה": "ATH",
  "כרתים": "HER",
  "הרקליון": "HER",
  "רודוס": "RHO",
  "דובאי": "DXB",
  "ברצלונה": "BCN",
  "ברלין": "BER",
  "בודפשט": "BUD",
  "פראג": "PRG",
  "אמסטרדם": "AMS",
  "וינה": "VIE",
  "לרנקה": "LCA",
  "איסטנבול": "IST",
  "בטומי": "BUS",
  "טביליסי": "TBS",
  "Crete": "HER",
  "Rhodes": "RHO",
  "Rome": "ROM",
  "Dubai": "DXB",
  "Athens": "ATH",
  "Paris": "PAR",
  "London": "LON"
};

function resolveDestinationCode(destination) {
  if (!destination) return "";
  const normalized = String(destination).trim();
  if (/^[A-Za-z]{3}$/.test(normalized)) return normalized.toUpperCase();
  return airportByDestination[normalized] || "";
}

function buildTravelpayoutsLink({ origin, destination, departDate, returnDate }) {
  const marker = process.env.TRAVELPAYOUTS_MARKER;
  const baseUrl = process.env.TRAVELPAYOUTS_AFFILIATE_BASE_URL || "https://www.aviasales.com/search";
  const datePart = departDate ? departDate.replaceAll("-", "").slice(2) : "";
  const route = `${origin}${datePart}${destination}${returnDate ? returnDate.replaceAll("-", "").slice(2) : ""}`;
  const url = new URL(`${baseUrl}/${route}`);
  if (marker) url.searchParams.set("marker", marker);
  return url.toString();
}

async function fetchTravelpayouts(payload) {
  const token = process.env.TRAVELPAYOUTS_TOKEN;
  if (!token) {
    return { provider: "Travelpayouts", configured: false, packages: [] };
  }

  const origin = process.env.TRAVELPAYOUTS_DEFAULT_ORIGIN || "TLV";
  const destination = resolveDestinationCode(payload.destination);

  if (!destination) {
    return {
      provider: "Travelpayouts",
      configured: true,
      packages: []
    };
  }

  const url = new URL("https://api.travelpayouts.com/aviasales/v3/prices_for_dates");
  url.searchParams.set("origin", origin);
  url.searchParams.set("destination", destination);
  url.searchParams.set("currency", "ils");
  url.searchParams.set("sorting", "price");
  url.searchParams.set("direct", "false");
  url.searchParams.set("limit", "10");

  const response = await fetch(url, {
    headers: {
      "X-Access-Token": token
    }
  });

  if (!response.ok) {
    throw new Error(`Travelpayouts returned ${response.status}`);
  }

  const data = await response.json();
  const offers = Array.isArray(data.data) ? data.data : [];

  return {
    provider: "Travelpayouts",
    configured: true,
    packages: offers.map((offer, index) => {
      const price = Number(offer.value || offer.price || 0);
      const departDate = offer.depart_date || "";
      const returnDate = offer.return_date || "";

      return normalizeProviderPackage(
        {
          id: `travelpayouts-${origin}-${destination}-${departDate}-${index}`,
          title: `טיסה ${origin} אל ${destination}`,
          destination,
          price: { amount: price, currency: "ILS" },
          bookingUrl: buildTravelpayoutsLink({ origin, destination, departDate, returnDate }),
          aiReason: "הצעת טיסה חיה מ-Travelpayouts. מלון/חבילה מלאה יחוברו מספק מלונות או חבילות נוסף.",
          commission: {
            type: "partner",
            source: "Travelpayouts affiliate",
            refundable: false
          },
          cancellationPolicy: {
            summary: "תנאי שינוי וביטול נקבעים על ידי חברת התעופה/הספק לפני ההזמנה.",
            source: "provider-policy"
          },
          scoreBreakdown: {
            "מחיר": price > 0 ? 82 : 0,
            "שעות טיסה": offer.number_of_changes === 0 ? 92 : 74,
            "אמינות ספק": 84,
            "ביטול": 55,
            "נוחות": offer.number_of_changes === 0 ? 88 : 70
          }
        },
        "Travelpayouts"
      );
    })
  };
}

async function fetchOfficialJson({ provider, baseUrl, apiKey, path, payload }) {
  if (!baseUrl || !apiKey) {
    return { provider, configured: false, packages: [] };
  }

  const url = new URL(path, baseUrl);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`${provider} returned ${response.status}`);
  }

  const data = await response.json();
  const packages = data.packages || data.results || data.offers || [];
  return {
    provider,
    configured: true,
    packages: packages.map((item) => normalizeProviderPackage(item, provider))
  };
}

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const payload = request.body || {};
  const providers = [
    fetchTravelpayouts(payload),
    fetchOfficialJson({
      provider: "HolidayFinder",
      baseUrl: process.env.HOLIDAYFINDER_API_BASE_URL,
      apiKey: process.env.HOLIDAYFINDER_API_KEY,
      path: process.env.HOLIDAYFINDER_SEARCH_PATH || "/api/packages/search",
      payload
    }),
    fetchOfficialJson({
      provider: "KAYAK",
      baseUrl: process.env.KAYAK_API_BASE_URL,
      apiKey: process.env.KAYAK_API_KEY,
      path: process.env.KAYAK_SEARCH_PATH || "/api/packages/search",
      payload
    }),
    fetchOfficialJson({
      provider: "Viator",
      baseUrl: process.env.VIATOR_API_BASE_URL,
      apiKey: process.env.VIATOR_API_KEY,
      path: process.env.VIATOR_SEARCH_PATH || "/api/products/search",
      payload
    })
  ];

  const settled = await Promise.allSettled(providers);
  const providerReports = settled.map((result) =>
    result.status === "fulfilled"
      ? result.value
      : { configured: true, error: result.reason.message, packages: [] }
  );

  const packages = providerReports.flatMap((report) => report.packages);
  response.status(200).json({
    packages,
    providers: providerReports.map(({ packages: _packages, ...report }) => report),
    generatedFromLiveProviders: packages.length > 0
  });
};
