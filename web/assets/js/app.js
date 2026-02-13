// Simple client-side logic mirroring Python logic. Uses Chart.js and html2pdf for PDF export.
const SECTOR_DATA = {
  "Healthcare": {"ARO":0.59, "AvgBreachCost":9770000, "DowntimeCostPerHour":300000},
  "Finance": {"ARO":0.20, "AvgBreachCost":6080000, "DowntimeCostPerHour":5600000},
  "Retail": {"ARO":0.14, "AvgBreachCost":2500000, "DowntimeCostPerHour":200000},
  "Manufacturing": {"ARO":0.62, "AvgBreachCost":4800000, "DowntimeCostPerHour":2300000}
};

const DR_STRATEGIES = {
  'Cold Site': {recovery_time_hours:336, annual_cost:10000},
  'Warm Site': {recovery_time_hours:48, annual_cost:50000},
  'Hot Site': {recovery_time_hours:4, annual_cost:150000}
};

const CONTROL_COSTS = {mfa:25000, phish:7500, succession:5000};

// helpers
function fmt(n){return '$' + Number(n).toLocaleString(undefined, {maximumFractionDigits:0})}
function pct(n){return (Number(n)*100).toFixed(1)+'%'}

function compute_sle(asset, ef){ return asset * (Math.max(0, Math.min(ef,100))/100.0); }
function compute_ale_pre(sector, loss_mag, ef){ return loss_mag * (Math.max(0, Math.min(ef,100))/100.0) * SECTOR_DATA[sector].ARO; }
function compute_ale_post(sector, loss_mag, ef, mfa=false, phish=false){ let reduced = SECTOR_DATA[sector].ARO; if(mfa) reduced *= 0.5; if(phish) reduced *= 0.8; return loss_mag * (Math.max(0, Math.min(ef,100))/100.0) * reduced; }
function compute_downtime_loss(sector, strategy, succession=false){ let perHour = SECTOR_DATA[sector].DowntimeCostPerHour; if(succession) perHour *= 0.9; return perHour * DR_STRATEGIES[strategy].recovery_time_hours; }
function compute_rosi(ale_pre, ale_post, avoided, cost){ if(cost===0) return Infinity; return ((ale_pre - ale_post) + avoided - cost) / cost; }

// UI bindings
const sectorEl = document.getElementById('sector');
const assetEl = document.getElementById('asset');
const efEl = document.getElementById('ef');
const efVal = document.getElementById('efVal');
const downloadBtn = document.getElementById('downloadPdf');
const computeBtn = document.getElementById('compute');
const alePreEl = document.getElementById('alePre');
const alePostEl = document.getElementById('alePost');
const rensiEl = document.getElementById('rosi');
const moneySavedEl = document.getElementById('moneySaved');
const reportTsEl = document.getElementById('reportTs');

let chart=null;
function updateChart(pre, post){
  const ctx = document.getElementById('aleChart').getContext('2d');
  if(chart) chart.destroy();
  const config = {
    type: 'bar',
    data: {labels:['ALE Pre','ALE Post'], datasets:[{label:'USD', data:[pre, post], backgroundColor:['#60a5fa','#93c5fd']}]},
    options: {
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value){
              if (value >= 1000000) return (value/1000000) + 'M';
              if (value >= 1000) return (value/1000) + 'k';
              return value;
            }
          }
        }
      }
    }
  };
  chart = new Chart(ctx, config);
}

function computeAll(){
  const sector = sectorEl.value;
  const asset = Number(assetEl.value) || 0;
  const ef = Number(efEl.value)||0;
  const mfa = document.getElementById('mfa').checked;
  const phish = document.getElementById('phish').checked;
  const succession = document.getElementById('succession').checked;
  const includeDr = document.getElementById('includeDr').checked;
  const strategy = document.querySelector('input[name="strategy"]:checked').value;

  const lossMag = SECTOR_DATA[sector].AvgBreachCost || asset;
  const sle = compute_sle(asset, ef);
  const alePre = compute_ale_pre(sector, lossMag, ef);
  const alePost = compute_ale_post(sector, lossMag, ef, mfa, phish);
  const downtimeCold = compute_downtime_loss(sector, 'Cold Site', false);
  const downtimeSelected = compute_downtime_loss(sector, strategy, succession);
  const moneySaved = Math.max(0, downtimeCold - downtimeSelected);

  let costControls = DR_STRATEGIES[strategy].annual_cost;
  if(mfa) costControls += CONTROL_COSTS.mfa;
  if(phish) costControls += CONTROL_COSTS.phish;
  if(succession) costControls += CONTROL_COSTS.succession;

  const rosiCost = includeDr ? costControls : (costControls - DR_STRATEGIES[strategy].annual_cost);
  const rosi = compute_rosi(alePre, alePost, moneySaved, rosiCost);

  alePreEl.textContent = fmt(alePre);
  alePostEl.textContent = fmt(alePost);
  rensiEl.innerHTML = (rosi===Infinity)? 'inf' : `<span style="color:#0a8a0a;font-weight:700">${(rosi*100).toFixed(1)}%</span>`;
  moneySavedEl.textContent = fmt(moneySaved);
  moneySavedEl.style.color = '#0a8a0a';
  reportTsEl.textContent = new Date().toISOString().replace('T',' ').replace('Z',' UTC');

  updateChart(alePre, alePost);

  // return data for PDF
  return {sector, asset, ef, sle, alePre, alePost, downtimeCold, downtimeSelected, moneySaved, costControls, rosi, strategy};
}

// wire up events
efEl.addEventListener('input', ()=>{efVal.textContent = efEl.value;});
computeBtn.addEventListener('click', ()=>{computeAll();});

downloadBtn.addEventListener('click', async ()=>{
  const data = computeAll();
  // fill timestamp
  const ts = new Date().toISOString().replace('T',' ').replace('Z',' UTC');
  document.getElementById('reportTs').textContent = ts;

  // Create a lightweight printable clone to ensure consistent PDF layout
  const reportEl = document.getElementById('reportArea');
  const opt = {
    margin: 0.4,
    filename: `CyberRisk_ROI_Report_${new Date().toISOString().split('T')[0]}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
  };

  // smooth scroll into view so charts render correctly
  reportEl.scrollIntoView();
  // allow chart to settle, then call html2pdf
  setTimeout(()=>{
    html2pdf().set(opt).from(reportEl).save();
  }, 300);
});

// initial compute
computeAll();
