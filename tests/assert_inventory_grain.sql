select store, product_id, count(*) as row_count
from {{ ref('mart_inventory_risk') }}
group by 1, 2
having count(*) > 1
