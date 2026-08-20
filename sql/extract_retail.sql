-- Reproducible source contract for the licensed Mendeley retail extracts.
select
  cast("Transaction Date" as date) as sale_date,
  "Store" as store,
  "Product No" as product_id,
  "Product Division" as division,
  "Product Category" as category,
  "Sales Channel" as channel,
  cast("Qty Sold" as double) as units,
  cast("Sales Amount" as double) as sales_amount,
  cast("Cogs" as double) as cogs
from read_csv_auto('data/raw/retail/Retail Transactions and Stocks Data/retail_sales_ml_apl.csv', header = true);
