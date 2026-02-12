document.addEventListener('DOMContentLoaded', function () {
  const sectorSelect = document.getElementById('sectorSelect');
  const assetInput = document.getElementById('assetValue');
  const efInput = document.getElementById('exposureFactor');
  const aroInput = document.getElementById('aroValue');
  const form = document.getElementById('sb-form');
  const downloadBtn = document.getElementById('sb-download');

  // Use the global SECTOR_DATA if available
  const SECTOR_DATA = window.SECTOR_DATA || {};
  function fmt(n){
    return Number(n).toLocaleString('en-US', {style:'currency', currency:'USD', maximumFractionDigits:2});
  }

  function updateAroFromSector() {
    const s = sectorSelect.value;
    const data = SECTOR_DATA[s];
    if (data && typeof data.ARO === 'number') {
      aroInput.value = Number(data.ARO).toFixed(2);
    }
  }

  function computeAndRender() {
    const asset = parseFloat(assetInput.value) || 0;
    const efPct = parseFloat(efInput.value) || 0;
    // Use sector data for additional context
    const sector = sectorSelect.value;
    const sdata = SECTOR_DATA[sector] || {};
    // sector authoritative ARO
    const sectorARO = (sdata && typeof sdata.ARO === 'number') ? Number(sdata.ARO) : (parseFloat(aroInput.value) || 0);
    // user-entered revenue optional
    const revenueInput = parseFloat(document.getElementById('revenueInput').value) || null;

  // SLE = asset * EF
  const sle = asset * (Math.min(Math.max(efPct,0),100) / 100);

  // Expected annual breach cost using sector AvgBreachCost (if available)
  const expectedAnnualBreachCost = (sdata.AvgBreachCost && sectorARO) ? sdata.AvgBreachCost * sectorARO : null;

    // Build inputs table
    document.getElementById('sb-inputs').innerHTML = `
      <tr><td class="rc-key">Sector</td><td class="rc-val">${sector}</td></tr>
      <tr><td class="rc-key">Asset value</td><td class="rc-val">${fmt(asset)}</td></tr>
      <tr><td class="rc-key">Exposure Factor (EF)</td><td class="rc-val">${efPct}%</td></tr>
  <tr><td class="rc-key">Annualized Rate of Occurrence (ARO)</td><td class="rc-val">${sectorARO} (per year)</td></tr>
      <tr><td class="rc-key">Sector Avg. Breach Cost</td><td class="rc-val">${sdata.AvgBreachCost ? fmt(sdata.AvgBreachCost) : '—'}</td></tr>
      <tr><td class="rc-key">Sector Downtime Cost / hour</td><td class="rc-val">${sdata.DowntimeCostPerHour ? fmt(sdata.DowntimeCostPerHour) : '—'}</td></tr>
    `;

    // Controls and strategy
    const selectedStrategy = (document.querySelector('input[name="dr_strategy"]:checked') || { value: 'Cold Site' }).value;
    const drInfo = window.DR_STRATEGIES && window.DR_STRATEGIES[selectedStrategy] ? window.DR_STRATEGIES[selectedStrategy] : { recovery_time_hours: 336, annual_cost: 10000 };
    const ctlMfa = !!document.getElementById('ctl-mfa').checked;
    const ctlPhish = !!document.getElementById('ctl-phish').checked;
    const ctlSucc = !!document.getElementById('ctl-succession').checked;

    // Compute ALE_pre using sector-authoritative ARO and baseline loss magnitude (revenue or AvgBreachCost)
    const lossMagnitude = revenueInput || sdata.AvgBreachCost || asset;
    const efFraction = Math.min(Math.max(efPct, 0), 100) / 100.0;
    const ALE_pre = lossMagnitude * efFraction * sectorARO;

    // Apply controls to reduce ARO / downtime cost
    let reducedARO = sectorARO;
    if (ctlMfa) reducedARO = reducedARO * 0.5; // reduce by 50%
    if (ctlPhish) reducedARO = reducedARO * 0.8; // further reduce by 20%

    let downtimeCostPerHour = sdata.DowntimeCostPerHour || 0;
    if (ctlSucc) downtimeCostPerHour = downtimeCostPerHour * 0.9; // reduce by 10%

    const ALE_post = lossMagnitude * efFraction * reducedARO;

    // Downtime loss calculations
    const cold = window.DR_STRATEGIES && window.DR_STRATEGIES['Cold Site'] ? window.DR_STRATEGIES['Cold Site'] : { recovery_time_hours: 336, annual_cost: 10000 };
    const downtimeLossCold = (sdata.DowntimeCostPerHour || 0) * cold.recovery_time_hours;
    const downtimeLossSelected = downtimeCostPerHour * drInfo.recovery_time_hours;
    const moneySavedByBCDR = Math.max(0, downtimeLossCold - downtimeLossSelected);

  // Cost of controls includes selected controls' costs (from CONTROL_COSTS global) and optionally DR annual cost
  const CC = window.CONTROL_COSTS || { mfa:25000, phish:7500, succession:5000 };
  const includeDR = !!document.getElementById('include-dr-cost') && document.getElementById('include-dr-cost').checked;
  let costOfControls = includeDR ? (drInfo.annual_cost || 0) : 0;
  if (ctlMfa) costOfControls += (CC.mfa || 0);
  if (ctlPhish) costOfControls += (CC.phish || 0);
  if (ctlSucc) costOfControls += (CC.succession || 0);

    const avoidedDowntimeLoss = moneySavedByBCDR;

    // ROSI = ((ALE_pre - ALE_post) + Avoided_Downtime_Loss - Cost_of_Controls) / Cost_of_Controls
    const numerator = ((ALE_pre - ALE_post) + avoidedDowntimeLoss - costOfControls);
    const ROSI = costOfControls > 0 ? (numerator / costOfControls) : Infinity;

    // Narrative and results
    const results = [];
    results.push(`<p><strong>Single Loss Expectancy (SLE):</strong> ${fmt(sle)} (asset * EF)</p>`);
    results.push(`<p><strong>Annual Loss Expectancy (ALE) — Inherent:</strong> ${fmt(ALE_pre)}</p>`);
    results.push(`<p><strong>Annual Loss Expectancy (ALE) — Residual:</strong> ${fmt(ALE_post)}</p>`);
    if (expectedAnnualBreachCost !== null) {
      results.push(`<p><strong>Expected Annual Breach Cost (AvgBreachCost * ARO):</strong> ${fmt(expectedAnnualBreachCost)}</p>`);
    }

    results.push(`<p><strong>Selected BCDR:</strong> ${selectedStrategy} (recovery: ${drInfo.recovery_time_hours} hours, cost: ${fmt(drInfo.annual_cost)})</p>`);
    results.push(`<p><strong>Downtime loss — Cold Site (baseline):</strong> ${fmt(downtimeLossCold)}</p>`);
    results.push(`<p><strong>Downtime loss — Selected strategy:</strong> ${fmt(downtimeLossSelected)}</p>`);
    results.push(`<p><strong>Money saved by BCDR:</strong> ${fmt(moneySavedByBCDR)}</p>`);
    results.push(`<p><strong>Cost of controls (DR + selected controls):</strong> ${fmt(costOfControls)}</p>`);
    results.push(`<p><strong>ROSI:</strong> ${isFinite(ROSI) ? (ROSI*100).toFixed(1) + '%' : '—'}</p>`);

    // Simple recommendation
    if (ROSI > 0) {
      results.push(`<p><strong>Recommendation:</strong> The selected controls and BCDR provide a positive ROSI; consider adopting them.</p>`);
    } else {
      results.push(`<p><strong>Recommendation:</strong> ROSI is not positive. Re-evaluate strategy and controls for better cost-effectiveness.</p>`);
    }

    document.getElementById('sb-results').innerHTML = results.join('\n');

    // Update money saved display
    const moneyEl = document.getElementById('sb-money-saved');
    if (moneyEl) moneyEl.textContent = fmt(moneySavedByBCDR);

    // Set date
    const d = new Date();
    document.getElementById('sb-date').textContent = 'Date: ' + d.toISOString().slice(0,10);
    // Update sensitivity chart (ALE vs EF)
    try {
      const canvas = document.getElementById('sb-chart');
      if (canvas && window.Chart) {
        const efLabels = [];
        const efData = [];
        for (let e=0; e<=100; e+=5) {
          efLabels.push(String(e));
          const sle_e = asset * (e/100.0);
          const ale_e = sle_e * sectorARO;
          efData.push(Math.round(ale_e));
        }

        if (!window._sbChart) {
          const ctx = canvas.getContext('2d');
          window._sbChart = new Chart(ctx, {
            type: 'line',
            data: {
              labels: efLabels,
              datasets: [{
                label: 'ALE (USD)',
                data: efData,
                borderColor: getComputedStyle(document.documentElement).getPropertyValue('--rc-accent') || '#2a9df4',
                backgroundColor: 'rgba(42,157,244,0.08)',
                fill: true,
                tension: 0.25,
                pointRadius: 3
              }]
            },
            options: {
              scales: {
                x: { title: { display: true, text: 'Exposure Factor (%)' } },
                y: { title: { display: true, text: 'ALE (USD)' }, ticks: { callback: function(v){ return '$' + Number(v).toLocaleString(); } } }
              },
              plugins: { legend: { display: false } }
            }
          });
        } else {
          window._sbChart.data.labels = efLabels;
          window._sbChart.data.datasets[0].data = efData;
          window._sbChart.update();
        }
      }
    } catch (err) {
      console.warn('Chart update failed', err);
    }

    // Helper: format large numbers as K/M
    function fmtLarge(v) {
      if (v >= 1000000) return '$' + (v/1000000).toFixed(2) + 'M';
      if (v >= 1000) return '$' + (v/1000).toFixed(1) + 'K';
      return '$' + Number(v).toLocaleString();
    }

    // Update ALE vs ARO chart
    try {
      const canvas2 = document.getElementById('sb-chart-aro');
      if (canvas2 && window.Chart) {
        const aroLabels = [];
        const aroData = [];
        // vary ARO from 0 to 1.0 in steps
        for (let a=0; a<=100; a+=5) {
          const aro_v = a/100.0;
          aroLabels.push( (aro_v).toFixed(2) );
          const ale_v = lossMagnitude * efFraction * aro_v;
          aroData.push(Math.round(ale_v));
        }

        if (!window._sbAroChart) {
          const ctx2 = canvas2.getContext('2d');
          const aroOptions = {
            scales: {
              x: { title: { display: true, text: 'ARO (per year)' } },
              y: { title: { display: true, text: 'ALE (USD)' }, ticks: { callback: function(v){ return fmtLarge(v); } } }
            },
            plugins: { legend: { display: false } }
          };
          window._sbAroChart = new Chart(ctx2, {
            type: 'line',
            data: { labels: aroLabels, datasets: [{ label: 'ALE (USD)', data: aroData, borderColor: getComputedStyle(document.documentElement).getPropertyValue('--rc-primary') || '#1e6fb3', backgroundColor: 'rgba(30,111,179,0.06)', fill: true, tension: 0.25, pointRadius: 2 }] },
            options: aroOptions
          });
        } else {
          window._sbAroChart.data.labels = aroLabels;
          window._sbAroChart.data.datasets[0].data = aroData;
          window._sbAroChart.update();
        }
      }
    } catch (err) {
      console.warn('ARO chart update failed', err);
    }

    // Update bar chart: Inherent vs Residual ALE
    try {
      const barCanvas = document.getElementById('sb-bar-chart');
      if (barCanvas && window.Chart) {
        const labels = ['Inherent ALE','Residual ALE'];
        const dataVals = [Math.round(ALE_pre), Math.round(ALE_post)];
        if (!window._sbBarChart) {
          const ctx3 = barCanvas.getContext('2d');
          const barOptions = { plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: function(v){ return fmtLarge(v); } } } } };
          window._sbBarChart = new Chart(ctx3, {
            type: 'bar',
            data: { labels: labels, datasets: [{ label: 'ALE (USD)', data: dataVals, backgroundColor: [getComputedStyle(document.documentElement).getPropertyValue('--rc-primary') || '#1e6fb3', getComputedStyle(document.documentElement).getPropertyValue('--rc-accent') || '#2a9df4'] }] },
            options: barOptions
          });
        } else {
          window._sbBarChart.data.datasets[0].data = dataVals;
          window._sbBarChart.update();
        }
      }
    } catch (err) {
      console.warn('Bar chart update failed', err);
    }
  }

  // wire events
  sectorSelect.addEventListener('change', function () {
    updateAroFromSector();
  });

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      computeAndRender();
    });
  }

  if (downloadBtn) {
    downloadBtn.addEventListener('click', function () {
      computeAndRender();
      const el = document.getElementById('sb-report');
      const title = 'Small Business Reality Check';
      const subtitle = 'ALE Report';
      const orgName = 'Risk Calculator';
      const execSummary = document.getElementById('sb-results') ? document.getElementById('sb-results').innerHTML : '';
      const filename = 'small-business-reality-check.pdf';
      if (window.createPresentationPDF) {
        window.createPresentationPDF({ title, subtitle, orgName, executiveSummary: execSummary, reportElement: el, filename });
      } else if (window.html2pdf) {
        // fallback
        const opt = { margin:10, filename, image:{type:'jpeg',quality:0.98}, html2canvas:{scale:2}, jsPDF:{unit:'pt', format:'a4', orientation:'portrait'} };
        html2pdf().set(opt).from(el).save();
      } else {
        alert('PDF library not loaded');
      }
    });
  }

  // initialize
  updateAroFromSector();
  computeAndRender();
});
