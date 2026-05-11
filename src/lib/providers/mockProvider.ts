// @ts-nocheck
"use strict";

const { createProviderStatus } = require("./types.ts");

const PROVIDER_NAME = "DevelopmentMockProvider";

function isEnabled() {
  return (
    process.env.ENABLE_MOCK_PROVIDER === "true" &&
    process.env.NODE_ENV !== "production" &&
    process.env.VERCEL_ENV !== "production"
  );
}

function getStatus() {
  return createProviderStatus({
    name: PROVIDER_NAME,
    configured: isEnabled(),
    source: "mock",
    status: isEnabled() ? "available" : "unavailable"
  });
}

function getMockPackage(request = {}) {
  const now = new Date().toISOString();
  const destination = request.destination || "DEV";

  return {
    id: `mock-package-${destination}`,
    destination,
    dates: {
      departure: request.departureAt || "2099-01-01",
      return: request.returnAt || null,
      nights: null
    },
    hotel: null,
    flight: {
      supplierName: PROVIDER_NAME,
      origin: request.origin || "TLV",
      destination,
      numberOfChanges: 0
    },
    baggage: {
      included: false,
      note: "Mock data only."
    },
    meals: {
      breakfastIncluded: false,
      plan: null,
      note: "Mock data only."
    },
    price: 0,
    currency: "ILS",
    refundable: false,
    cancellationPolicy: {
      summary: "Mock provider. Do not sell or book this offer.",
      source: "mock",
      feeRefundable: false
    },
    supplierName: PROVIDER_NAME,
    supplierUrl: "",
    lastCheckedAt: now,
    availabilityStatus: "pending_verification",
    verificationStatus: "mock",
    confidenceScore: 0,
    source: "mock",
    verified: false,
    missing_data: true,
    missingFields: ["real_provider", "price", "availability", "booking_link"],
    warning: "Development mock only. This package is not real."
  };
}

async function fetchPackages(request) {
  if (!isEnabled()) {
    return {
      provider: PROVIDER_NAME,
      configured: false,
      status: "unavailable",
      packages: []
    };
  }

  return {
    provider: PROVIDER_NAME,
    configured: true,
    status: "available",
    packages: [getMockPackage(request)]
  };
}

async function fetchFlights() {
  return {
    provider: PROVIDER_NAME,
    configured: isEnabled(),
    status: isEnabled() ? "available" : "unavailable",
    flights: []
  };
}

async function fetchHotels() {
  return {
    provider: PROVIDER_NAME,
    configured: isEnabled(),
    status: isEnabled() ? "available" : "unavailable",
    hotels: []
  };
}

module.exports = {
  name: PROVIDER_NAME,
  source: "mock",
  isEnabled,
  getStatus,
  fetchPackages,
  fetchFlights,
  fetchHotels
};
