import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = fileURLToPath(new URL(".", import.meta.url));
const require = createRequire(import.meta.url);
require.extensions[".ts"] = require.extensions[".js"];
await loadEnvFile();

const port = Number(process.env.PORT || 4173);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".md": "text/markdown; charset=utf-8"
};

async function loadEnvFile() {
  const envPath = join(root, ".env");
  if (!existsSync(envPath)) return;

  const contents = await readFile(envPath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        request.destroy();
        reject(new Error("Request body too large"));
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    request.on("error", reject);
  });
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

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
  const commission = item.commission || item.affiliateCommission || item.partnerCommission || null;
  const cancellationPolicy = item.cancellationPolicy || item.refundPolicy || null;

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
    commission,
    cancellationPolicy,
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
    return {
      provider,
      configured: false,
      packages: []
    };
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

async function searchPackages(payload) {
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

  return {
    packages,
    providers: providerReports.map(({ packages: _packages, ...report }) => report),
    generatedFromLiveProviders: packages.length > 0
  };
}

async function serveStatic(request, response, pathname) {
  const cleanPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = normalize(join(root, cleanPath));

  if (!filePath.startsWith(root) || !existsSync(filePath)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  const extension = extname(filePath);
  const content = await readFile(filePath);
  response.writeHead(200, {
    "Content-Type": mimeTypes[extension] || "application/octet-stream",
    "Cache-Control": extension === ".html" ? "no-store" : "public, max-age=3600"
  });
  response.end(content);
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host}`);

    const apiRoutes = {
      "/api/search/packages": "./api/search/packages.js",
      "/api/search/flights": "./api/search/flights.js",
      "/api/search/hotels": "./api/search/hotels.js",
      "/api/providers/status": "./api/providers/status.js",
      "/api/packages/search": "./api/packages/search.js"
    };

    if (apiRoutes[url.pathname]) {
      const handler = require(apiRoutes[url.pathname]);
      await handler(request, response);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/packages/search") {
      const payload = await readJsonBody(request);
      const result = await searchPackages(payload);
      sendJson(response, 200, result);
      return;
    }

    if (request.method === "GET") {
      await serveStatic(request, response, url.pathname);
      return;
    }

    sendJson(response, 405, { error: "Method not allowed" });
  } catch (error) {
    sendJson(response, 500, { error: error.message });
  }
});

server.listen(port, () => {
  console.log(`TripWise AI is running on http://localhost:${port}`);
});
