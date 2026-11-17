// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fc from "fast-check";
import { copyToClipboard } from "@/lib/clipboard";

let writeText: ReturnType<typeof vi.fn>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  Reflect.deleteProperty(navigator, "clipboard");
  Reflect.deleteProperty(document, "execCommand");
  consoleErrorSpy.mockRestore();
});

describe("copyToClipboard", () => {
  it("copies text via navigator.clipboard.writeText when available", async () => {
    const result = await copyToClipboard("https://example.com/share");
    expect(result).toBe(true);
    expect(writeText).toHaveBeenCalledWith("https://example.com/share");
  });

  it("throws an error when text is empty", async () => {
    await expect(copyToClipboard("")).rejects.toThrow("Nothing to copy");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("throws an error when text is whitespace only", async () => {
    await expect(copyToClipboard("   \n\t  ")).rejects.toThrow("Nothing to copy");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("throws an error when text is not a string", async () => {
    // @ts-expect-error Testing invalid runtime inputs
    await expect(copyToClipboard(null)).rejects.toThrow("Nothing to copy");
    // @ts-expect-error Testing invalid runtime inputs
    await expect(copyToClipboard(undefined)).rejects.toThrow("Nothing to copy");
  });

  it("falls back to execCommand when navigator.clipboard is unavailable", async () => {
    Reflect.deleteProperty(navigator, "clipboard");
    document.execCommand = vi.fn(() => true);

    const result = await copyToClipboard("https://example.com/fallback");
    expect(result).toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith("copy");
    // Verify textarea was cleaned up
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("falls back to execCommand when navigator.clipboard.writeText rejects", async () => {
    writeText.mockRejectedValue(new Error("Permission denied"));
    document.execCommand = vi.fn(() => true);

    const result = await copyToClipboard("https://example.com/retry");
    expect(result).toBe(true);
    expect(writeText).toHaveBeenCalledWith("https://example.com/retry");
    expect(document.execCommand).toHaveBeenCalledWith("copy");
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("properly configures the temporary textarea with fixed position, opacity 0, and readonly", async () => {
    Reflect.deleteProperty(navigator, "clipboard");
    let capturedTextarea: HTMLTextAreaElement | null = null;

    document.execCommand = vi.fn(() => {
      capturedTextarea = document.querySelector("textarea");
      expect(capturedTextarea).not.toBeNull();
      expect(capturedTextarea?.value).toBe("https://example.com/check-styles");
      expect(capturedTextarea?.style.position).toBe("fixed");
      expect(capturedTextarea?.style.opacity).toBe("0");
      expect(capturedTextarea?.hasAttribute("readonly")).toBe(true);
      return true;
    });

    const result = await copyToClipboard("https://example.com/check-styles");
    expect(result).toBe(true);
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("removes the temporary textarea even when document.execCommand throws", async () => {
    Reflect.deleteProperty(navigator, "clipboard");
    document.execCommand = vi.fn(() => {
      throw new Error("execCommand error");
    });

    await expect(copyToClipboard("https://example.com/error")).rejects.toThrow("execCommand error");
    expect(document.querySelector("textarea")).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("throws Clipboard copy failed when execCommand returns false", async () => {
    Reflect.deleteProperty(navigator, "clipboard");
    document.execCommand = vi.fn(() => false);

    await expect(copyToClipboard("https://example.com/failed")).rejects.toThrow(
      "Clipboard copy failed"
    );
    expect(document.querySelector("textarea")).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("property: copies any non-whitespace string", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        async (val) => {
          writeText.mockClear();
          const result = await copyToClipboard(val);
          expect(result).toBe(true);
          expect(writeText).toHaveBeenCalledWith(val);
        }
      ),
      { numRuns: 30 }
    );
  });
});
