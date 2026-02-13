document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('ciso-form');
  const downloadBtn = document.getElementById('download-pdf');


  function fmtCurrency(n) {
    return Number(n).toLocaleString('en-US', {style: 'currency', currency: 'USD', maximumFractionDigits: 2});
  }

  function computeAndRender() {
    const daily = parseFloat(document.getElementById('dailyRevenue').value) || 0;
    const coldDays = parseFloat(document.getElementById('coldDays').value) || 0;
    const hotCost = parseFloat(document.getElementById('hotCost').value) || 0;
    const hotHours = parseFloat(document.getElementById('hotHours').value) || 0;

    const coldLoss = daily * coldDays;
    const hotRevenueLoss = daily * (hotHours / 24);
    const hotTotal = hotCost + hotRevenueLoss;
    const benefit = coldLoss - hotTotal;
    const roi = hotTotal > 0 ? (benefit / hotTotal) * 100 : Infinity;

    // Live compact result for page
    const live = [];
    live.push(`<p><strong>Daily revenue:</strong> ${fmtCurrency(daily)}</p>`);
    live.push(`<p><strong>Cold site loss (${coldDays} days):</strong> ${fmtCurrency(coldLoss)}</p>`);
    live.push(`<p><strong>Total Hot Site cost:</strong> ${fmtCurrency(hotTotal)}</p>`);
    live.push(`<p><strong>Avoided loss (Cold - Hot):</strong> ${fmtCurrency(benefit)}</p>`);
    live.push(`<p><strong>ROI on Hot Site:</strong> ${isFinite(roi) ? roi.toFixed(1) + '%' : '—'}</p>`);
    document.getElementById('result-content').innerHTML = live.join('\n');

    // Build the printable report HTML
    const inputsTable = document.getElementById('inputs-table');
    inputsTable.innerHTML = `
      <tr><td class="rc-key">Daily revenue</td><td class="rc-val">${fmtCurrency(daily)}</td></tr>
      <tr><td class="rc-key">Cold site recovery (days)</td><td class="rc-val">${coldDays} day(s)</td></tr>
      <tr><td class="rc-key">Hot site fixed cost</td><td class="rc-val">${fmtCurrency(hotCost)}</td></tr>
      <tr><td class="rc-key">Hot site recovery (hours)</td><td class="rc-val">${hotHours} hour(s)</td></tr>
    `;

    const reportHtml = `
      <div>
        <table class="rc-table">
          <tr><td class="rc-key">Cold site estimated loss</td><td class="rc-val">${fmtCurrency(coldLoss)}</td></tr>
          <tr><td class="rc-key">Hot site revenue lost during recovery</td><td class="rc-val">${fmtCurrency(hotRevenueLoss)}</td></tr>
          <tr><td class="rc-key">Hot site total cost</td><td class="rc-val">${fmtCurrency(hotTotal)}</td></tr>
          <tr><td class="rc-key">Avoided loss (Cold - Hot)</td><td class="rc-val">${fmtCurrency(benefit)}</td></tr>
          <tr><td class="rc-key">ROI on Hot Site</td><td class="rc-val">${isFinite(roi) ? roi.toFixed(1) + '%' : '—'}</td></tr>
        </table>
        <div style="margin-top:0.6rem">Summary: With a daily revenue of ${fmtCurrency(daily)}, a ${coldDays}-day outage costs approximately ${fmtCurrency(coldLoss)}. A Hot Site with a fixed cost of ${fmtCurrency(hotCost)} and ${hotHours} hours of downtime results in a total cost of ${fmtCurrency(hotTotal)}, yielding an expected ROI of ${isFinite(roi) ? roi.toFixed(1) + '%' : '—'}.</div>
      </div>
    `;

    // Put the report HTML into result-content (the printable area already contains header/inputs table)
    document.getElementById('result-content').innerHTML = reportHtml;

    // Set report date
    const d = new Date();
    const dateStr = d.toISOString().slice(0,10);
    const dateEl = document.getElementById('report-date');
    if (dateEl) dateEl.textContent = 'Date: ' + dateStr;
  }

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      computeAndRender();
    });
  }

  if (downloadBtn) {
    downloadBtn.addEventListener('click', function () {
      // Ensure latest values are shown
      computeAndRender();
      const element = document.getElementById('report');
      const title = 'CISO Budget Defense';
      const subtitle = 'Hot vs Cold Site Analysis';
      const orgName = 'Risk Calculator';
      const execSummary = document.getElementById('result-content') ? document.getElementById('result-content').innerHTML : '';
      const filename = 'ciso-budget-defense.pdf';
      if (window.createPresentationPDF) {
        window.createPresentationPDF({ title, subtitle, orgName, executiveSummary: execSummary, reportElement: element, filename });
      } else if (window.html2pdf) {
        const opt = {
          margin:       10,
          filename:     filename,
          image:        { type: 'jpeg', quality: 0.98 },
          html2canvas:  { scale: 2 },
          jsPDF:        { unit: 'pt', format: 'a4', orientation: 'portrait' }
        };
        html2pdf().set(opt).from(element).save();
      } else {
        alert('PDF library not loaded.');
      }
    });
  }

  // Initial render
  computeAndRender();
});
