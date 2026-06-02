/*  xlsx-mini-write.js — tiny pure-JS .xlsx writer (browser).
    Uses native `CompressionStream('deflate-raw')` for ZIP deflate.

    Usage:
      const blob = await XlsxMini.writeFile({
        sheets: [
          { name: 'Sheet1', rows: [ ['A', 'B'], ['x', 'y'] ] },
          { name: 'Sheet2', rows: [ [...] ] },
        ]
      });
      // Triggers a download in the browser:
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'out.xlsx';
      a.click();

    Each row is an array of cells. Cell values can be:
      - string                → inline string
      - number                → numeric
      - Date or 'YYYY-MM-DD'  → date (stored as Excel serial with date style)
      - null/undefined        → empty cell                                          */

(function () {
  'use strict';

  // ── CRC32 for ZIP entries ──
  const CRC_TABLE = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    CRC_TABLE[n] = c;
  }
  function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  // ── Deflate one buffer via CompressionStream('deflate-raw') ──
  async function deflateRaw(uint8) {
    if (typeof CompressionStream === 'undefined') {
      // Fallback: stored (no compression) — still produces a valid xlsx
      return { data: uint8, method: 0 };
    }
    const cs = new CompressionStream('deflate-raw');
    const stream = new Response(uint8).body.pipeThrough(cs);
    const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
    return { data: compressed, method: 8 };
  }

  // ── ZIP writer ──
  async function buildZip(entries) {
    // entries: [{ name, content: Uint8Array }]
    const files = [];
    let totalSize = 0;
    for (const e of entries) {
      const { data: comp, method } = await deflateRaw(e.content);
      const crc = crc32(e.content);
      files.push({
        name: e.name, method, crc,
        compSize: comp.length, uncompSize: e.content.length,
        comp, uncomp: e.content,
        offset: 0,   // filled in below
      });
    }

    // Build local file headers + data
    const enc = new TextEncoder();
    const parts = [];
    let offset = 0;
    for (const f of files) {
      f.offset = offset;
      const nameBytes = enc.encode(f.name);
      const lh = new Uint8Array(30 + nameBytes.length);
      const dv = new DataView(lh.buffer);
      dv.setUint32(0, 0x04034b50, true);   // local file header signature
      dv.setUint16(4, 20, true);           // version needed
      dv.setUint16(6, 0, true);            // flags
      dv.setUint16(8, f.method, true);     // method
      dv.setUint16(10, 0, true);           // mod time
      dv.setUint16(12, 0, true);           // mod date
      dv.setUint32(14, f.crc, true);       // crc-32
      dv.setUint32(18, f.compSize, true);  // comp size
      dv.setUint32(22, f.uncompSize, true);// uncomp size
      dv.setUint16(26, nameBytes.length, true);
      dv.setUint16(28, 0, true);           // extra length
      lh.set(nameBytes, 30);
      parts.push(lh);
      parts.push(f.comp);
      offset += lh.length + f.comp.length;
    }

    // Central directory
    const cdParts = [];
    let cdSize = 0;
    for (const f of files) {
      const nameBytes = enc.encode(f.name);
      const cd = new Uint8Array(46 + nameBytes.length);
      const dv = new DataView(cd.buffer);
      dv.setUint32(0, 0x02014b50, true);
      dv.setUint16(4, 20, true);            // version made
      dv.setUint16(6, 20, true);            // version needed
      dv.setUint16(8, 0, true);
      dv.setUint16(10, f.method, true);
      dv.setUint16(12, 0, true);
      dv.setUint16(14, 0, true);
      dv.setUint32(16, f.crc, true);
      dv.setUint32(20, f.compSize, true);
      dv.setUint32(24, f.uncompSize, true);
      dv.setUint16(28, nameBytes.length, true);
      dv.setUint16(30, 0, true);
      dv.setUint16(32, 0, true);
      dv.setUint16(34, 0, true);
      dv.setUint16(36, 0, true);
      dv.setUint32(38, 0, true);
      dv.setUint32(42, f.offset, true);
      cd.set(nameBytes, 46);
      cdParts.push(cd);
      cdSize += cd.length;
    }
    const cdOffset = offset;
    parts.push(...cdParts);

    // End of central directory
    const eocd = new Uint8Array(22);
    const edv = new DataView(eocd.buffer);
    edv.setUint32(0, 0x06054b50, true);
    edv.setUint16(4, 0, true);
    edv.setUint16(6, 0, true);
    edv.setUint16(8, files.length, true);
    edv.setUint16(10, files.length, true);
    edv.setUint32(12, cdSize, true);
    edv.setUint32(16, cdOffset, true);
    edv.setUint16(20, 0, true);
    parts.push(eocd);

    // Concatenate
    const total = parts.reduce((s, p) => s + p.length, 0);
    const out = new Uint8Array(total);
    let p = 0;
    for (const part of parts) { out.set(part, p); p += part.length; }
    return out;
  }

  // ── XML escaping ──
  function xmlEscape(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  // ── Column letters: 0=A, 25=Z, 26=AA ──
  function colLetter(idx) {
    let s = '';
    idx = idx + 1;
    while (idx > 0) {
      const r = (idx - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      idx = Math.floor((idx - 1) / 26);
    }
    return s;
  }

  // ── JS Date → Excel serial ──
  function dateToSerial(d) {
    // Excel's 1900 system: 1 = 1900-01-01 (with the 1900-02-29 bug)
    const epoch = Date.UTC(1899, 11, 30);  // Excel epoch (accounts for the bug)
    return (d.getTime() - epoch) / 86400000;
  }

  function isDateLike(v) {
    if (v instanceof Date) return true;
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return true;
    return false;
  }

  // ── Build one sheet XML ──
  function buildSheetXml(rows) {
    let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n';
    xml += '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';
    xml += '<sheetData>';
    // Style class → cellXfs index (see buildStylesXml)
    const STYLE_IDX = { default: 0, date: 1, green: 2, red: 3, yellow: 4 };
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r] || [];
      xml += `<row r="${r + 1}">`;
      for (let c = 0; c < row.length; c++) {
        let cell = row[c];
        // Allow either a bare value or { v: value, s: 'green'|'red'|'yellow' }
        let v, styleAttr = '';
        if (cell && typeof cell === 'object' && !(cell instanceof Date) && 's' in cell) {
          v = cell.v;
          const idx = STYLE_IDX[cell.s];
          if (idx != null) styleAttr = ` s="${idx}"`;
        } else {
          v = cell;
        }
        const ref = colLetter(c) + (r + 1);
        if (v === null || v === undefined || v === '') {
          // If we have a fill style but no value, still emit a styled empty cell
          if (styleAttr) xml += `<c r="${ref}"${styleAttr}/>`;
          continue;
        }
        if (typeof v === 'number') {
          xml += `<c r="${ref}"${styleAttr}><v>${v}</v></c>`;
        } else if (isDateLike(v)) {
          const d = v instanceof Date ? v : new Date(v + 'T00:00:00Z');
          // If user already provided a style, honor it; otherwise use date style
          const useStyle = styleAttr || ' s="1"';
          xml += `<c r="${ref}"${useStyle}><v>${dateToSerial(d)}</v></c>`;
        } else if (typeof v === 'boolean') {
          xml += `<c r="${ref}" t="b"${styleAttr}><v>${v ? 1 : 0}</v></c>`;
        } else {
          xml += `<c r="${ref}" t="inlineStr"${styleAttr}><is><t xml:space="preserve">${xmlEscape(v)}</t></is></c>`;
        }
      }
      xml += '</row>';
    }
    xml += '</sheetData></worksheet>';
    return xml;
  }

  // ── Styles XML: defines style indexes
  //    0 = default (no fill)
  //    1 = date format
  //    2 = green fill (attendance: present / Y)
  //    3 = red fill   (attendance: absent  / N)
  //    4 = yellow fill (template header highlight)
  function buildStylesXml() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/></numFmts>' +
      '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>' +
      // fillId 0 = none, 1 = gray125 (Excel default), 2 = green, 3 = red, 4 = yellow
      '<fills count="5">' +
        '<fill><patternFill patternType="none"/></fill>' +
        '<fill><patternFill patternType="gray125"/></fill>' +
        '<fill><patternFill patternType="solid"><fgColor rgb="FF34A853"/><bgColor indexed="64"/></patternFill></fill>' +
        '<fill><patternFill patternType="solid"><fgColor rgb="FFEA4335"/><bgColor indexed="64"/></patternFill></fill>' +
        '<fill><patternFill patternType="solid"><fgColor rgb="FFFFFF00"/><bgColor indexed="64"/></patternFill></fill>' +
      '</fills>' +
      '<borders count="1"><border/></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="5">' +
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
        '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
        '<xf numFmtId="0" fontId="0" fillId="2" borderId="0" xfId="0" applyFill="1"/>' +
        '<xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1"/>' +
        '<xf numFmtId="0" fontId="0" fillId="4" borderId="0" xfId="0" applyFill="1"/>' +
      '</cellXfs>' +
      '</styleSheet>';
  }

  function buildWorkbookXml(sheetNames) {
    let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n';
    xml += '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
           'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">';
    xml += '<sheets>';
    sheetNames.forEach((name, i) => {
      xml += `<sheet name="${xmlEscape(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`;
    });
    xml += '</sheets></workbook>';
    return xml;
  }

  function buildWorkbookRels(sheetCount) {
    let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n';
    xml += '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
    for (let i = 1; i <= sheetCount; i++) {
      xml += `<Relationship Id="rId${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i}.xml"/>`;
    }
    xml += `<Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`;
    xml += '</Relationships>';
    return xml;
  }

  function buildContentTypes(sheetCount) {
    let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n';
    xml += '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">';
    xml += '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>';
    xml += '<Default Extension="xml" ContentType="application/xml"/>';
    xml += '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>';
    for (let i = 1; i <= sheetCount; i++) {
      xml += `<Override PartName="/xl/worksheets/sheet${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`;
    }
    xml += '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>';
    xml += '</Types>';
    return xml;
  }

  function buildRootRels() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>';
  }

  async function writeFile({ sheets }) {
    if (!sheets || !sheets.length) throw new Error('No sheets provided');
    const enc = new TextEncoder();
    const entries = [
      { name: '[Content_Types].xml', content: enc.encode(buildContentTypes(sheets.length)) },
      { name: '_rels/.rels', content: enc.encode(buildRootRels()) },
      { name: 'xl/workbook.xml', content: enc.encode(buildWorkbookXml(sheets.map(s => s.name))) },
      { name: 'xl/_rels/workbook.xml.rels', content: enc.encode(buildWorkbookRels(sheets.length)) },
      { name: 'xl/styles.xml', content: enc.encode(buildStylesXml()) },
    ];
    sheets.forEach((s, i) => {
      entries.push({ name: `xl/worksheets/sheet${i + 1}.xml`, content: enc.encode(buildSheetXml(s.rows || [])) });
    });
    const zipBytes = await buildZip(entries);
    return new Blob([zipBytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  // Trigger a browser download
  async function downloadFile(filename, opts) {
    const blob = await writeFile(opts);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  // Build a separate ZIP of multiple xlsx blobs
  async function downloadZip(filename, files) {
    // files: [{ name, blob }]
    const entries = [];
    for (const f of files) {
      const buf = new Uint8Array(await f.blob.arrayBuffer());
      entries.push({ name: f.name, content: buf });
    }
    const zipBytes = await buildZip(entries);
    const blob = new Blob([zipBytes], { type: 'application/zip' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  // Attach to existing XlsxMini object
  window.XlsxMini = window.XlsxMini || {};
  window.XlsxMini.writeFile = writeFile;
  window.XlsxMini.downloadFile = downloadFile;
  window.XlsxMini.downloadZip = downloadZip;
})();
