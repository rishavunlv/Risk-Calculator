#!/usr/bin/env python3
"""
Simple CLI utility: Cyber-Risk ROI & BCDR Calculator
This uses the same SECTOR_DATA as the website and computes SLE, ALE, and expected annual breach cost.

Usage:
  python tools/calc.py --sector Retail --asset 100000 --ef 100

It prints a short report and example Hot Site ROI calculation.
"""
import argparse
import json
from datetime import datetime
from io import BytesIO
try:
    # reportlab is optional for PDF export; listed in requirements.txt
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib import colors
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    REPORTLAB_AVAILABLE = True
except Exception:
    REPORTLAB_AVAILABLE = False

SECTOR_DATA = {
    "Healthcare": {
        "ARO": 0.59,
        "AvgBreachCost": 9770000,
        "DowntimeCostPerHour": 300000
    },
    "Finance": {
        "ARO": 0.20,
        "AvgBreachCost": 6080000,
        "DowntimeCostPerHour": 5600000
    },
    "Retail": {
        "ARO": 0.14,
        "AvgBreachCost": 2500000,
        "DowntimeCostPerHour": 200000
    },
    "Manufacturing": {
        "ARO": 0.62,
        "AvgBreachCost": 4800000,
        "DowntimeCostPerHour": 2300000
    }
}

DR_STRATEGIES = {
    "Cold Site": {"recovery_time_hours": 336, "annual_cost": 10000},
    "Warm Site": {"recovery_time_hours": 48, "annual_cost": 50000},
    "Hot Site": {"recovery_time_hours": 4, "annual_cost": 150000}
}

CONTROL_COSTS = {"mfa": 20000, "phish": 5000, "succession": 3000}
# Update default control costs to match UI defaults
CONTROL_COSTS = {"mfa": 25000, "phish": 7500, "succession": 5000}


def fmt(n):
    return f"${n:,.2f}"


def compute_sle(asset_value, ef_percent):
    return asset_value * (max(0, min(ef_percent, 100)) / 100.0)


def compute_ale(sle, aro):
    return sle * aro


def compute_expected_annual_breach_cost(avg_breach_cost, aro):
    return avg_breach_cost * aro


def hot_site_roi(daily_revenue, cold_days, hot_fixed_cost, hot_hours):
    cold_loss = daily_revenue * cold_days
    hot_revenue_loss = daily_revenue * (hot_hours / 24.0)
    hot_total = hot_fixed_cost + hot_revenue_loss
    benefit = cold_loss - hot_total
    roi_pct = (benefit / hot_total) * 100 if hot_total > 0 else float('inf')
    return {
        'cold_loss': cold_loss,
        'hot_revenue_loss': hot_revenue_loss,
        'hot_total': hot_total,
        'benefit': benefit,
        'roi_pct': roi_pct
    }


def generate_pdf(report_data, out_path='risk_report.pdf'):
    """
    Generate a PDF report from report_data dict and write to out_path.

    report_data should include keys (example):
      - title
      - sector, asset, ef, aro
      - sle, ale_pre, ale_post, expected_breach
      - downtime_cold, downtime_selected, money_saved_by_bcdr
      - cost_controls, rosi
      - notes / narrative (optional)

    This function uses reportlab to produce a clean single-file PDF with:
      - Title, inputs table, computed values
      - Money Saved highlighted in green
      - Methodology & References section (hardcoded per Dr. Kim's request)
      - Footer with generation timestamp

    If reportlab is not installed, raises ImportError.
    """
    if not REPORTLAB_AVAILABLE:
        raise ImportError('reportlab library is required for PDF generation. Install with: pip install reportlab')

    # Register a basic TrueType font for consistent rendering (optional)
    try:
        pdfmetrics.registerFont(TTFont('DejaVuSans', 'DejaVuSans.ttf'))
        base_font = 'DejaVuSans'
    except Exception:
        base_font = 'Helvetica'

    buffer = BytesIO()
    doc = SimpleDocTemplate(out_path, pagesize=letter,
                            rightMargin=72, leftMargin=72,
                            topMargin=72, bottomMargin=72)
    styles = getSampleStyleSheet()
    normal = styles['Normal']
    heading = styles['Heading1']
    heading.alignment = 1  # center

    # Custom paragraph style for green money-saved metric
    green_style = ParagraphStyle('Green', parent=normal, textColor=colors.HexColor('#0a8a0a'), fontName=base_font)

    story = []

    # Title
    title_text = report_data.get('title', 'Cyber-Risk ROI & BCDR Report')
    story.append(Paragraph(title_text, heading))
    story.append(Spacer(1, 0.15 * inch))

    # Timestamp
    gen_ts = datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')
    story.append(Paragraph(f'Report Generated: {gen_ts}', normal))
    story.append(Spacer(1, 0.2 * inch))

    # Inputs / Configuration table
    inputs = [
        ['Sector', report_data.get('sector', '')],
        ['Asset value', fmt(report_data.get('asset', 0))],
        ['Exposure Factor (EF)', f"{report_data.get('ef', 0)}%"],
        ['ARO', report_data.get('aro', '')],
        ['Selected DR Strategy', report_data.get('dr_strategy', '')]
    ]
    t = Table(inputs, hAlign='LEFT', colWidths=[2.5 * inch, 3.5 * inch])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('INNERGRID', (0, 0), (-1, -1), 0.25, colors.grey),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.grey),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.2 * inch))

    # Computed values
    comps = [
        ['SLE', fmt(report_data.get('sle', 0))],
        ['ALE (pre-controls)', fmt(report_data.get('ale_pre', 0))],
        ['ALE (post-controls)', fmt(report_data.get('ale_post', 0))],
        ['Expected Annual Breach Cost', fmt(report_data.get('expected_breach', 0))]
    ]
    ct = Table(comps, hAlign='LEFT', colWidths=[2.5 * inch, 3.5 * inch])
    ct.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('INNERGRID', (0, 0), (-1, -1), 0.25, colors.grey),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.grey),
    ]))
    story.append(ct)
    story.append(Spacer(1, 0.2 * inch))

    # Downtime / Money Saved
    ms_value = report_data.get('money_saved_by_bcdr', 0)
    story.append(Paragraph('Downtime & BCDR', styles['Heading2']))
    story.append(Spacer(1, 0.05 * inch))
    downtime_items = [
        ['Downtime loss (Cold)', fmt(report_data.get('downtime_cold', 0))],
        ['Downtime loss (Selected)', fmt(report_data.get('downtime_selected', 0))]
    ]
    dt = Table(downtime_items, hAlign='LEFT', colWidths=[2.5 * inch, 3.5 * inch])
    dt.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('INNERGRID', (0, 0), (-1, -1), 0.25, colors.grey),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.grey),
    ]))
    story.append(dt)
    story.append(Spacer(1, 0.1 * inch))

    # Money Saved — highlighted green
    story.append(Paragraph(f"Money saved by BCDR: {fmt(ms_value)}", green_style))
    story.append(Spacer(1, 0.1 * inch))

    # Controls & ROSI
    story.append(Paragraph('Controls & ROSI', styles['Heading2']))
    story.append(Spacer(1, 0.05 * inch))
    controls_items = [
        ['Cost of controls (annual)', fmt(report_data.get('cost_controls', 0))],
        ['ROSI', (f"{report_data.get('rosi', 0)*100:.1f}%" if isinstance(report_data.get('rosi', 0), (int, float)) and report_data.get('rosi', None) not in [None, float('inf')] else 'inf')]
    ]
    ct2 = Table(controls_items, hAlign='LEFT', colWidths=[2.5 * inch, 3.5 * inch])
    ct2.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('INNERGRID', (0, 0), (-1, -1), 0.25, colors.grey),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.grey),
    ]))
    story.append(ct2)
    story.append(Spacer(1, 0.2 * inch))

    # Methodology Section (hardcoded per Dr. Kim)
    story.append(Paragraph('Methodology', styles['Heading2']))
    methodology_text = (
        'This economic model utilizes the Gordon-Loeb Framework for cybersecurity investment analysis.\n\n'
        'ALE Calculation: Derived from standard quantitative risk assessment formulas (ALE=SLE×ARO) as defined in CS443 lecture materials.\n\n'
        'BCDR Impact: Downtime costs are calculated based on recovery time objectives (RTO) for Hot/Warm/Cold sites.'
    )
    story.append(Paragraph(methodology_text.replace('\n', '<br/>'), normal))
    story.append(Spacer(1, 0.2 * inch))

    # References Section (hardcoded)
    story.append(Paragraph('References', styles['Heading2']))
    refs = [
        'Gordon, L. A., & Loeb, M. P. (2002). "The economics of information security investment." ACM Transactions on Information and System Security (TISSEC).',
        'Verizon. (2024). "2024 Data Breach Investigations Report (DBIR)."',
        'IBM Security. (2024). "Cost of a Data Breach Report 2024."'
    ]
    for r in refs:
        story.append(Paragraph(r, normal))
        story.append(Spacer(1, 0.05 * inch))

    # Optional narrative/notes
    if report_data.get('notes'):
        story.append(Spacer(1, 0.15 * inch))
        story.append(Paragraph('Notes', styles['Heading2']))
        story.append(Paragraph(report_data.get('notes'), normal))

    # Footer callback to add timestamp on each page
    def _footer(canvas, doc):
        footer_text = f"Report Generated: {gen_ts}"
        canvas.saveState()
        canvas.setFont(base_font, 8)
        width, height = letter
        canvas.drawString(doc.leftMargin, 0.65 * inch, footer_text)
        canvas.restoreState()

    # Build PDF
    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)

    return out_path


def generate_pdf_bytes(report_data):
    """
    Generate a PDF in-memory and return bytes. Same content as generate_pdf, but does not write to disk.
    """
    if not REPORTLAB_AVAILABLE:
        raise ImportError('reportlab library is required for PDF generation. Install with: pip install reportlab')

    # Register a basic TrueType font for consistent rendering (optional)
    try:
        pdfmetrics.registerFont(TTFont('DejaVuSans', 'DejaVuSans.ttf'))
        base_font = 'DejaVuSans'
    except Exception:
        base_font = 'Helvetica'

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter,
                            rightMargin=72, leftMargin=72,
                            topMargin=72, bottomMargin=72)
    styles = getSampleStyleSheet()
    normal = styles['Normal']
    heading = styles['Heading1']
    heading.alignment = 1  # center

    # Custom paragraph style for green money-saved metric
    green_style = ParagraphStyle('Green', parent=normal, textColor=colors.HexColor('#0a8a0a'), fontName=base_font)

    story = []

    # Title
    title_text = report_data.get('title', 'Cyber-Risk ROI & BCDR Report')
    story.append(Paragraph(title_text, heading))
    story.append(Spacer(1, 0.15 * inch))

    # Timestamp
    gen_ts = datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')
    story.append(Paragraph(f'Report Generated: {gen_ts}', normal))
    story.append(Spacer(1, 0.2 * inch))

    # Inputs / Configuration table
    inputs = [
        ['Sector', report_data.get('sector', '')],
        ['Asset value', fmt(report_data.get('asset', 0))],
        ['Exposure Factor (EF)', f"{report_data.get('ef', 0)}%"],
        ['ARO', report_data.get('aro', '')],
        ['Selected DR Strategy', report_data.get('dr_strategy', '')]
    ]
    t = Table(inputs, hAlign='LEFT', colWidths=[2.5 * inch, 3.5 * inch])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('INNERGRID', (0, 0), (-1, -1), 0.25, colors.grey),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.grey),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.2 * inch))

    # Computed values
    comps = [
        ['SLE', fmt(report_data.get('sle', 0))],
        ['ALE (pre-controls)', fmt(report_data.get('ale_pre', 0))],
        ['ALE (post-controls)', fmt(report_data.get('ale_post', 0))],
        ['Expected Annual Breach Cost', fmt(report_data.get('expected_breach', 0))]
    ]
    ct = Table(comps, hAlign='LEFT', colWidths=[2.5 * inch, 3.5 * inch])
    ct.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('INNERGRID', (0, 0), (-1, -1), 0.25, colors.grey),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.grey),
    ]))
    story.append(ct)
    story.append(Spacer(1, 0.2 * inch))

    # Downtime / Money Saved
    ms_value = report_data.get('money_saved_by_bcdr', 0)
    story.append(Paragraph('Downtime & BCDR', styles['Heading2']))
    story.append(Spacer(1, 0.05 * inch))
    downtime_items = [
        ['Downtime loss (Cold)', fmt(report_data.get('downtime_cold', 0))],
        ['Downtime loss (Selected)', fmt(report_data.get('downtime_selected', 0))]
    ]
    dt = Table(downtime_items, hAlign='LEFT', colWidths=[2.5 * inch, 3.5 * inch])
    dt.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('INNERGRID', (0, 0), (-1, -1), 0.25, colors.grey),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.grey),
    ]))
    story.append(dt)
    story.append(Spacer(1, 0.1 * inch))

    # Money Saved — highlighted green
    story.append(Paragraph(f"Money saved by BCDR: {fmt(ms_value)}", green_style))
    story.append(Spacer(1, 0.1 * inch))

    # Controls & ROSI
    story.append(Paragraph('Controls & ROSI', styles['Heading2']))
    story.append(Spacer(1, 0.05 * inch))
    controls_items = [
        ['Cost of controls (annual)', fmt(report_data.get('cost_controls', 0))],
        ['ROSI', (f"{report_data.get('rosi', 0)*100:.1f}%" if isinstance(report_data.get('rosi', 0), (int, float)) and report_data.get('rosi', None) not in [None, float('inf')] else 'inf')]
    ]
    ct2 = Table(controls_items, hAlign='LEFT', colWidths=[2.5 * inch, 3.5 * inch])
    ct2.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('INNERGRID', (0, 0), (-1, -1), 0.25, colors.grey),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.grey),
    ]))
    story.append(ct2)
    story.append(Spacer(1, 0.2 * inch))

    # Methodology Section (hardcoded per Dr. Kim)
    story.append(Paragraph('Methodology', styles['Heading2']))
    methodology_text = (
        'This economic model utilizes the Gordon-Loeb Framework for cybersecurity investment analysis.\n\n'
        'ALE Calculation: Derived from standard quantitative risk assessment formulas (ALE=SLE×ARO) as defined in CS443 lecture materials.\n\n'
        'BCDR Impact: Downtime costs are calculated based on recovery time objectives (RTO) for Hot/Warm/Cold sites.'
    )
    story.append(Paragraph(methodology_text.replace('\n', '<br/>'), normal))
    story.append(Spacer(1, 0.2 * inch))

    # References Section (hardcoded)
    story.append(Paragraph('References', styles['Heading2']))
    refs = [
        'Gordon, L. A., & Loeb, M. P. (2002). "The economics of information security investment." ACM Transactions on Information and System Security (TISSEC).',
        'Verizon. (2024). "2024 Data Breach Investigations Report (DBIR)."',
        'IBM Security. (2024). "Cost of a Data Breach Report 2024."'
    ]
    for r in refs:
        story.append(Paragraph(r, normal))
        story.append(Spacer(1, 0.05 * inch))

    # Optional narrative/notes
    if report_data.get('notes'):
        story.append(Spacer(1, 0.15 * inch))
        story.append(Paragraph('Notes', styles['Heading2']))
        story.append(Paragraph(report_data.get('notes'), normal))

    # Footer callback to add timestamp on each page
    def _footer(canvas, doc):
        footer_text = f"Report Generated: {gen_ts}"
        canvas.saveState()
        canvas.setFont(base_font, 8)
        width, height = letter
        canvas.drawString(doc.leftMargin, 0.65 * inch, footer_text)
        canvas.restoreState()

    # Build PDF into buffer
    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
    buffer.seek(0)
    data = buffer.getvalue()
    buffer.close()
    return data


def compute_ale_pre(sector, loss_magnitude, ef_percent):
    sectorARO = SECTOR_DATA[sector]['ARO']
    ef = max(0, min(ef_percent, 100)) / 100.0
    return loss_magnitude * ef * sectorARO


def compute_ale_post(sector, loss_magnitude, ef_percent, mfa=False, phish=False):
    # apply ARO reductions
    sectorARO = SECTOR_DATA[sector]['ARO']
    reduced = sectorARO
    if mfa:
        reduced = reduced * 0.5
    if phish:
        reduced = reduced * 0.8
    ef = max(0, min(ef_percent, 100)) / 100.0
    return loss_magnitude * ef * reduced


def compute_downtime_loss(sector, strategy_name, succession=False):
    s = SECTOR_DATA[sector]
    downtime_per_hour = s.get('DowntimeCostPerHour', 0)
    if succession:
        downtime_per_hour = downtime_per_hour * 0.9
    strategy = DR_STRATEGIES.get(strategy_name, DR_STRATEGIES['Cold Site'])
    return downtime_per_hour * strategy['recovery_time_hours']


def compute_rosi(ale_pre, ale_post, avoided_downtime_loss, cost_of_controls):
    if cost_of_controls == 0:
        return float('inf')
    return ((ale_pre - ale_post) + avoided_downtime_loss - cost_of_controls) / cost_of_controls


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--sector', default='Retail', choices=list(SECTOR_DATA.keys()))
    p.add_argument('--asset', type=float, default=100000)
    p.add_argument('--ef', type=float, default=100)
    p.add_argument('--aro', type=float, default=None, help='Override sector ARO')
    p.add_argument('--daily', type=float, default=100000, help='Daily revenue used for Hot Site ROI example')
    p.add_argument('--cold-days', type=float, default=14, help='Cold site days for ROI example')
    p.add_argument('--hot-cost', type=float, default=50000, help='Hot site fixed cost for ROI example')
    p.add_argument('--hot-hours', type=float, default=4, help='Hot site recovery hours for ROI example')
    p.add_argument('--dr-strategy', choices=list(DR_STRATEGIES.keys()), default='Cold Site', help='Select DR strategy')
    p.add_argument('--mfa', action='store_true', help='Enable Multi-Factor Auth (reduce ARO 50%)')
    p.add_argument('--phish', action='store_true', help='Enable Phishing training (reduce ARO 20%)')
    p.add_argument('--succession', action='store_true', help='Enable Succession planning (reduce downtime cost 10%)')
    p.add_argument('--revenue', type=float, default=None, help='Optional revenue value to use instead of sector avg breach cost')
    p.add_argument('--pdf', type=str, default=None, help='If provided, write a PDF report to this path')
    args = p.parse_args()

    sector = args.sector
    data = SECTOR_DATA[sector]
    aro = args.aro if args.aro is not None else data['ARO']

    sle = compute_sle(args.asset, args.ef)
    # loss magnitude: user revenue if provided else sector avg breach cost
    loss_magnitude = args.revenue if args.revenue is not None else data.get('AvgBreachCost', args.asset)

    ale_pre = compute_ale_pre(sector, loss_magnitude, args.ef)
    ale_post = compute_ale_post(sector, loss_magnitude, args.ef, mfa=args.mfa, phish=args.phish)
    expected_breach = compute_expected_annual_breach_cost(data['AvgBreachCost'], aro)

    # Downtime losses
    downtime_cold = compute_downtime_loss(sector, 'Cold Site', succession=False)
    downtime_selected = compute_downtime_loss(sector, args.dr_strategy, succession=args.succession)
    money_saved_by_bcdr = max(0, downtime_cold - downtime_selected)

    # cost of controls includes DR strategy annual cost + selected control costs
    cost_controls = DR_STRATEGIES.get(args.dr_strategy, DR_STRATEGIES['Cold Site'])['annual_cost']
    if args.mfa:
        cost_controls += CONTROL_COSTS['mfa']
    if args.phish:
        cost_controls += CONTROL_COSTS['phish']
    if args.succession:
        cost_controls += CONTROL_COSTS['succession']

    rosi = compute_rosi(ale_pre, ale_post, money_saved_by_bcdr, cost_controls)

    print('\nCyber-Risk ROI & BCDR Calculator — Report')
    print('Generated:', datetime.utcnow().isoformat())
    print('Sector:', sector)
    print('Asset value:', fmt(args.asset))
    print('Exposure Factor (EF):', f"{args.ef}%")
    print('ARO (sector):', SECTOR_DATA[sector]['ARO'])
    print('\nComputed Values:')
    print('  SLE:', fmt(sle))
    print('  ALE (pre):', fmt(ale_pre))
    print('  ALE (post):', fmt(ale_post))
    print('  Expected Annual Breach Cost (AvgBreachCost * ARO):', fmt(expected_breach))

    print('\nDowntime & ROSI:')
    print('  Downtime loss (Cold):', fmt(downtime_cold))
    print('  Downtime loss (Selected):', fmt(downtime_selected))
    print('  Money saved by BCDR:', fmt(money_saved_by_bcdr))
    print('  Cost of controls (DR + selected controls):', fmt(cost_controls))
    print('  ROSI:', (f"{rosi*100:.1f}%" if rosi != float('inf') else 'inf'))

    print('\nHot Site ROI example (defaults can be overridden):')
    r = hot_site_roi(args.daily, args.cold_days, args.hot_cost, args.hot_hours)
    print('  Cold site loss:', fmt(r['cold_loss']))
    print('  Hot site revenue loss during recovery:', fmt(r['hot_revenue_loss']))
    print('  Hot site total cost:', fmt(r['hot_total']))
    print('  Avoided loss (Cold - Hot):', fmt(r['benefit']))
    print('  ROI %:', f"{r['roi_pct']:.1f}%")

    # If requested, produce a PDF using the same data
    if args.pdf:
        report_data = {
            'title': 'Cyber-Risk ROI & BCDR Report',
            'sector': sector,
            'asset': args.asset,
            'ef': args.ef,
            'aro': aro,
            'sle': sle,
            'ale_pre': ale_pre,
            'ale_post': ale_post,
            'expected_breach': expected_breach,
            'downtime_cold': downtime_cold,
            'downtime_selected': downtime_selected,
            'money_saved_by_bcdr': money_saved_by_bcdr,
            'cost_controls': cost_controls,
            'rosi': rosi,
            'dr_strategy': args.dr_strategy,
            'notes': 'Generated by tools/calc.py command-line interface.'
        }
        try:
            out = generate_pdf(report_data, out_path=args.pdf)
            print(f'Wrote PDF report to: {out}')
        except Exception as e:
            print('Failed to write PDF:', e)


if __name__ == '__main__':
    main()
