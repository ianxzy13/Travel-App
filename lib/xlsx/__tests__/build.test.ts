import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { buildXlsx, sheetName } from "../build";

/** Reads the stored (uncompressed) files back out of the zip. */
function unzip(buf: Uint8Array) {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const out: Record<string, string> = {};
  let at = 0;
  while (v.getUint32(at, true) === 0x04034b50) {
    const size = v.getUint32(at + 18, true);
    const nameLen = v.getUint16(at + 26, true);
    const name = new TextDecoder().decode(buf.subarray(at + 30, at + 30 + nameLen));
    const data = buf.subarray(at + 30 + nameLen, at + 30 + nameLen + size);
    out[name] = new TextDecoder().decode(
      v.getUint16(at + 8, true) === 8 ? inflateRawSync(data) : data,
    );
    at += 30 + nameLen + size;
  }
  return out;
}

describe("buildXlsx", () => {
  it("writes a workbook with the rows as text cells", () => {
    const files = unzip(
      buildXlsx("Playlist", [
        ["Song name", "Artist"],
        ["Rock & Roll <3", "Čuki"],
        ["=SUM(A1)", ""],
      ]),
    );
    expect(Object.keys(files)).toContain("xl/worksheets/sheet1.xml");
    const sheet = files["xl/worksheets/sheet1.xml"]!;
    expect(sheet).toContain('<c r="A1" t="inlineStr" s="1">');
    expect(sheet).toContain("Rock &amp; Roll &lt;3");
    expect(sheet).toContain("Čuki");
    // Text that looks like a formula stays plain text
    expect(sheet).toContain('<c r="A3" t="inlineStr"><is><t xml:space="preserve">=SUM(A1)</t>');
    expect(files["xl/workbook.xml"]).toContain('name="Playlist"');
  });

  it("writes numbers as number cells so Excel can add them up", () => {
    const sheet = unzip(
      buildXlsx("Budget", [
        ["Item", "Paid"],
        ["Venue", 1234.5],
        ["Cake", ""],
      ]),
    )["xl/worksheets/sheet1.xml"]!;
    expect(sheet).toContain('<c r="B2"><v>1234.5</v></c>');
    expect(sheet).toContain('<c r="B3" t="inlineStr">');
  });

  it("keeps sheet names valid", () => {
    expect(sheetName("A/B: [x]?")).toBe("A B   x");
    expect(sheetName("x".repeat(40))).toHaveLength(31);
    expect(sheetName("")).toBe("Sheet1");
  });
});
