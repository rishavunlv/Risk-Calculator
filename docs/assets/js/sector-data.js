// SECTOR_DATA is the authoritative data source for ARO, AvgBreachCost, and DowntimeCostPerHour
window.SECTOR_DATA = {
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
};

window.DR_STRATEGIES = {
  "Cold Site": {"recovery_time_hours": 336, "annual_cost": 10000},
  "Warm Site": {"recovery_time_hours": 48,  "annual_cost": 50000},
  "Hot Site":  {"recovery_time_hours": 4,   "annual_cost": 150000}
};

// Example control costs (annualized or one-off approximations)
// Realistic default control costs (you can adjust these values)
window.CONTROL_COSTS = {
  "mfa": 25000,      // Multi-Factor Auth (annualized deployment + licensing)
  "phish": 7500,     // Staff Phishing Training (annual program)
  "succession": 5000 // Succession Planning (procedures, exercises)
};
