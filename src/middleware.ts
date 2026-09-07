import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();

  // Security headers (mirrors frankencoin-site, minus the CDN/analytics hosts —
  // Alpine, AG Grid and ECharts are bundled, so scripts only come from 'self').
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      // 'unsafe-eval' is required by Alpine's expression evaluator; 'unsafe-inline' by Astro's inline scripts.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' https: data:",
      "font-src 'self'",
      "connect-src 'self' https://api.frankencoin.com",
      // Content blocks of type `embed` may iframe these hosts only (see src/blocks/content/types/embed).
      "frame-src https://dune.com https://defillama.com https://www.youtube.com https://youtube.com",
      "media-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  );

  return response;
});
