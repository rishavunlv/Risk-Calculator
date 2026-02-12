// Helper to build a simple multi-page PDF (cover + executive summary + report)
// Requires html2pdf (loaded separately).
(function (){
  function createCover(title, subtitle, orgName, dateStr, executiveSummary) {
    const cover = document.createElement('div');
    cover.style.padding = '48px';
    cover.style.display = 'flex';
    cover.style.flexDirection = 'column';
    cover.style.justifyContent = 'center';
    cover.style.alignItems = 'center';
    cover.style.height = '100%';

    const logo = document.createElement('img');
    logo.src = 'assets/logo.svg';
    logo.alt = orgName;
    logo.style.width = '96px';
    logo.style.marginBottom = '18px';
    cover.appendChild(logo);

    const h = document.createElement('h1');
    h.textContent = title;
    h.style.color = getComputedStyle(document.documentElement).getPropertyValue('--rc-primary') || '#1e6fb3';
    h.style.margin = '8px 0';
    cover.appendChild(h);

    const sub = document.createElement('div');
    sub.textContent = subtitle || '';
    sub.style.color = getComputedStyle(document.documentElement).getPropertyValue('--rc-muted') || '#6b7280';
    sub.style.marginBottom = '14px';
    cover.appendChild(sub);

    const meta = document.createElement('div');
    meta.textContent = `${orgName} • ${dateStr}`;
    meta.style.color = '#374151';
    meta.style.marginBottom = '18px';
    cover.appendChild(meta);

    if (executiveSummary) {
      const ex = document.createElement('div');
      ex.innerHTML = `<h3>Executive Summary</h3><div>${executiveSummary}</div>`;
      ex.style.maxWidth = '720px';
      ex.style.marginTop = '12px';
      ex.style.fontSize = '14px';
      cover.appendChild(ex);
    }

    // page break after cover when converted to PDF
    const br = document.createElement('div');
    br.style.pageBreakAfter = 'always';
    cover.appendChild(br);

    return cover;
  }

  // title: string, summary html/text, reportElement: DOM element to include after cover
  window.createPresentationPDF = function (opts) {
    // opts: { title, subtitle, orgName, executiveSummary (HTML), reportElement, filename }
    const title = opts.title || 'Risk Calculator Report';
    const subtitle = opts.subtitle || '';
    const orgName = opts.orgName || 'Risk Calculator';
    const exec = opts.executiveSummary || '';
    const reportEl = opts.reportElement;
    const filename = opts.filename || 'report.pdf';

    if (!reportEl) {
      console.warn('createPresentationPDF: missing reportElement');
      return;
    }

    // Build container
    const container = document.createElement('div');
    container.style.background = 'white';
    container.style.color = '#0f172a';
    container.style.fontFamily = getComputedStyle(document.body).fontFamily || 'sans-serif';
    container.style.padding = '18px';

    const dateStr = new Date().toISOString().slice(0,10);
    const cover = createCover(title, subtitle, orgName, dateStr, exec);
    container.appendChild(cover);

    // Clone the report element and append it
    const clone = reportEl.cloneNode(true);
    // Ensure signature lines show up and nothing is hidden
    clone.style.maxWidth = '720px';
    clone.style.margin = '0 auto';
    container.appendChild(clone);

    // Append to body but keep it off-screen and hidden from layout flow
    container.style.position = 'fixed';
    container.style.left = '-10000px';
    document.body.appendChild(container);

    // Call html2pdf
    if (window.html2pdf) {
      const opt = {
        margin:       14,
        filename:     filename,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'pt', format: 'a4', orientation: 'portrait' }
      };

      return new Promise((resolve, reject) => {
        try {
          html2pdf().set(opt).from(container).save().then(() => {
            document.body.removeChild(container);
            resolve();
          }).catch(err => { document.body.removeChild(container); reject(err); });
        } catch (err) {
          document.body.removeChild(container);
          reject(err);
        }
      });
    } else {
      document.body.removeChild(container);
      return Promise.reject(new Error('html2pdf missing'));
    }
  };

})();
