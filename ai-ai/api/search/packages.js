"use strict";

const { assertMethod, getPayload, sendJson } = require("../_lib/serverRuntime.js");
const { searchPackages } = require("../../src/lib/providers/providerRegistry.ts");
const { buildPackageSuggestions } = require("../../src/lib/ai/packageBuilder.ts");

module.exports = async function handler(request, response) {
  if (!assertMethod(request, response, ["POST"])) return;

  try {
    const payload = await getPayload(request);
    const providerResult = await searchPackages(payload);
    const aiResult = buildPackageSuggestions(providerResult.packages, payload);

    sendJson(response, 200, {
      ...providerResult,
      packages: aiResult.packages,
      ai: {
        missing_data: aiResult.missing_data,
        explanation: aiResult.explanation,
        generatedAt: aiResult.generatedAt
      },
      state: aiResult.packages.length ? providerResult.state : "no_results"
    });
  } catch (error) {
    sendJson(response, 500, {
      state: "provider_error",
      error: error.message,
      packages: [],
      providers: []
    });
  }
};

