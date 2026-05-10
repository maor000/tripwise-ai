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
