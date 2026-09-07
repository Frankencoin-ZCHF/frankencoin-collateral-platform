/** HTML/JSON output-encoding helpers. Use these at every boundary where data meets markup. */

export function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * JSON that is safe to embed inside a <script type="application/json"> element:
 * <, >, & and the U+2028/U+2029 line terminators are escaped so no payload can close
 * the script element or break a JS parser. The output is still valid JSON.
 */
export function jsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
