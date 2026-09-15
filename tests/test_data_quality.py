import json
from pathlib import Path

import duckdb


ROOT = Path(__file__).resolve().parents[1]
SALES = ROOT / "public/data/mart_sales_daily.parquet"
RISK = ROOT / "public/data/mart_inventory_risk.parquet"


def test_declared_grains_are_unique_and_keys_complete():
    con = duckdb.connect()
    sales = con.execute("""select count(*), count(distinct (sale_date,division,store,channel,product_id)),
        count(*) filter(where sale_date is null or division is null or store is null or product_id is null)
        from read_parquet(?)""", [str(SALES)]).fetchone()
    risk = con.execute("""select count(*), count(distinct (store,product_id)),
        count(*) filter(where store is null or product_id is null or division is null)
        from read_parquet(?)""", [str(RISK)]).fetchone()
    assert sales[0] == sales[1] and sales[2] == 0
    assert risk[0] == risk[1] and risk[2] == 0


def test_dashboard_scope_matches_published_sales_mart():
    dashboard = json.loads((ROOT / "public/data/dashboard.json").read_text(encoding="utf-8"))
    rows = duckdb.connect().execute("select count(*) from read_parquet(?)", [str(SALES)]).fetchone()[0]
    assert dashboard["meta"]["rows"] == rows


def test_forecast_selection_uses_temporal_holdout_and_measurable_gain():
    evaluation = json.loads((ROOT / "public/data/forecast_evaluation.json").read_text(encoding="utf-8"))
    assert evaluation["split"] == "rolling_origin"
    assert evaluation["holdout_observations"] > 0
    assert evaluation["selected_model"] == "moving_average_28d"
    assert evaluation["candidate"]["rmse"] >= evaluation["baseline"]["rmse"]


def test_negative_value_semantics_are_visible_not_silently_discarded():
    con = duckdb.connect()
    negative_sales = con.execute("""select count(*) from read_parquet(?)
        where sales_amount<0 or units<0 or cogs<0""", [str(SALES)]).fetchone()[0]
    negative_demand = con.execute("""select count(*) from read_parquet(?)
        where avg_daily_28<0 or avg_daily_prev<0 or sales_28<0""", [str(RISK)]).fetchone()[0]
    audit = (ROOT / "docs/DATA_AUDIT.md").read_text(encoding="utf-8")
    assert negative_sales > 0 and negative_demand > 0
    assert "negative" in audit.lower()
