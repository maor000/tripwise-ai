"use strict";

require.extensions[".ts"] = require.extensions[".js"];

function readRequestBody(request) {
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

async function getPayload(request) {
  if (request.body && typeof request.body === "object") return request.body;
  return readRequestBody(request);
}

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(payload));
}

function assertMethod(request, response, methods) {
  if (methods.includes(request.method)) return true;
  sendJson(response, 405, { error: "Method not allowed" });
  return false;
}

module.exports = {
  getPayload,
  sendJson,
  assertMethod
};

