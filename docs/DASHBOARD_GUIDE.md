# AisleFlow dashboard guide

## Why this case exists

AisleFlow was built for retail planning teams that must decide where to act before a stockout or overstock becomes visible in financial reporting. The Mendeley dataset was chosen because it combines licensed transaction and stock records across stores, products, categories, divisions, and channels. That creates a realistic grain-reconciliation problem rather than a decorative sales dashboard.

The architecture separates sales from inventory, uses DuckDB and dbt for reproducible transformations, Parquet for compact delivery, and a static React application with browser-side DuckDB-WASM. This keeps the portfolio demo free to host while preserving a credible path to ERP integration.

## Operating workflow

1. Open **Operations Command** at the start of a planning cycle.
2. Filter by **Division**, **Store**, or **Channel**.
3. Use **Demand Forecast** to understand expected volume.
4. Use **Inventory Risk** to distinguish stockout exposure from excess.
5. Use **Store & Category Explorer** to compare peers.
6. Use **Replenishment Simulator** to create a scenario, not a purchase order.
7. Verify assumptions and lineage in **Data Trust**.
8. Use **Restore operating view** to return to the approved baseline.

## Indicator dictionary

| Indicator | Why it was chosen | Calculation and grain | Correct interpretation |
|---|---|---|---|
| Net sales | Measures commercial output | Sum of source sales amount at transaction-line grain | Revenue after source return logic; not cash collected |
| Units sold | Connects value with physical demand | Sum of sold quantity | Demand volume; negative quantities can represent returns |
| Transactions | Measures shopping activity | Sum of source transaction counts | Transaction frequency, not unique customers |
| Gross margin | Adds economic quality to volume | (sales - COGS) / sales | Gross contribution before operating costs |
| Current stock | Establishes supply available now | Latest on-hand quantity by store and product | Snapshot quantity, not network-wide availability |
| Average daily demand | Normalizes recent velocity | Last 28 source days of units / 28 | Planning signal, not a causal forecast |
| Target stock | Makes the service assumption explicit | Average daily demand × 14 cover days | Scenario target, not an official policy |
| Reorder quantity | Translates the gap into a candidate action | max(target stock - on hand, 0) | Suggested scenario units before supplier constraints |
| At-risk positions | Prioritizes exceptions | Count of store-product rows classified out of stock, critical, or low stock | Number of positions, not number of products |
| Risk status | Converts cover into an operating state | Out of stock; below 7 days critical; below 14 low; above 45 excess; otherwise healthy | Rule-based triage |
| Stores / Products / Rows modeled | Exposes scope | Distinct stores, products, and source records | Data coverage only |
| Coverage days | Exposes historical depth | Maximum date - minimum date + 1 | Horizon available for validation |

Card comparisons use the previous non-overlapping half-window. For risk metrics, a decrease is favorable; for sales, units, transactions, and margin, an increase is favorable.

## Page-by-page reference

### 1. Operations Command

**Purpose:** answer what needs attention before the next replenishment cycle.

- **KPI row:** net sales, units, transactions, gross margin, and at-risk positions balance demand, value, economics, and exception load.
- **Sales pulse:** detects spikes, seasonality, returns, or operational breaks hidden by totals.
- **Division contribution:** shows which divisions explain current value and therefore where planning effort has the largest exposure.
- **Priority queue:** lists product, store, division, on-hand, target, reorder quantity, and status. It is the action surface.
- **Action:** start with out-of-stock and critical rows, then validate lead time and supplier constraints.

### 2. Demand Forecast

**Purpose:** estimate the volume operations should prepare for over the next 28 days.

- **KPI row:** recent sales, units, transactions, and margin provide planning context.
- **28-day baseline forecast:** extends the recent moving average because it is transparent and won the rolling-origin comparison against the linear-trend candidate.
- **Demand by division:** identifies where expected volume is concentrated.
- **Forecast context:** shows category-level evidence supporting the forecast.
- **Model governance:** the candidate replaces the baseline only if temporal RMSE improves by at least 5%. The evaluation artifact is public/data/forecast_evaluation.json.
- **Action:** use the forecast as a range input; do not order from a point estimate alone.

### 3. Inventory Risk

**Purpose:** identify where insufficient or excessive cover can harm service or working capital.

- **KPI row:** sales and units establish demand; current stock establishes supply; at-risk positions quantify exceptions.
- **Demand and stock signal:** shows whether exposure follows a persistent or isolated demand movement.
- **Exposure by division:** locates concentrations of operational risk.
- **Risk detail:** contains the store-product evidence and its computed state.
- **Action:** separate genuine fast-moving shortages from slow-moving and excess items.

### 4. Store & Category Explorer

**Purpose:** explain performance gaps across the network.

- **KPI row:** sales, units, transactions, and margin prevent a one-dimensional store ranking.
- **Network sales:** displays time behavior for the selected peer group.
- **Store contribution:** ranks stores under the active context.
- **Category detail:** exposes category values behind the comparison.
- **Action:** compare equivalent store-category peers instead of imposing one target on the entire network.

### 5. Replenishment Simulator

**Purpose:** turn demand and stock evidence into a transparent scenario.

- **Current stock:** available quantity.
- **At-risk positions:** size of the exception queue.
- **Suggested units:** sum of positive gaps between 14-day target and on-hand.
- **Net sales:** commercial exposure attached to the scenario.
- **Expected demand:** planning trajectory behind suggested quantities.
- **Channel demand:** shows where demand is generated.
- **Replenishment candidates:** lists the proposed rows and all supporting inputs.
- **Action:** confirm lead time, minimum order quantity, service level, supplier capacity, and budget before execution.

### 6. Data Trust

**Purpose:** make the operational recommendation auditable.

- **Rows modeled, stores, products, and coverage days:** document scope.
- **Source volume:** exposes gaps and abnormal days.
- **Hierarchy coverage:** checks whether divisions and categories are represented.
- **Quality evidence:** provides the rows behind rule validation.
- **DuckDB-WASM verification:** proves the published Parquet mart can be read independently in the browser.
- **Action:** reject or qualify a scenario when store-product keys, inventory dates, or assumptions are incomplete.

## Why the visual design is denser

Retail planning is an exception-management workflow. The interface uses compact cards, a persistent filter row, high-information tables, restrained green accents, and explicit operating states. The design prioritizes scanning and repeated action over marketing-style presentation.

## What the dashboard does not claim

Supplier lead time, service level, minimum order, purchase-order constraints, lost sales, and carrying cost are absent. Replenishment values are scenarios, forecast performance is historical, and no recommendation should be executed without operational confirmation.

