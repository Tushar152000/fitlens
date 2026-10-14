/**
 * The wire contract between the API and its clients (web, mobile).
 * Request schemas validate input on the server; response DTOs type what it sends back. Clients import both.
 */
export * from "./auth.js";
export * from "./billing.js";
export * from "./requests.js";
export * from "./ai.js";
export * from "./coach.js";
export * from "./responses.js";
