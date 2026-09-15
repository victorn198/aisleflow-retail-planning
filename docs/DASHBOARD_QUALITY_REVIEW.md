# Dashboard quality review

## Decision contract

| Page | Primary question | Main evidence | Intended decision |
| --- | --- | --- | --- |
| Operations Command | What needs attention before replenishment? | Sales pulse, risk positions and priority queue | Assign owners to inventory exceptions |
| Demand Forecast | What demand is expected and how uncertain is it? | Baseline, candidate forecast and error comparison | Use a model only when it beats the baseline |
| Inventory Risk | Where are shortage and excess risks concentrated? | On-hand, target stock, demand and risk class | Prioritize store-SKU review |
| Store & Category Explorer | Which divisions and stores explain the gap? | Contribution, share and prior-period movement | Focus operational investigation |
| Replenishment Simulator | How do assumptions change suggested units? | Lead time, safety stock and demand scenario | Test policy assumptions before approval |
| Data Trust | What is observed versus assumed? | Grain, dates, coverage and model limits | Keep scenarios separate from purchase orders |

## Visual and analytical rules

- KPI cards report period outcomes; exception charts and tables identify where action is needed.
- Bars show the current period and compact reference markers show the comparable prior period.
- Favorable and unfavorable movement uses semantic color, including margin and inventory risk.
- The five-lens lab separates priority, coverage, drivers, variability and scenario analysis.
- Reorder quantities are scenarios because supplier lead time and service-level targets are absent.
- Negative sales remain visible and are treated as possible returns or adjustments, not silently removed.

## Acceptance result

The dashboard passed Python data tests, Vitest component tests, Playwright interaction checks, desktop capture at 1440x900 and mobile capture at 390x844. Forecast claims remain bounded by the source and baseline comparison.
