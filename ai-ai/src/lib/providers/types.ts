"use strict";

const AVAILABILITY_STATES = [
  "available",
  "unavailable",
  "provider_timeout",
  "provider_error",
  "pending_verification",
  "price_changed",
  "no_results"
];

const VERIFICATION_STATES = [
  "verified",
  "pending",
  "mock",
  "provider_error",
  "missing_data"
];

const SOURCES = [
  "provider",
  "ai_composed",
  "mock"
];

function createProviderStatus({ name, configured, source = "provider", status = "available", error = null }) {
  return {
    name,
    configured: Boolean(configured),
    source,
    status,
    error,
    checkedAt: new Date().toISOString()
  };
}

function createMissingData(message, fields = []) {
  return {
    missing_data: true,
    missingFields: fields,
    explanation: message
  };
}

module.exports = {
  AVAILABILITY_STATES,
  VERIFICATION_STATES,
  SOURCES,
  createProviderStatus,
  createMissingData
};

