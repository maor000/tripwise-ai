"use strict";

const { assertMethod, sendJson } = require("../_lib/serverRuntime.js");
const { getProviderStatus } = require("../../src/lib/providers/providerRegistry.ts");

module.exports = async function handler(request, response) {
  if (!assertMethod(request, response, ["GET"])) return;

  try {
    sendJson(response, 200, getProviderStatus());
  } catch (error) {
    sendJson(response, 500, {
      providerApiConfigured: false,
      providers: [],
      error: error.message
    });
  }
};

