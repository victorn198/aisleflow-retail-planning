# Data model

Sales remain at transaction-product-store-date grain. Inventory is reduced to the latest source record per store-product. Demand signals join only after each fact is aggregated to store-product. This prevents sales multiplication and makes each scenario auditable.
