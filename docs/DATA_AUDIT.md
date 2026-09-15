# AisleFlow data audit

Reviewed 2026-09-14. The marts pass declared-grain and completeness checks, but operational use remains conditional.

| Check | Result |
|---|---:|
| Sales rows | 123,928 |
| Sales coverage | 2025-06-01 to 2026-04-24, 326 days |
| Inventory risk rows | 50,447 |
| Sales duplicate excess at declared grain | 0 |
| Inventory duplicate excess at store-product grain | 0 |
| Critical identity/date nulls | 0 |
| Sales rows with negative sales/units/COGS | 5,827 |
| Risk rows with negative demand features | 257 |

Negative sales may represent returns or adjustments, but the source does not provide a complete semantic flag. Negative demand features are not valid for an operational forecast without upstream classification. The dashboard preserves the supplied history and exposes this limitation; it does not convert the values into a purchase order.

The forecast comparison is temporal: the 28-day moving average has RMSE 280.01 and WAPE 47.3%, versus RMSE 280.84 and WAPE 49.3% for the linear trend candidate across 270 holdout observations. The baseline remains selected.
