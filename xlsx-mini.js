/*  xlsx-mini.js — tiny pure-JS reader for .xlsx files (browser).
    Uses the native `DecompressionStream('deflate-raw')` API (Chrome/Edge/Firefox 2023+/Safari 16.4+).
    Exposes: window.XlsxMini.readFile(File) → Promise<{ sheetNames: string[], sheets: { [name]: any[][] } }>
    Each sheet is a 2-D array of cell values (strings/numbers/null).  No formulas, no styling.        */

(function () {
  'use strict';

  // ── ZIP reading: parse central directory and return entries we can inflate
  async function readZip(file) {
    const buf = new Uint8Array(await file.arrayBuffer());
    const dv = new DataView(buf.buffer);
    // Find End of Central Directory (EOCD): scan from end for signature 0x06054b50
    let eocd = -1;
    for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('Not a valid ZIP (no EOCD)');
    const cdEntries = dv.getUint16(eocd + 10, true);
    const cdSize = dv.getUint32(eocd + 12, true);
    const cdOffset = dv.getUint32(eocd + 16, true);

    const entries = {};
    let p = cdOffset;
    for (let i = 0; i < cdEntries; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('Bad CD entry');
      const method = dv.getUint16(p + 10, true);
      const compSize = dv.getUint32(p + 20, true);
      const uncompSize = dv.getUint32(p + 24, true);
      const nameLen = dv.getUint16(p + 28, true);
      const extraLen = dv.getUint16(p + 30, true);
      const commentLen = dv.getUint16(p + 32, true);
      const localHeader = dv.getUint32(p + 42, true);
      const name = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nameLen));
      entries[name] = { method, compSize, uncompSize, localHeader };
      p += 46 + nameLen + extraLen + commentLen;
    }

    async function readEntry(name) {
      const e = entries[name];
      if (!e) return null;
      // Skip local file header: 30 + nameLen + extraLen
      const lh = e.localHeader;
      if (dv.getUint32(lh, true) !== 0x04034b50) throw new Error('Bad local header for ' + name);
      const lhNameLen = dv.getUint16(lh + 26, true);
      const lhExtraLen = dv.getUint16(lh + 28, true);
      const dataStart = lh + 30 + lhNameLen + lhExtraLen;
      const dataEnd = dataStart + e.compSize;
      const compressed = buf.subarray(dataStart, dataEnd);
      if (e.method === 0) {
        // Stored, not compressed
        return new TextDecoder('utf-8').decode(compressed);
      }
      if (e.method !== 8) throw new Error('Unsupported compression method: ' + e.method);
      // Inflate via DecompressionStream('deflate-raw')
      const ds = new DecompressionStream('deflate-raw');
      const inputStream = new Response(compressed).body.pipeThrough(ds);
      const inflated = new Uint8Array(await new Response(inputStream).arrayBuffer());
      return new TextDecoder('utf-8').decode(inflated);
    }

    return { entries, readEntry };
  }

  // ── Minimal XML parser (cells we care about)
  // Parse shared strings: <si><t>foo</t></si> or <si><r>..<t>fo</t></r><r><t>o</t></r></si>
  function parseSharedStrings(xml) {
    if (!xml) return [];
    const out = [];
    // Match each <si>...</si> block
    const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
    let m;
    while ((m = siRe.exec(xml)) !== null) {
      // Concatenate all <t>...</t> inside, in order, decoded
      const inner = m[1];
      let s = '';
      const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
      let t;
      while ((t = tRe.exec(inner)) !== null) {
        s += decodeXml(t[1]);
      }
      out.push(s);
    }
    return out;
  }

  function decodeXml(s) {
    return s
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
      .replace(/&amp;/g, '&');
  }

  // Excel column letters → 0-based index. 'A'=0, 'Z'=25, 'AA'=26
  function colToIndex(ref) {
    const m = ref.match(/^([A-Z]+)/);
    if (!m) return 0;
    let n = 0;
    for (const c of m[1]) n = n * 26 + (c.charCodeAt(0) - 64);
    return n - 1;
  }

  // Excel serial date → JS Date (Excel epoch is 1900-01-00 with a leap-bug)
  function excelDate(n) {
    if (n < 60) return new Date(Date.UTC(1899, 11, 31) + n * 86400000);
    return new Date(Date.UTC(1899, 11, 30) + n * 86400000);
  }

  function formatDateLike(n) {
    const d = excelDate(n);
    if (isNaN(d)) return n;
    return d.toISOString().slice(0, 10);
  }

  // Parse one sheet XML → { rows, rowColors }
  //   rows[r][c]       = the cell value (string|number|null)
  //   rowColors[r][c]  = 'green' | 'red' | null  (from cell fill)
  function parseSheet(xml, shared, dateStyles, styleColorClass) {
    if (!xml) return { rows: [], rowColors: [] };
    const rows = [];
    const rowColors = [];
    const rowRe = /<row\b([^>]*)>([\s\S]*?)<\/row>/g;
    let rm;
    while ((rm = rowRe.exec(xml)) !== null) {
      const rowAttrs = rm[1];
      const rowNumMatch = rowAttrs.match(/\br="(\d+)"/);
      const rowNum = rowNumMatch ? parseInt(rowNumMatch[1]) - 1 : rows.length;
      const cellRe = /<c\b([^/>]*)(?:\/>|>([\s\S]*?)<\/c>)/g;
      const cells = [];
      const cellColors = [];
      let maxCol = -1;
      let cm;
      while ((cm = cellRe.exec(rm[2])) !== null) {
        const attrs = cm[1];
        const inner = cm[2] || '';
        const refMatch = attrs.match(/\br="([A-Z]+\d+)"/);
        if (!refMatch) continue;
        const col = colToIndex(refMatch[1]);
        maxCol = Math.max(maxCol, col);
        const typeMatch = attrs.match(/\bt="([^"]+)"/);
        const styleMatch = attrs.match(/\bs="(\d+)"/);
        const t = typeMatch ? typeMatch[1] : '';
        const vMatch = inner.match(/<v\b[^>]*>([\s\S]*?)<\/v>/);
        const isMatch = inner.match(/<is\b[^>]*>([\s\S]*?)<\/is>/);
        let val = null;
        if (t === 's') {
          if (vMatch) val = shared[parseInt(vMatch[1])] || '';
        } else if (t === 'inlineStr' || t === 'str') {
          if (isMatch) {
            // Pull all <t>…</t>
            let s = '';
            const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
            let tx;
            while ((tx = tRe.exec(isMatch[1])) !== null) s += decodeXml(tx[1]);
            val = s;
          } else if (vMatch) {
            val = decodeXml(vMatch[1]);
          }
        } else if (t === 'b') {
          if (vMatch) val = vMatch[1] === '1';
        } else if (t === 'e') {
          val = null; // error
        } else {
          // Numeric — but might be a date based on style index
          if (vMatch) {
            const num = parseFloat(vMatch[1]);
            if (!isNaN(num) && styleMatch && dateStyles.has(parseInt(styleMatch[1]))) {
              val = formatDateLike(num);
            } else {
              val = isNaN(num) ? vMatch[1] : num;
            }
          }
        }
        cells[col] = val;
        // Track color class from the cell's style (if any). styleColorClass
        // is a Map<styleIndex, 'green'|'red'>. Cells without a style entry
        // or with no recognized color get null.
        if (styleMatch && styleColorClass) {
          const cls = styleColorClass.get(parseInt(styleMatch[1]));
          if (cls) cellColors[col] = cls;
        }
      }
      // Fill the row up to maxCol
      const row = [];
      const rowColorArr = [];
      for (let c = 0; c <= maxCol; c++) {
        row.push(cells[c] !== undefined ? cells[c] : null);
        rowColorArr.push(cellColors[c] || null);
      }
      rows[rowNum] = row;
      rowColors[rowNum] = rowColorArr;
    }
    // Squash undefined holes into empty rows
    for (let i = 0; i < rows.length; i++) {
      if (!rows[i]) rows[i] = [];
      if (!rowColors[i]) rowColors[i] = [];
    }
    return { rows, rowColors };
  }

  // Parse styles.xml to find which style indices are date formats
  // AND which style indices have a fill with a specific theme/RGB color.
  function parseDateStylesAndFills(stylesXml, themeColors) {
    const dateStyles = new Set();
    // Map: style index → 'green' | 'red' | null
    const styleColorClass = new Map();
    if (!stylesXml) return { dateStyles, styleColorClass };

    // Built-in date format IDs: 14-22, 27-36, 45-47, 50-58
    const builtinDateFmts = new Set([14,15,16,17,18,19,20,21,22,27,28,29,30,31,32,33,34,35,36,45,46,47,50,51,52,53,54,55,56,57,58]);
    const customDateFmts = new Set();
    const numFmtRe = /<numFmt\s+numFmtId="(\d+)"\s+formatCode="([^"]*)"/g;
    let m;
    while ((m = numFmtRe.exec(stylesXml)) !== null) {
      const id = parseInt(m[1]);
      const code = m[2].toLowerCase();
      if (/[yhmsd]/.test(code) && !/^[#0.,_]+$/.test(code)) {
        customDateFmts.add(id);
      }
    }

    // Parse the <fills> section. Each <fill> has a <patternFill> with
    // optional <fgColor rgb=".." theme=".." indexed=".."/>. We classify
    // each fill's foreground color as 'green', 'red', or null.
    const fillClassByIndex = [];
    const fillsMatch = stylesXml.match(/<fills\b[^>]*>([\s\S]*?)<\/fills>/);
    if (fillsMatch) {
      const fillRe = /<fill\b[^>]*>([\s\S]*?)<\/fill>/g;
      let fm;
      while ((fm = fillRe.exec(fillsMatch[1])) !== null) {
        const inner = fm[1];
        let hex = null;
        // fgColor takes priority over bgColor for solid pattern fills
        const fg = inner.match(/<fgColor\s+([^/>]+)\/?\s*>/);
        if (fg) {
          const attrs = fg[1];
          const rgbAttr = attrs.match(/rgb="([0-9A-Fa-f]{6,8})"/);
          const themeAttr = attrs.match(/theme="(\d+)"/);
          const indexedAttr = attrs.match(/indexed="(\d+)"/);
          if (rgbAttr) {
            const v = rgbAttr[1];
            // RGB may be 8-char (ARGB) or 6-char (RGB) — keep last 6
            hex = '#' + v.slice(-6).toUpperCase();
          } else if (themeAttr) {
            const t = parseInt(themeAttr[1]);
            if (themeColors && themeColors[t]) hex = themeColors[t];
          } else if (indexedAttr) {
            // Legacy palette — fallback to a few common ones
            const idx = parseInt(indexedAttr[1]);
            const palette = { 10: '#FF0000', 11: '#00FF00', 17: '#00FF00', 50: '#33CC66' };
            if (palette[idx]) hex = palette[idx];
          }
        }
        fillClassByIndex.push(classifyColor(hex));
      }
    }

    // Walk <cellXfs><xf .../>: each xf has numFmtId + fillId attributes.
    const cellXfsMatch = stylesXml.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/);
    if (cellXfsMatch) {
      const xfRe = /<xf\b([^/>]*)\/?>/g;
      let idx = 0;
      let xm;
      while ((xm = xfRe.exec(cellXfsMatch[1])) !== null) {
        const fmtMatch = xm[1].match(/\bnumFmtId="(\d+)"/);
        const fillMatch = xm[1].match(/\bfillId="(\d+)"/);
        const applyFill = xm[1].match(/\bapplyFill="1"/);
        if (fmtMatch) {
          const fmtId = parseInt(fmtMatch[1]);
          if (builtinDateFmts.has(fmtId) || customDateFmts.has(fmtId)) {
            dateStyles.add(idx);
          }
        }
        if (fillMatch) {
          const fillIdx = parseInt(fillMatch[1]);
          // Honor the fill if applyFill="1" OR if fillId > 1 (fillId 0,1 are
          // 'none' and 'gray125' defaults that Excel always defines).
          if ((applyFill || fillIdx > 1) && fillClassByIndex[fillIdx]) {
            styleColorClass.set(idx, fillClassByIndex[fillIdx]);
          }
        }
        idx++;
      }
    }
    return { dateStyles, styleColorClass };
  }

  // Classify a hex color (or null) as 'green', 'red', or null
  function classifyColor(hex) {
    if (!hex) return null;
    const h = hex.replace('#', '').toUpperCase();
    if (h.length < 6) return null;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    // Green: G dominant, R and B relatively low. Covers #00FF00, #34A853 (Google),
    // #92D050 (Excel light green), #228B22 (forest), etc.
    if (g > 100 && g > r + 20 && g > b + 20) return 'green';
    // Red: R dominant. Covers #FF0000, #EA4335 (Google red), #C00000, etc.
    if (r > 150 && r > g + 40 && r > b + 40) return 'red';
    return null;
  }

  // Parse xl/theme/theme1.xml → array indexed by theme color index → '#RRGGBB'
  // OOXML theme color order: dk1, lt1, dk2, lt2, accent1..accent6, hlink, folHlink.
  // BUT Excel SWAPS the first two pairs at apply-time (theme idx 0=lt1, 1=dk1,
  // 2=lt2, 3=dk2) due to historical lt/dk inversion. We honor that swap.
  function parseTheme(themeXml) {
    if (!themeXml) return [];
    const clrSchemeMatch = themeXml.match(/<a:clrScheme\b[^>]*>([\s\S]*?)<\/a:clrScheme>/);
    if (!clrSchemeMatch) return [];
    const inner = clrSchemeMatch[1];
    // Each color is <a:dk1>, <a:lt1>, etc., with either <a:srgbClr val="RRGGBB"/>
    // or <a:sysClr val="windowText" lastClr="000000"/>
    const childRe = /<a:(dk1|lt1|dk2|lt2|accent1|accent2|accent3|accent4|accent5|accent6|hlink|folHlink)\b[^>]*>([\s\S]*?)<\/a:\1>/g;
    const map = {};
    let m;
    while ((m = childRe.exec(inner)) !== null) {
      const tag = m[1];
      const body = m[2];
      const srgb = body.match(/<a:srgbClr\s+val="([0-9A-Fa-f]+)"/);
      const sysClr = body.match(/<a:sysClr\b[^>]*lastClr="([0-9A-Fa-f]+)"/);
      if (srgb) map[tag] = '#' + srgb[1].toUpperCase();
      else if (sysClr) map[tag] = '#' + sysClr[1].toUpperCase();
    }
    // Apply Excel's lt/dk swap for the first two pairs
    return [
      map.lt1, map.dk1, map.lt2, map.dk2,
      map.accent1, map.accent2, map.accent3, map.accent4, map.accent5, map.accent6,
      map.hlink, map.folHlink,
    ];
  }

  // Legacy alias used by older code in this file
  function parseDateStyles(stylesXml) {
    return parseDateStylesAndFills(stylesXml, []).dateStyles;
  }

  // Parse workbook.xml.rels to map sheet rId → target path
  function parseRels(relsXml) {
    const out = {};
    if (!relsXml) return out;
    // [^>]+? avoids the issue where Target/Type can contain '/' (e.g. http://...)
    const re = /<Relationship\s+([^>]+?)\/>/g;
    let m;
    while ((m = re.exec(relsXml)) !== null) {
      const idMatch = m[1].match(/Id="([^"]+)"/);
      const tgtMatch = m[1].match(/Target="([^"]+)"/);
      if (idMatch && tgtMatch) out[idMatch[1]] = tgtMatch[1];
    }
    return out;
  }

  // Parse workbook.xml: <sheet name="..." sheetId="N" r:id="rIdN"/>
  function parseWorkbook(xml) {
    const sheets = [];
    if (!xml) return sheets;
    const re = /<sheet\s+([^>]+?)\/>/g;
    let m;
    while ((m = re.exec(xml)) !== null) {
      const nameMatch = m[1].match(/name="([^"]+)"/);
      const ridMatch = m[1].match(/r:id="([^"]+)"/);
      if (nameMatch && ridMatch) sheets.push({ name: decodeXml(nameMatch[1]), rid: ridMatch[1] });
    }
    return sheets;
  }

  async function readFile(file) {
    const zip = await readZip(file);
    const sharedXml = await zip.readEntry('xl/sharedStrings.xml');
    const stylesXml = await zip.readEntry('xl/styles.xml');
    const workbookXml = await zip.readEntry('xl/workbook.xml');
    const relsXml = await zip.readEntry('xl/_rels/workbook.xml.rels');
    const themeXml = await zip.readEntry('xl/theme/theme1.xml');
    const shared = parseSharedStrings(sharedXml);
    const themeColors = parseTheme(themeXml);
    const { dateStyles, styleColorClass } = parseDateStylesAndFills(stylesXml, themeColors);
    const rels = parseRels(relsXml);
    const sheetMeta = parseWorkbook(workbookXml);

    const sheetNames = [];
    const sheets = {};
    const sheetColors = {};   // parallel to sheets: 2D 'green'|'red'|null per cell
    for (const s of sheetMeta) {
      const target = rels[s.rid];
      if (!target) continue;
      const path = target.startsWith('/') ? target.slice(1) : 'xl/' + target;
      const sheetXml = await zip.readEntry(path);
      const { rows, rowColors } = parseSheet(sheetXml, shared, dateStyles, styleColorClass);
      sheetNames.push(s.name);
      sheets[s.name] = rows;
      sheetColors[s.name] = rowColors;
    }
    return { sheetNames, sheets, sheetColors };
  }

  window.XlsxMini = { readFile };
})();
