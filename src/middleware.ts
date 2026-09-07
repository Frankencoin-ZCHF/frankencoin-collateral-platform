import { defineMiddleware } from "astro:middleware";
import { config } from "@/config";

/**
 * Security headers (mirrors frankencoin-site, tightened):
 *  - script-src has NO 'unsafe-inline' in production: Alpine, AG Grid and ECharts are bundled
 *    and every page script is an external module. 'unsafe-eval' remains for Alpine's
 *    expression evaluator. Dev mode adds 'unsafe-inline' for Vite/Astro tooling only.
 *  - frame-src lists exactly the hosts the `embed` content block allows.
 */
const scriptSrc = config.isProduction ? "script-src 'self' 'unsafe-eval'" : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

const CSP = [
  "default-src 'self'",
  scriptSrc,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' https: data:",
  "font-src 'self'",
  "connect-src 'self' https://api.frankencoin.com",
  "frame-src https://dune.com https://defillama.com https://www.youtube.com https://youtube.com",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("Content-Security-Policy", CSP);
  return response;
});
