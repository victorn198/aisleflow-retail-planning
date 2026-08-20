select
  store,
  product_id,
  avg_daily_28,
  on_hand,
  target_stock,
  reorder_qty,
  risk_status
from {{ source('raw', 'demand_signal') }}
