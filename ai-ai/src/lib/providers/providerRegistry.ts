"use strict";

const travelpayoutsProvider = require("./travelpayoutsProvider.ts");
const mockProvider = require("./mockProvider.ts");

function getActiveProviders() {
  const providers = [travelpayoutsProvider];
  if (mockProvider.isEnabled()) providers.push(mockProvider);
  return providers;
}

async function settleProviderCalls(methodName, request) {
  const providers = getActiveProviders();
  const settled = await Promise.allSettled(
    providers.map(async (provider) => {
      if (typeof provider[methodName] !== "function") {
        return {
          provider: provider.name,
          configured: false,
          status: "unavailable",
          packages: [],
          flights: [],
          hotels: []
        };
      }

      return provider[methodName](request);
    })
  );

  return settled.map((result, index) => {
    if (result.status === "fulfilled") return result.value;
    return {
      provider: providers[index]?.name || "UnknownProvider",
      configured: true,
      status: "provider_error",
      error: result.reason?.message || "Provider failed",
      packages: [],
      flights: [],
      hotels: []
    };
  });
}

async function searchPackages(request = {}) {
  const reports = await settleProviderCalls("fetchPackages", request);
  const packages = reports.flatMap((report) => report.packages || []);

  return {
    packages,
    providers: reports.map(({ packages: _packages, flights: _flights, hotels: _hotels, ...report }) => report),
    generatedFromLiveProviders: packages.some((item) => item.source === "provider"),
    state: packages.length ? "available" : reports.some((report) => report.status === "provider_error") ? "provider_error" : "no_results"
  };
}

async function searchFlights(request = {}) {
  const reports = await settleProviderCalls("fetchFlights", request);
  const flights = reports.flatMap((report) => report.flights || []);

  return {
    flights,
    providers: reports.map(({ packages: _packages, flights: _flights, hotels: _hotels, ...report }) => report),
    state: flights.length ? "available" : reports.some((report) => report.status === "provider_error") ? "provider_error" : "no_results"
  };
}

async function searchHotels(request = {}) {
  const reports = await settleProviderCalls("fetchHotels", request);
  const hotels = reports.flatMap((report) => report.hotels || []);

  return {
    hotels,
    providers: reports.map(({ packages: _packages, flights: _flights, hotels: _hotels, ...report }) => report),
    state: hotels.length ? "available" : "no_results"
  };
}

function getProviderStatus() {
  const providers = getActiveProviders();
  const status = providers.map((provider) => provider.getStatus());
  const hasConfiguredProvider = status.some((provider) => provider.configured && provider.source === "provider");

  return {
    providers: status,
    providerApiConfigured: hasConfiguredProvider,
    mockProviderEnabled: mockProvider.isEnabled(),
    checkedAt: new Date().toISOString()
  };
}

module.exports = {
  getActiveProviders,
  searchPackages,
  searchFlights,
  searchHotels,
  getProviderStatus
};

