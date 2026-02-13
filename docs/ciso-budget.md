
# CISO Budget Defense

Use this calculator to compare the cost of a Cold Site (longer recovery) vs a Hot Site (fast recovery) and generate a PDF summary you can share.

<form id="ciso-form">
  <label>Daily revenue (USD): <input type="number" id="dailyRevenue" value="100000" step="0.01" required></label>
  <label>Cold site recovery (days): <input type="number" id="coldDays" value="14" step="1" required></label>
  <label>Hot site fixed cost (USD): <input type="number" id="hotCost" value="50000" step="0.01" required></label>
  <label>Hot site recovery (hours): <input type="number" id="hotHours" value="4" step="0.1" required></label>
  <div style="margin-top:0.6rem">
    <button type="submit">Calculate</button>
    <button type="button" id="download-pdf">Download PDF</button>
  </div>
</form>

<div id="report" aria-label="CISO Budget Report">
  <div class="rc-header">
    <img class="rc-logo" src="assets/logo.svg" alt="Risk Calculator logo">
    <div>
      <div class="rc-org">Risk Calculator</div>
      <div class="rc-sub">CISO Budget Defense — Automated Report</div>
    </div>
  </div>

  <div class="rc-section">
    <h3>Inputs</h3>
    <table class="rc-table" id="inputs-table">
      <!-- Filled by JS -->
    </table>
  </div>

  <div class="rc-section">
    <h3>Results</h3>
    <div id="result-content" class="rc-summary">Enter values and click Calculate to see results.</div>
  </div>

  <div class="rc-section rc-signature">
    <div>
      <div class="line"></div>
      <div class="meta">Signature</div>
    </div>
    <div class="meta" id="report-date">Date: </div>
  </div>
</div>


