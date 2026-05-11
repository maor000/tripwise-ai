// @ts-nocheck
"use strict";

function scorePackage(pkg) {
  let score = 40;

  if (pkg.source === "provider" && pkg.verified) score += 20;
  if (pkg.verificationStatus === "verified") score += 15;
  if (pkg.availabilityStatus === "available") score += 10;
  if (pkg.flight) score += 8;
  if (pkg.hotel) score += 8;
  if (pkg.baggage?.included === true) score += 4;
  if (pkg.meals?.breakfastIncluded === true) score += 4;
  if (pkg.refundable === true) score += 6;
  if (pkg.missing_data) score -= 15;
  if (pkg.source === "mock") score = 0;

  return Math.max(0, Math.min(100, Number(pkg.confidenceScore || score)));
}

function listMissingData(pkg) {
  const missing = new Set(pkg.missingFields || []);
  if (!pkg.hotel) missing.add("hotel");
  if (!pkg.flight) missing.add("flight");
  if (pkg.baggage?.included === null || pkg.baggage?.included === undefined) missing.add("baggage");
  if (pkg.meals?.breakfastIncluded === null || pkg.meals?.breakfastIncluded === undefined) missing.add("meals");
  if (pkg.refundable === null || pkg.refundable === undefined) missing.add("refundable_terms");
  if (!pkg.supplierUrl) missing.add("booking_link");
  return Array.from(missing);
}

function explainPackage(pkg, missingFields) {
  if (pkg.source === "mock") {
    return "Mock data is enabled for development only. This offer must not be shown as a real travel package.";
  }

  if (missingFields.length) {
    return `This suggestion uses real provider data but is missing: ${missingFields.join(", ")}. The AI did not invent those fields.`;
  }

  return "This package is built from real provider data. AI only ranked and summarized the available data.";
}

function buildPackageSuggestions(packages = [], request = {}) {
  const suggestions = packages
    .map((pkg) => {
      const missingFields = listMissingData(pkg);
      const missingData = missingFields.length > 0 || pkg.missing_data === true;
      const confidenceScore = scorePackage(pkg);

      return {
        ...pkg,
        confidenceScore,
        missing_data: missingData,
        missingFields,
        aiComposed: Boolean(pkg.aiComposed),
        aiWarning: pkg.aiComposed
          ? "AI-composed package. Verify every component before booking."
          : "",
        aiSummary: explainPackage(pkg, missingFields),
        userIntent: {
          destination: request.destination || "",
          budget: request.budget || null,
          travelers: request.travelers || "",
          style: request.style || ""
        }
      };
    })
    .sort((a, b) => b.confidenceScore - a.confidenceScore);

  return {
    packages: suggestions,
    missing_data: suggestions.some((pkg) => pkg.missing_data),
    state: suggestions.length ? "available" : "no_results",
    explanation: suggestions.length
      ? "AI ranked real provider results only. Missing values are marked instead of being invented."
      : "No real provider results were returned for this request.",
    generatedAt: new Date().toISOString()
  };
}

module.exports = {
  buildPackageSuggestions
};
