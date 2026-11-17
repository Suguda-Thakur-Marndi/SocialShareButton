/**
 * Reliable clipboard utility providing asynchronous clipboard access with fallback support.
 */

/**
 * Copies the given text to the clipboard.
 * Uses navigator.clipboard.writeText when available, with a best-effort
 * temporary textarea fallback for unsupported or insecure contexts.
 *
 * @param text The text string to copy.
 * @returns Promise<boolean> Resolves to true on success, throws an Error on failure.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text || typeof text !== "string" || !text.trim()) {
    throw new Error("Nothing to copy");
  }

  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // Fall back to execCommand if Clipboard API rejects (e.g. permission denied or insecure context)
      }
    }

    if (typeof document === "undefined") {
      throw new Error("Document is not available");
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.setAttribute("readonly", "");

    document.body.appendChild(textarea);
    try {
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);

      const success = document.execCommand("copy");
      if (!success) {
        throw new Error("Clipboard copy failed");
      }

      return true;
    } finally {
      if (textarea.parentNode) {
        textarea.remove();
      }
    }
  } catch (error) {
    console.error("Clipboard operation failed:", error);
    throw error;
  }
}
