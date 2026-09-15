# AisleFlow analysis readout

Snapshot: 2025-06-01 to 2026-04-24. The complete marts contain 123,928 sales rows and 50,447 store-product risk rows.

## Executive answer

In the latest 30 days, net sales were USD 659,113, down 37.4% from USD 1,053,127 in the preceding 30 days. Units fell 34.6% and transactions 34.8%, while gross margin remained effectively stable at 41.96% versus 41.84%. The decline is therefore primarily a volume problem in this sample, not a margin-rate collapse.

All divisions declined: Scholar Footwear -39.0%, Femme Footwear -32.9%, and Junior Apparel -40.7%. Scholar Footwear contributed USD 275,829 of the USD 394,014 total decline because it remains the largest division. The number of products with sales also fell from 1,841 to 1,538 (-16.5%), suggesting narrower active assortment alongside lower demand.

Across the full history, Scholar Footwear generates USD 7.34M, 70.0% of modeled sales. This concentration explains why its absolute movement dominates the network result, but the broad decline means it is not the only affected division.

Inventory is the immediate operating risk: 35,724 rows are classified as Excess (70.8%), while 797 are Out of stock and 541 Critical. The risk queue contains negative on-hand values, so those records require inventory reconciliation before a purchase order is issued.

Data-quality note: the sales mart contains negative sales, units, and COGS rows, consistent with possible returns or adjustments but not explicitly documented by the source. Demand features also contain negative values in 114-133 rows. These records must be classified upstream before operational use; they are not silently removed from the historical mart.

## Forecast decision

The moving-average 28-day baseline remains selected. On 270 rolling holdout observations it achieved RMSE 280.01 and WAPE 47.3%, while the linear-trend candidate achieved RMSE 280.84 and WAPE 49.3%. The candidate did not improve the baseline and is not promoted.

## Recommended action sequence

1. Diagnose the broad 30-day volume decline by store, channel, and active assortment before changing margin or pricing policy.
2. Reconcile negative stock and out-of-stock records, starting with the highest reorder quantities.
3. Review Excess inventory separately from service risk; do not use one total to make both decisions.
4. Prioritize Scholar Footwear in absolute-impact analysis while retaining division-specific rates.
5. Use the 28-day moving-average forecast as a planning signal, not as an automatic purchase order.
6. Resolve return/adjustment semantics and negative demand records before setting production replenishment thresholds.

## Limits

Supplier lead time, service levels, minimum order quantities, carrying cost, lost sales, and purchase-order history are absent. Reorder quantities and scenarios therefore require operational confirmation. Sales represent the supplied dataset, not a live retailer.
