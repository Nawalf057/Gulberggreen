/* ============================================================
   Your Plot — Form Submission → Google Sheet (Excel)
   ------------------------------------------------------------
   SETUP (one-time, ~5 minutes)
   1. Create a Google Sheet with these headers in row 1:
        Timestamp | Plot No | Block | Full Name | WhatsApp | Source
   2. Extensions → Apps Script → paste the script below → Save
   3. Deploy → New deployment → Web app
        - Execute as: Me
        - Who has access: Anyone
      Copy the Web App URL and paste it into SUBMIT_URL below.
   4. Test by submitting the form on your-plot.html
   5. Download the sheet anytime as .xlsx: File → Download → Excel

   APPS SCRIPT (Code.gs):
   ------------------------------------------------------------
   function doPost(e) {
     try {
       var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
       var data = JSON.parse(e.postData.contents);
       sheet.appendRow([
         new Date(),
         data.plotNo || '',
         data.block || '',
         data.fullName || '',
         data.whatsapp || '',
         data.source || 'your-plot.html'
       ]);
       return ContentService
         .createTextOutput(JSON.stringify({ ok: true }))
         .setMimeType(ContentService.MimeType.JSON);
     } catch (err) {
       return ContentService
         .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
         .setMimeType(ContentService.MimeType.JSON);
     }
   }
   ============================================================ */

const PLOT_CLAIMS_CONFIG = {
  // Paste your Google Apps Script Web App URL here after deployment.
  SUBMIT_URL: 'https://script.google.com/macros/s/AKfycbxcrCDNjTkaNNINnjkSvfsypZgKrWYg-eE0dZn10wAPBWXePPALe0kfx82fIsF9D75M/exec'
};

function backupClaimLocally(payload) {
  const store = JSON.parse(localStorage.getItem('yourPlotClaims') || '[]');
  store.push(payload);
  localStorage.setItem('yourPlotClaims', JSON.stringify(store));
}

async function savePlotClaim(data) {
  const payload = {
    plotNo: data.plotNo,
    block: data.block,
    fullName: data.fullName,
    whatsapp: data.whatsapp,
    source: 'your-plot.html',
    ts: data.ts
  };

  backupClaimLocally(payload);

  if (!PLOT_CLAIMS_CONFIG.SUBMIT_URL) {
    console.warn('PLOT_CLAIMS_CONFIG.SUBMIT_URL is empty — set it in plot-claims.js to save to Google Sheet.');
    return { ok: true, savedLocally: true, savedToSheet: false };
  }

  const res = await fetch(PLOT_CLAIMS_CONFIG.SUBMIT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });

  const text = await res.text();
  try {
    const json = JSON.parse(text);
    return { ok: json.ok !== false, savedLocally: true, savedToSheet: json.ok !== false };
  } catch (_) {
    return { ok: res.ok, savedLocally: true, savedToSheet: res.ok };
  }
}
