from tools.calc import generate_pdf, SECTOR_DATA, compute_sle, compute_expected_annual_breach_cost
from datetime import datetime

report_data = {
    'title': 'CyberRisk ROI — Sample Report',
    'sector': 'Retail',
    'asset': 100000,
    'ef': 100,
    'aro': SECTOR_DATA['Retail'].get('ARO'),
    'sle': compute_sle(100000, 100),
    'ale_pre': 14000,
    'ale_post': 7000,
    'expected_breach': compute_expected_annual_breach_cost(SECTOR_DATA['Retail'].get('AvgBreachCost', 0), SECTOR_DATA['Retail'].get('ARO')),
    'downtime_cold': 200000,
    'downtime_selected': 50000,
    'money_saved_by_bcdr': 150000,
    'cost_controls': 85000,
    'rosi': 0.88,
    'dr_strategy': 'Warm Site',
    'notes': 'Sample report generated for class presentation.'
}

out = 'CyberRisk_ROI_Report_Sample.pdf'
print('Generating sample PDF to', out)
try:
    generate_pdf(report_data, out_path=out)
    print('Wrote:', out)
except Exception as e:
    print('Failed to generate PDF:', e)
