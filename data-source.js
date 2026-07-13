/* ============================================================
   GDIP Block Status — Live Data Source
   ------------------------------------------------------------
   HOW THIS WORKS
   1. All block % / status data lives in ONE Google Sheet (not
      in this file, not duplicated across pages).
   2. Every time blocks-status.html or plot-intelligence.html
      loads, it calls GDIP.getBlocks() below, which fetches the
      sheet's published CSV and re-renders the page with the
      latest numbers.
   3. To update: edit the Google Sheet, save. Next time anyone
      opens the site (or refreshes), the new numbers show up.
      No code changes, no redeploy.
   4. If the sheet can't be reached (offline, URL not set yet,
      sheet unpublished) the page falls back to the last known
      good copy so it never breaks — and shows a small notice
      saying it's showing cached/fallback data.

   ============================================================
   SETUP (one-time, ~5 minutes)
   ------------------------------------------------------------
   1. Make a copy of this sheet (or build your own with the
      same columns): society, block, category, sizes, litigation,
      pct, note
        - society:    "Residencia" or "Greens"
        - block:      block name, e.g. "A", "F-Executive I & II"
        - category:   "Residential" | "Commercial" | "Farmhouse"
        - sizes:      plot sizes separated by "|", e.g.
                       "7 Marla|10 Marla|1 Kanal"
        - litigation: TRUE or FALSE
        - pct:        a number 0-100, or leave BLANK for
                       "data pending / not yet verified"
        - note:       one paragraph describing the block

   2. In Google Sheets: File > Share > Publish to web
        - Choose the correct tab
        - Choose format: "Comma-separated values (.csv)"
        - Click Publish, copy the URL it gives you

   3. Paste that URL into CONFIG.SHEET_CSV_URL below.

   That's it — both pages read from this file automatically.
   ============================================================ */

const GDIP_CONFIG = {
  // Paste your "Publish to web" CSV URL for the BLOCK-LEVEL tab here.
  // Leave blank ("") to run on fallback data only.
  SHEET_CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRgbqXAPuRx2glio-QdXoqi-YF2U6kcEPakoz86uzdQg6758gLShzxKl6WfgxuX8V4wka17ml36fsjQ/pub?gid=0&single=true&output=csv",

  // Paste your "Publish to web" CSV URL for the PLOT-LEVEL tab here
  // (a separate tab in the same Google Sheet, one row per real plot:
  // society, block, plot_no, size, status, possession, lop, price_low,
  // price_high, note). Leave blank to keep using illustrative
  // auto-generated sample plots per block.
  PLOTS_SHEET_CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRgbqXAPuRx2glio-QdXoqi-YF2U6kcEPakoz86uzdQg6758gLShzxKl6WfgxuX8V4wka17ml36fsjQ/pub?gid=1819129867&single=true&output=csv",
  // How long to trust a cached copy before re-fetching, in ms.
  // Kept short so updates show up quickly (real-time-ish) while
  // avoiding a network fetch on every single click.
  CACHE_MAX_AGE_MS: 30 * 60 * 1000, // 30 minutes

  CACHE_KEY: "gdip_block_status_cache_v1",
  PLOTS_CACHE_KEY: "gdip_plot_records_cache_v1",
};

// Last-known-good data, used if the live sheet is unreachable or
// not configured yet. Keep this reasonably current by occasionally
// syncing it from the sheet — but it is NOT the live source once
// SHEET_CSV_URL is set above.
const GDIP_FALLBACK_DATA = [
  { society:"Residencia", block:"A", category:"Residential", sizes:["7 Marla","10 Marla","1 Kanal"], litigation:true, pct:58, note:"Gulberg Residencia's oldest and most populated sector, known for early possession and strong demand. A minority of pockets are reported to carry unresolved legal/title issues, so this block rewards extra diligence." },
  { society:"Residencia", block:"B", category:"Residential", sizes:["7 Marla","10 Marla","1 Kanal"], litigation:false, pct:35, note:"An executive-style expansion next to Block A. Around 90% of land parcels have been cleared, and levelling / street-cutting work has recently begun — possession has not yet been formally announced across the block." },
  { society:"Residencia", block:"C", category:"Residential", sizes:["7 Marla","10 Marla","1 Kanal"], litigation:false, pct:88, note:"Infrastructure is nearing completion with construction picking up across several streets. Most plots here carry clear possession and it's considered one of the better value blocks near the commercial core." },
  { society:"Residencia", block:"D", category:"Commercial", sizes:["6 Marla","8 Marla","1 Kanal"], litigation:false, pct:80, note:"Residencia's central commercial markaz. Several plazas are already operating with national and international brands, while others are still under construction." },
  { society:"Residencia", block:"E", category:"Residential", sizes:["1 Kanal"], litigation:false, pct:98, note:"Close to 100% developed and one of the most sought-after blocks — offers only 1 Kanal plots, with houses already under construction and utilities fully active." },
  { society:"Residencia", block:"F", category:"Residential", sizes:["10 Marla","1 Kanal","30x60"], litigation:false, pct:90, note:"Grouped among Residencia's fully developed blocks. Slightly smaller plot formats make it accessible to a wider range of buyers." },
  { society:"Residencia", block:"G", category:"Residential", sizes:["7 Marla","10 Marla","1 Kanal"], litigation:false, pct:35, note:"Under possession, with the rest of the land largely cleared or in final stages. Prices remain among the lowest in Residencia, which is why it's watched closely by early investors." },
  { society:"Residencia", block:"H", category:"Residential", sizes:["7 Marla","10 Marla","1 Kanal"], litigation:false, pct:55, note:"Partially developed with a well-planned mix of residential plot sizes; construction activity has been increasing." },
  { society:"Residencia", block:"I", category:"Residential", sizes:["10 Marla","1 Kanal"], litigation:false, pct:90, note:"One of the fully developed, possession-ready blocks, with a high proportion of houses already built." },
  { society:"Residencia", block:"J", category:"Residential", sizes:["7 Marla","10 Marla","1 Kanal"], litigation:false, pct:80, note:"Most plots developed and possession-ready; buyer confidence and construction activity have both been rising." },
  { society:"Residencia", block:"K", category:"Residential", sizes:["7 Marla","10 Marla","1 Kanal"], litigation:false, pct:55, note:"Mixed-size residential block with growing construction activity, slightly behind neighbouring J in overall completion." },
  { society:"Residencia", block:"L", category:"Residential", sizes:["7 Marla","10 Marla","1 Kanal"], litigation:false, pct:88, note:"Nearly fully developed, with only minor pockets awaiting final infrastructure work." },
  { society:"Residencia", block:"M", category:"Residential", sizes:["7 Marla","10 Marla","1 Kanal"], litigation:false, pct:45, note:"Under rapid development with new possession zones opening up and growing interest in nearby commercial potential." },
  { society:"Residencia", block:"N", category:"Residential", sizes:["7 Marla","10 Marla","1 Kanal"], litigation:false, pct:45, note:"Under active development; part of the L–P corridor seeing new possession zones released in stages." },
  { society:"Residencia", block:"O", category:"Residential", sizes:["7 Marla","10 Marla","1 Kanal"], litigation:false, pct:45, note:"Similar development stage to Block N, with steady infrastructure progress." },
  { society:"Residencia", block:"P", category:"Residential", sizes:["7 Marla","10 Marla","1 Kanal"], litigation:false, pct:45, note:"Part of the newer possession corridor, with commercial potential growing along its edges." },
  { society:"Residencia", block:"Q", category:"Residential", sizes:["7 Marla","10 Marla"], litigation:false, pct:15, note:"Newly launched with early-bird pricing — on-ground development is still minimal, positioning it as a longer-horizon investment." },
  { society:"Residencia", block:"R", category:"Residential", sizes:["7 Marla","10 Marla"], litigation:true, pct:20, note:"Possession already granted on the developed portion; the remainder is reported to be affected by ongoing litigation, which has slowed progress. Prices are lower here to reflect that risk." },
  { society:"Residencia", block:"S", category:"Residential", sizes:["7 Marla","10 Marla"], litigation:false, pct:15, note:"A newly launched sector with limited on-ground development so far — an early-entry, long-term play." },
  { society:"Residencia", block:"T", category:"Residential", sizes:["7 Marla","10 Marla","1 Kanal"], litigation:false, pct:85, note:"Despite being one of the newer-numbered blocks, it's reported to be close to 90% complete, ahead of several older sectors." },
  { society:"Residencia", block:"V", category:"Residential", sizes:["10 Marla","1 Kanal"], litigation:false, pct:55, note:"Borders the Naval Anchorage area and is developing steadily, with infrastructure work ongoing." },
  { society:"Residencia", block:"AA", category:"Residential", sizes:["7 Marla","10 Marla"], litigation:false, pct:null, note:"Public development data for this block is currently too limited to publish a reliable percentage. Marked as data pending until independently verified." },
  { society:"Residencia", block:"A-Executive 1", category:"Residential", sizes:["7 Marla","10 Marla","1 Kanal"], litigation:false, pct:60, note:"Executive extension adjoining Block A; partially developed with ongoing construction activity." },
  { society:"Residencia", block:"A-Executive 2 / Premium", category:"Residential", sizes:["10 Marla","1 Kanal"], litigation:false, pct:35, note:"Newer premium extension of the A-Executive area; still in earlier stages of on-ground development." },
  { society:"Residencia", block:"E-Executive", category:"Residential", sizes:["1 Kanal"], litigation:false, pct:95, note:"Executive extension of Block E; largely developed with active construction and utilities in place." },
  { society:"Residencia", block:"F-Executive I & II", category:"Residential", sizes:["10 Marla","1 Kanal"], litigation:false, pct:55, note:"Executive extension of Block F; partially developed, with steady construction activity underway." },
  { society:"Residencia", block:"F-Executive III & IV", category:"Residential", sizes:["10 Marla","1 Kanal"], litigation:false, pct:20, note:"Newer phase of the F-Executive extension; still in early development stages." },
  { society:"Greens", block:"A-Executive", category:"Farmhouse", sizes:["4 Kanal","5 Kanal","10 Kanal"], litigation:false, pct:88, note:"One of Greens' core blocks, located near the entrance close to the Islamabad Expressway; largely developed with an active resale market." },
  { society:"Greens", block:"A", category:"Farmhouse", sizes:["4 Kanal","5 Kanal","10 Kanal"], litigation:false, pct:88, note:"A mature farmhouse block, described as possession-ready, with most transactions happening on the resale market rather than fresh booking." },
  { society:"Greens", block:"B", category:"Farmhouse", sizes:["4 Kanal","5 Kanal","10 Kanal"], litigation:false, pct:82, note:"Well-established farmhouse sector with underground utilities and active landscaping." },
  { society:"Greens", block:"C", category:"Farmhouse", sizes:["4 Kanal","5 Kanal","10 Kanal"], litigation:false, pct:82, note:"Home to institutions such as a private school; largely built out with a peaceful, low-density character." },
  { society:"Greens", block:"D", category:"Commercial", sizes:["6 Marla","8 Marla","1 Kanal"], litigation:false, pct:80, note:"Greens' dedicated commercial block — hosts an educational institution and several commercial developments, with more brands opening as construction progresses." },
  { society:"Greens", block:"E", category:"Farmhouse", sizes:["4 Kanal","5 Kanal","10 Kanal"], litigation:false, pct:85, note:"A settled farmhouse block with reliable utilities; new bookings across Greens are now largely limited to specific extensions rather than this core block." },
];

const GDIP_SOCIETY_LABEL = { Residencia: "Gulberg Residencia", Greens: "Gulberg Greens" };
const GDIP_TIER_LABEL = { developed:"Fully Developed", partial:"Partially Developed", early:"Early / New Launch", unknown:"Data Pending Verification" };

function gdipStatusTier(pct, litigation) {
  if (pct === null || pct === undefined || Number.isNaN(pct)) return "unknown";
  if (litigation && pct < 50) return "early";
  if (pct >= 80) return "developed";
  if (pct >= 40) return "partial";
  return "early";
}

function gdipParseCsv(csvText) {
  // Minimal CSV parser (handles quoted fields with commas/pipes).
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < csvText.length; i++) {
    const c = csvText[i], next = csvText[i + 1];
    if (inQuotes) {
      if (c === '"' && next === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ""; }
      else if (c === '\n' || c === '\r') {
        if (field.length || row.length) { row.push(field); rows.push(row); row = []; field = ""; }
        if (c === '\r' && next === '\n') i++;
      } else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows[0].map(h => h.trim().toLowerCase());
  return rows.slice(1).filter(r => r.some(v => v && v.trim().length)).map(r => {
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = (r[idx] || "").trim(); });
    return obj;
  });
}

function gdipRowsToBlocks(rows) {
  return rows.map(r => {
    const pctRaw = (r.pct || "").trim();
    const pct = pctRaw === "" ? null : Number(pctRaw);
    return {
      society: r.society,
      block: r.block,
      category: r.category,
      sizes: (r.sizes || "").split("|").map(s => s.trim()).filter(Boolean),
      litigation: /^true$/i.test((r.litigation || "").trim()),
      pct: (pct === null || Number.isNaN(pct)) ? null : pct,
      note: r.note || "",
    };
  }).filter(b => b.society && b.block);
}

function gdipEnrich(blocks) {
  return blocks.map(b => ({ ...b, tier: gdipStatusTier(b.pct, b.litigation), tierLabel: GDIP_TIER_LABEL[gdipStatusTier(b.pct, b.litigation)] }));
}

function gdipReadCache() {
  try {
    const raw = localStorage.getItem(GDIP_CONFIG.CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.blocks || !parsed.fetchedAt) return null;
    return parsed;
  } catch (e) { return null; }
}

function gdipWriteCache(blocks) {
  try {
    localStorage.setItem(GDIP_CONFIG.CACHE_KEY, JSON.stringify({ blocks, fetchedAt: Date.now() }));
  } catch (e) { /* ignore quota/storage errors */ }
}

// ---- Per-plot records (real plots, not illustrative samples) ----

// Valid values for the "status" column in the Plots sheet.
// Anything else / blank is treated as "NA" (not yet verified).
const GDIP_PLOT_STATUSES = ["Developed", "Non-Developed", "NA"];

function gdipNormalizePlotStatus(raw) {
  const s = (raw || "").trim().toLowerCase();
  if (s === "developed") return "Developed";
  if (s === "non-developed" || s === "non developed" || s === "undeveloped") return "Non-Developed";
  return "NA";
}

function gdipRowsToPlots(rows) {
  return rows.map(r => {
    const priceLowRaw = (r.price_low || "").trim();
    const priceHighRaw = (r.price_high || "").trim();
    const priceLow = priceLowRaw === "" ? NaN : Number(priceLowRaw);
    const priceHigh = priceHighRaw === "" ? NaN : Number(priceHighRaw);
    return {
      society: r.society,
      block: r.block,
      plotNo: (r.plot_no || r.plotno || "").trim(),
      size: (r.size || "").trim(),
      status: gdipNormalizePlotStatus(r.status),
      possession: (r.possession || "").trim(),
      lop: (r.lop || "").trim(),
      priceLow: Number.isFinite(priceLow) ? priceLow : null,
      priceHigh: Number.isFinite(priceHigh) ? priceHigh : null,
      note: (r.note || "").trim(),
    };
  }).filter(p => p.society && p.block && p.plotNo);
}

function gdipReadPlotsCache() {
  try {
    const raw = localStorage.getItem(GDIP_CONFIG.PLOTS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.plots || !parsed.fetchedAt) return null;
    return parsed;
  } catch (e) { return null; }
}

function gdipWritePlotsCache(plots) {
  try {
    localStorage.setItem(GDIP_CONFIG.PLOTS_CACHE_KEY, JSON.stringify({ plots, fetchedAt: Date.now() }));
  } catch (e) { /* ignore quota/storage errors, e.g. very large plot lists */ }
}

/**
 * GDIP.getBlocks() -> Promise<{ blocks, generatedAt, source }>
 * source is one of: "live" (fresh fetch from the sheet),
 * "cache" (recent local cache), "fallback" (embedded data,
 * used when the sheet isn't reachable or isn't configured).
 */
window.GDIP = {
  async getBlocks(forceRefresh = false) {
    const cached = gdipReadCache();
    const cacheFresh = cached && (Date.now() - cached.fetchedAt) < GDIP_CONFIG.CACHE_MAX_AGE_MS;

    if (!forceRefresh && cacheFresh) {
      return { blocks: gdipEnrich(cached.blocks), generatedAt: new Date(cached.fetchedAt), source: "cache" };
    }

    if (GDIP_CONFIG.SHEET_CSV_URL) {
      try {
        const bust = (GDIP_CONFIG.SHEET_CSV_URL.includes("?") ? "&" : "?") + "cb=" + Date.now();
        const res = await fetch(GDIP_CONFIG.SHEET_CSV_URL + bust, { cache: "no-store" });
        if (!res.ok) throw new Error("Sheet fetch failed: " + res.status);
        const text = await res.text();
        const rows = gdipParseCsv(text);
        const blocks = gdipRowsToBlocks(rows);
        if (!blocks.length) throw new Error("Sheet returned no rows");
        gdipWriteCache(blocks);
        return { blocks: gdipEnrich(blocks), generatedAt: new Date(), source: "live" };
      } catch (err) {
        console.warn("GDIP: live sheet fetch failed, falling back.", err);
        if (cached) return { blocks: gdipEnrich(cached.blocks), generatedAt: new Date(cached.fetchedAt), source: "cache" };
        return { blocks: gdipEnrich(GDIP_FALLBACK_DATA), generatedAt: null, source: "fallback" };
      }
    }

    if (cached) return { blocks: gdipEnrich(cached.blocks), generatedAt: new Date(cached.fetchedAt), source: "cache" };
    return { blocks: gdipEnrich(GDIP_FALLBACK_DATA), generatedAt: null, source: "fallback" };
  },
  /**
   * GDIP.getPlots() -> Promise<{ plots, generatedAt, source, configured }>
   * configured=false means PLOTS_SHEET_CSV_URL hasn't been set yet,
   * so callers should fall back to illustrative sample plots.
   */
  async getPlots(forceRefresh = false) {
    if (!GDIP_CONFIG.PLOTS_SHEET_CSV_URL) {
      return { plots: [], generatedAt: null, source: "unconfigured", configured: false };
    }
    const cached = gdipReadPlotsCache();
    const cacheFresh = cached && (Date.now() - cached.fetchedAt) < GDIP_CONFIG.CACHE_MAX_AGE_MS;

    if (!forceRefresh && cacheFresh) {
      return { plots: cached.plots, generatedAt: new Date(cached.fetchedAt), source: "cache", configured: true };
    }

    try {
      const bust = (GDIP_CONFIG.PLOTS_SHEET_CSV_URL.includes("?") ? "&" : "?") + "cb=" + Date.now();
      const res = await fetch(GDIP_CONFIG.PLOTS_SHEET_CSV_URL + bust, { cache: "no-store" });
      if (!res.ok) throw new Error("Plots sheet fetch failed: " + res.status);
      const text = await res.text();
      const rows = gdipParseCsv(text);
      const plots = gdipRowsToPlots(rows);
      gdipWritePlotsCache(plots);
      return { plots, generatedAt: new Date(), source: "live", configured: true };
    } catch (err) {
      console.warn("GDIP: live plots sheet fetch failed, falling back.", err);
      if (cached) return { plots: cached.plots, generatedAt: new Date(cached.fetchedAt), source: "cache", configured: true };
      return { plots: [], generatedAt: null, source: "fallback", configured: true };
    }
  },

  getPlotsForBlock(allPlots, society, block) {
    return allPlots.filter(p => p.society === society && p.block === block);
  },

  SOCIETY_LABEL: GDIP_SOCIETY_LABEL,
  TIER_LABEL: GDIP_TIER_LABEL,
  PLOT_STATUSES: GDIP_PLOT_STATUSES,
  statusTier: gdipStatusTier,
};
