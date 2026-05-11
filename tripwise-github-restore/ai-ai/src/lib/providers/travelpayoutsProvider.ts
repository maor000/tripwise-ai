// @ts-nocheck
"use strict";

const { createProviderStatus } = require("./types.ts");

const PROVIDER_NAME = "Travelpayouts";
const API_BASE = "https://api.travelpayouts.com/aviasales/v3/prices_for_dates";

const destinationCodes = {
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
  crete: "HER",
  rhodes: "RHO",
  rome: "ROM",
  dubai: "DXB",
  athens: "ATH",
  paris: "PAR",
  london: "LON",
  barcelona: "BCN",
  berlin: "BER",
  budapest: "BUD",
  prague: "PRG",
  amsterdam: "AMS",
  vienna: "VIE",
  larnaca: "LCA",
  istanbul: "IST",
  batumi: "BUS",
  tbilisi: "TBS"
};

function isConfigured() {
  return Boolean(process.env.TRAVELPAYOUTS_TOKEN);
}

function getStatus() {
  return createProviderStatus({
    name: PROVIDER_NAME,
    configured: isConfigured(),
    status: isConfigured() ? "available" : "unavailable"
  });
}

function resolveDestinationCode(destination) {
  if (!destination) return "";
  const value = String(destination).trim();
  if (/^[A-Za-z]{3}$/.test(value)) return value.toUpperCase();
  return destinationCodes[value] || destinationCodes[value.toLowerCase()] || "";
}

function getDefaultDepartureMonth() {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  return date.toISOString().slice(0, 7);
}

function buildAffiliateUrl({ origin, destination, departDate, returnDate }) {
  const marker = process.env.TRAVELPAYOUTS_MARKER;
  const baseUrl = process.env.TRAVELPAYOUTS_AFFILIATE_BASE_URL || "https://www.aviasales.com/search";
  const datePart = departDate ? departDate.replaceAll("-", "").slice(2) : "";
  const returnPart = returnDate ? returnDate.replaceAll("-", "").slice(2) : "";
  const route = `${origin}${datePart}${destination}${returnPart}`;
  const url = new URL(`${baseUrl}/${route}`);
  if (marker) url.searchParams.set("marker", marker);
  return url.toString();
}

function buildFlightOffer(offer, request, index) {
  const origin = request.origin || process.env.TRAVELPAYOUTS_DEFAULT_ORIGIN || "TLV";
  const destination = resolveDestinationCode(request.destination);
  const price = Number(offer.value || offer.price || 0);
  const departDate = offer.depart_date || request.departureAt || getDefaultDepartureMonth();
  const returnDate = offer.return_date || request.returnAt || "";
  const changes = Number(offer.number_of_changes || 0);

  return {
    id: `travelpayouts-flight-${origin}-${destination}-${departDate}-${index}`,
    providerOfferId: offer.link || offer.id || null,
    supplierName: PROVIDER_NAME,
    supplierUrl: buildAffiliateUrl({ origin, destination, departDate, returnDate }),
    origin,
    destination,
    dates: {
      departure: departDate,
      return: returnDate || null,
      nights: null
    },
    airline: offer.airline || offer.gate || null,
    flightNumber: offer.flight_number || null,
    numberOfChanges: changes,
    baggage: {
      included: null,
      note: "Travelpayouts did not return checked baggage data for this fare."
    },
    price,
    currency: "ILS",
    refundable: null,
    cancellationPolicy: {
      summary: "Flight change and cancellation terms are determined by the airline or ticket supplier before booking.",
      source: "provider-policy",
      feeRefundable: false
    },
    availabilityStatus: price > 0 ? "available" : "pending_verification",
    verificationStatus: "verified",
    confidenceScore: price > 0 ? 82 : 55,
    source: "provider",
    verified: true,
    rawProvider: "travelpayouts",
    lastCheckedAt: new Date().toISOString()
  };
}

function flightToPackage(flight) {
  const missingFields = ["hotel", "meals", "checked_baggage", "refundable_terms"];

  return {
    id: `travelpayouts-package-${flight.id}`,
    destination: flight.destination,
    dates: flight.dates,
    hotel: null,
    flight,
    baggage: flight.baggage,
    meals: {
      breakfastIncluded: null,
      plan: null,
      note: "No hotel or meal provider is connected yet."
    },
    price: flight.price,
    currency: flight.currency,
    refundable: flight.refundable,
    cancellationPolicy: flight.cancellationPolicy,
    supplierName: flight.supplierName,
    supplierUrl: flight.supplierUrl,
    lastCheckedAt: flight.lastCheckedAt,
    availabilityStatus: flight.availabilityStatus,
    verificationStatus: "pending",
    confidenceScore: Math.min(flight.confidenceScore, 72),
    source: "provider",
    verified: true,
    missing_data: true,
    missingFields,
    aiComposed: false,
    warning: "This is a real flight offer, but it is not a complete vacation package until a hotel provider is connected."
  };
}

async function fetchFlights(request = {}) {
  if (!isConfigured()) {
    return {
      provider: PROVIDER_NAME,
      configured: false,
      status: "unavailable",
      flights: [],
      message: "Provider API is not configured yet."
    };
  }

  const origin = request.origin || process.env.TRAVELPAYOUTS_DEFAULT_ORIGIN || "TLV";
  const destination = resolveDestinationCode(request.destination);

  if (!destination) {
    return {
      provider: PROVIDER_NAME,
      configured: true,
      status: "no_results",
      flights: [],
      message: "Destination is missing or unsupported. Use a known city or a 3-letter airport code."
    };
  }

  const url = new URL(API_BASE);
  url.searchParams.set("origin", origin);
  url.searchParams.set("destination", destination);
  url.searchParams.set("departure_at", request.departureAt || getDefaultDepartureMonth());
  url.searchParams.set("currency", "ils");
  url.searchParams.set("sorting", "price");
  url.searchParams.set("direct", request.directOnly ? "true" : "false");
  url.searchParams.set("one_way", request.returnAt ? "false" : "true");
  url.searchParams.set("limit", String(request.limit || 10));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.PROVIDER_TIMEOUT_MS || 9000));

  try {
    const response = await fetch(url, {
      headers: {
        "X-Access-Token": process.env.TRAVELPAYOUTS_TOKEN
      },
      signal: controller.signal
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        provider: PROVIDER_NAME,
        configured: true,
        status: "provider_error",
        flights: [],
        error: `Travelpayouts returned ${response.status}`,
        providerMessage: body.slice(0, 400)
      };
    }

    const data = await response.json();
    const offers = Array.isArray(data.data) ? data.data : [];
    const flights = offers.map((offer, index) => buildFlightOffer(offer, { ...request, origin }, index));

    return {
      provider: PROVIDER_NAME,
      configured: true,
      status: flights.length ? "available" : "no_results",
      flights,
      lastCheckedAt: new Date().toISOString()
    };
  } catch (error) {
    return {
      provider: PROVIDER_NAME,
      configured: true,
      status: error.name === "AbortError" ? "provider_timeout" : "provider_error",
      flights: [],
      error: error.message
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchHotels() {
  return {
    provider: PROVIDER_NAME,
    configured: isConfigured(),
    status: "no_results",
    hotels: [],
    message: "Travelpayouts flight API is connected. Hotel provider is not connected yet."
  };
}

async function fetchPackages(request = {}) {
  const flightResult = await fetchFlights(request);
  return {
    provider: PROVIDER_NAME,
    configured: flightResult.configured,
    status: flightResult.status,
    packages: (flightResult.flights || []).map(flightToPackage),
    flights: flightResult.flights || [],
    message: flightResult.message,
    error: flightResult.error,
    providerMessage: flightResult.providerMessage,
    lastCheckedAt: flightResult.lastCheckedAt || new Date().toISOString()
  };
}

module.exports = {
  name: PROVIDER_NAME,
  source: "provider",
  isConfigured,
  getStatus,
  fetchFlights,
  fetchHotels,
  fetchPackages
};
