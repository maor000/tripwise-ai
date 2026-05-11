"use strict";

const { assertMethod, getPayload, sendJson } = require("../_lib/serverRuntime.js");
const { searchHotels } = require("../../src/lib/providers/providerRegistry.ts");

module.exports = async function handler(request, response) {
  if (!assertMethod(request, response, ["POST"])) return;

  try {
    const payload = await getPayload(request);
    const result = await searchHotels(payload);
    sendJson(response, 200, result);
  } catch (error) {
    sendJson(response, 500, {
      state: "provider_error",
      error: error.message,
      hotels: [],
      providers: []
    });
  }
};

