# Metric catalog

| Metric | Grain | Definition |
|---|---|---|
| Net sales | Transaction line | Sum of source sales amount |
| Gross margin | Window | `(sales - COGS) / sales` |
| Average daily demand | Store-product | Units in last 28 source days divided by 28 |
| Target stock | Store-product scenario | 14 days multiplied by average daily demand |
| Reorder quantity | Store-product scenario | Maximum of target minus on-hand and zero |
| Risk status | Store-product | Rules based on on-hand versus 7, 14, and 45 demand days |

Scenario outputs are not purchase orders and require lead time, service level, minimum order, and supplier constraints in production.
