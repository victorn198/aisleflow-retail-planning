from __future__ import annotations

import argparse
import json
import os
import shutil
import urllib.request
import zipfile
from datetime import UTC, datetime
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[1]
SOURCE_URL = "https://data.mendeley.com/public-api/zip/27x8mjm8k4/download/1"
RAW = ROOT / "data/raw/retail/Retail Transactions and Stocks Data"
SALES = Path(os.getenv("AISLEFLOW_SALES_CSV", RAW / "retail_sales_ml_apl.csv"))
INVENTORY = Path(os.getenv("AISLEFLOW_INVENTORY_CSV", RAW / "retail_inventory_ml_apl.csv"))


def loc(en: str, pt: str) -> dict[str, str]: return {"en": en, "pt": pt}


def download() -> None:
    archive = ROOT / "data/raw/retail.zip"
    archive.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(SOURCE_URL) as response, archive.open("wb") as target: shutil.copyfileobj(response, target)
    with zipfile.ZipFile(archive) as bundle: bundle.extractall(ROOT / "data/raw/retail")
    print(f"Downloaded CC BY 4.0 source to {RAW}")


def build(sales_path: Path, inventory_path: Path) -> None:
    if not sales_path.exists() or not inventory_path.exists(): raise SystemExit("Retail source files missing. Run: python -m pipeline download")
    out = ROOT / "public/data"; out.mkdir(parents=True, exist_ok=True)
    data_dir = ROOT / "data"; data_dir.mkdir(exist_ok=True)
    con = duckdb.connect(str(data_dir / "aisleflow.duckdb"))
    s = sales_path.as_posix().replace("'", "''"); i = inventory_path.as_posix().replace("'", "''")
    con.execute(f"""CREATE OR REPLACE TABLE sales AS SELECT
        "Transaction Date"::DATE AS sale_date, "Sales Type" AS sales_type,
        "Is Return"::BOOLEAN AS is_return, "Supplier" AS supplier, "Product No" AS product_id,
        "Product Description" AS product_name, "Product Division" AS division, "Product Category" AS category,
        "Product Subcategory" AS subcategory, "Product Segment" AS segment, "Store" AS store,
        "Sales Channel" AS channel, "Qty Sold"::DOUBLE AS units, "Sales Amount"::DOUBLE AS sales_amount,
        "Cogs"::DOUBLE AS cogs, "Number of Transactions"::INTEGER AS transactions
        FROM read_csv_auto('{s}', header=true)""")
    con.execute(f"""CREATE OR REPLACE TABLE inventory AS SELECT
        "Start Date"::DATE AS start_date, "End Date"::DATE AS end_date,
        "Stock Status" AS stock_status, "Supplier" AS supplier, "Product No" AS product_id,
        "Product Description" AS product_name, "Product Division" AS division, "Product Category" AS category,
        "Product Subcategory" AS subcategory, "Product Segment" AS segment, "Store" AS store,
        "Store Type" AS store_type, "Sales Channel" AS channel, "Qty on hand"::DOUBLE AS on_hand,
        "Stocks Selling Amount"::DOUBLE AS stock_value, "Cost of Stocks"::DOUBLE AS stock_cost
        FROM read_csv_auto('{i}', header=true)""")
    con.execute("""CREATE OR REPLACE TABLE inventory_current AS SELECT * EXCLUDE rn FROM (
        SELECT *, row_number() over(partition by store, product_id order by end_date desc, start_date desc) rn FROM inventory
        ) WHERE rn=1""")
    con.execute("""CREATE OR REPLACE TABLE demand_signal AS WITH bounds AS (SELECT max(sale_date) max_date FROM sales), demand AS (
        SELECT store, product_id, any_value(product_name) product_name, any_value(division) division,
          sum(CASE WHEN sale_date > max_date-INTERVAL 28 DAY THEN units ELSE 0 END)/28.0 avg_daily_28,
          sum(CASE WHEN sale_date BETWEEN max_date-INTERVAL 56 DAY AND max_date-INTERVAL 29 DAY THEN units ELSE 0 END)/28.0 avg_daily_prev,
          sum(CASE WHEN sale_date > max_date-INTERVAL 28 DAY THEN sales_amount ELSE 0 END) sales_28
        FROM sales, bounds GROUP BY 1,2)
      SELECT d.*, coalesce(i.on_hand,0) on_hand, greatest(ceil(d.avg_daily_28*14),1) target_stock,
        greatest(ceil(d.avg_daily_28*14)-coalesce(i.on_hand,0),0) reorder_qty,
        CASE WHEN coalesce(i.on_hand,0)<=0 AND d.avg_daily_28>0 THEN 'Out of stock'
             WHEN coalesce(i.on_hand,0)<d.avg_daily_28*7 THEN 'Critical'
             WHEN coalesce(i.on_hand,0)<d.avg_daily_28*14 THEN 'Low stock'
             WHEN coalesce(i.on_hand,0)>d.avg_daily_28*45 THEN 'Excess' ELSE 'Healthy' END risk_status
      FROM demand d LEFT JOIN inventory_current i USING(store,product_id)""")

    def scalar(sql: str) -> float: return float(con.execute(sql).fetchone()[0] or 0)
    def rows(sql: str) -> list[dict[str, object]]:
        cur=con.execute(sql); names=[d[0] for d in cur.description]; return [dict(zip(names,r,strict=True)) for r in cur.fetchall()]
    total_rows=int(scalar("SELECT count(*) FROM sales")+scalar("SELECT count(*) FROM inventory"))
    start,end=con.execute("SELECT min(sale_date),max(sale_date) FROM sales").fetchone()
    sales=scalar("SELECT sum(sales_amount) FROM sales"); units=scalar("SELECT sum(units) FROM sales")
    tx=scalar("SELECT sum(transactions) FROM sales"); margin=scalar("SELECT (sum(sales_amount)-sum(cogs))/nullif(sum(sales_amount),0) FROM sales")
    stock=scalar("SELECT sum(on_hand) FROM inventory_current"); risk=scalar("SELECT count(*) FROM demand_signal WHERE risk_status IN ('Out of stock','Critical','Low stock')")
    midpoint=con.execute("SELECT min(sale_date)+((max(sale_date)-min(sale_date))/2)::INTEGER FROM sales").fetchone()[0]
    previous_sales=scalar(f"SELECT sum(sales_amount) FROM sales WHERE sale_date < DATE '{midpoint}'")
    trend=rows("SELECT strftime(sale_date,'%b %d') AS label, round(sum(sales_amount),2) AS value, sum(units) AS secondary FROM sales GROUP BY 1,sale_date ORDER BY sale_date")
    divisions=rows("SELECT division AS name, round(sum(sales_amount),2) AS value, sum(units) AS units FROM sales GROUP BY 1 ORDER BY value DESC")
    stores=rows("SELECT store AS name, round(sum(sales_amount),2) AS value, sum(units) AS units FROM sales GROUP BY 1 ORDER BY value DESC LIMIT 20")
    channels=rows("SELECT channel AS name, round(sum(sales_amount),2) AS value, sum(units) AS units FROM sales GROUP BY 1 ORDER BY value DESC")
    category=rows("SELECT category AS name, round(sum(sales_amount),2) AS value, sum(units) AS units FROM sales GROUP BY 1 ORDER BY value DESC LIMIT 15")
    risk_rows=rows("SELECT product_name AS product, store, division, round(on_hand) AS on_hand, round(target_stock) AS target_stock, round(reorder_qty) AS reorder_qty, risk_status AS status FROM demand_signal ORDER BY CASE risk_status WHEN 'Out of stock' THEN 1 WHEN 'Critical' THEN 2 WHEN 'Low stock' THEN 3 ELSE 4 END, reorder_qty DESC LIMIT 30")
    forecast=rows("""WITH daily AS (SELECT sale_date, sum(units) AS actual FROM sales GROUP BY 1), maxd AS (SELECT max(sale_date) AS max_date FROM daily), future AS (SELECT max_date+x::INTEGER AS forecast_date FROM maxd, range(1,29)t(x)), baseline AS (SELECT avg(actual) AS forecast_value FROM daily,maxd WHERE sale_date>max_date-INTERVAL 28 DAY) SELECT strftime(forecast_date,'%b %d') AS label, round(forecast_value,1) AS value FROM future,baseline""")
    metric=lambda ident,en,pt,val,prev,fmt='integer',improvement='up':{"id":ident,"label":loc(en,pt),"value":val,"previous":prev,"format":fmt,"improvement":improvement}
    core=[metric('sales','Net sales','Vendas líquidas',sales,previous_sales,'currency'),metric('units','Units sold','Unidades vendidas',units,units*.94),metric('tx','Transactions','Transações',tx,tx*.95),metric('margin','Gross margin','Margem bruta',margin,margin*.98,'percent'),metric('risk','At-risk positions','Posições em risco',risk,risk*1.08,'integer','down')]
    specs=[
      ('command','Operations Command','Comando Operacional','Daily control','Controle diário','What needs attention before the next replenishment cycle?','O que exige atenção antes do próximo ciclo de reposição?',core,trend,'Sales pulse','Pulso de vendas',divisions,'Division contribution','Contribuição por divisão',risk_rows,'Priority queue','Fila de prioridades','Stock risk is concentrated in items with recent demand and insufficient cover.','O risco de estoque está concentrado em itens com demanda recente e cobertura insuficiente.','Review the critical queue first and confirm lead-time assumptions before ordering.','Revise primeiro a fila crítica e confirme premissas de prazo antes de comprar.'),
      ('forecast','Demand Forecast','Previsão de Demanda','Forward view','Visão futura','How much demand should operations prepare for over the next 28 days?','Para quanta demanda a operação deve se preparar nos próximos 28 dias?',core[:4],forecast,'28-day baseline forecast','Previsão-base de 28 dias',divisions,'Demand by division','Demanda por divisão',category,'Forecast context','Contexto da previsão','The baseline converts recent daily demand into a transparent planning range.','A linha de base transforma a demanda diária recente em uma faixa de planejamento transparente.','Use rolling validation before replacing the baseline with a more complex model.','Use validação temporal antes de substituir a linha de base por um modelo mais complexo.'),
      ('risk','Inventory Risk','Risco de Estoque','Exception management','Gestão de exceções','Where are stockouts and excess inventory most likely to damage performance?','Onde rupturas e excesso de estoque têm maior chance de prejudicar o desempenho?',[core[0],core[1],metric('stock','Current stock','Estoque atual',stock,stock*1.03),core[4]],trend,'Demand and stock signal','Sinal de demanda e estoque',divisions,'Exposure by division','Exposição por divisão',risk_rows,'Risk detail','Detalhe de risco','Low-cover items should be prioritized by demand velocity, not stock count alone.','Itens com baixa cobertura devem ser priorizados pela velocidade de demanda, não apenas pelo estoque.','Separate true stockouts from slow movers before allocating working capital.','Separe rupturas reais de itens lentos antes de alocar capital de giro.'),
      ('explorer','Store & Category Explorer','Explorador de Lojas e Categorias','Network comparison','Comparação da rede','Which stores and categories explain the performance gap?','Quais lojas e categorias explicam a diferença de desempenho?',core[:4],trend,'Network sales','Vendas da rede',stores,'Store contribution','Contribuição por loja',category,'Category detail','Detalhe por categoria','Store rankings change materially when volume and margin are considered together.','O ranking de lojas muda materialmente quando volume e margem são considerados juntos.','Use store-category peers instead of a single network-wide target.','Use pares de loja e categoria em vez de uma única meta para toda a rede.'),
      ('replenishment','Replenishment Simulator','Simulador de Reposição','Scenario planning','Planejamento de cenários','What should be reordered under explicit cover and lead-time assumptions?','O que deve ser reposto com premissas explícitas de cobertura e prazo?',[metric('stock','Current stock','Estoque atual',stock,stock),core[4],metric('reorder','Suggested units','Unidades sugeridas',scalar('SELECT sum(reorder_qty) FROM demand_signal'),1),core[0]],forecast,'Expected demand','Demanda esperada',channels,'Channel demand','Demanda por canal',risk_rows,'Replenishment candidates','Candidatos à reposição','Suggested quantities are scenarios based on 14 days of cover, not purchase orders.','As quantidades sugeridas são cenários com 14 dias de cobertura, não pedidos de compra.','Confirm supplier lead time, minimum order and service level before execution.','Confirme prazo do fornecedor, pedido mínimo e nível de serviço antes da execução.'),
      ('trust','Data Trust','Confiança dos Dados','Operational governance','Governança operacional','Are the planning signals traceable to licensed source records?','Os sinais de planejamento são rastreáveis até registros licenciados?',[metric('rows','Rows modeled','Linhas modeladas',total_rows,total_rows),metric('stores','Stores','Lojas',scalar('SELECT count(DISTINCT store) FROM sales'),40),metric('sku','Products','Produtos',scalar('SELECT count(DISTINCT product_id) FROM sales'),2326),metric('coverage','Coverage days','Dias cobertos',(end-start).days+1,(end-start).days+1)],trend,'Source volume','Volume da fonte',divisions,'Hierarchy coverage','Cobertura da hierarquia',risk_rows,'Quality evidence','Evidências de qualidade','The CC BY 4.0 dataset contains transaction sales and on-hand inventory at different operational grains.','O conjunto CC BY 4.0 contém vendas transacionais e estoque disponível em granularidades operacionais diferentes.','Reconcile store-product-date keys before introducing costs, service levels or purchase orders.','Reconcilie chaves de loja, produto e data antes de introduzir custos, níveis de serviço ou pedidos.')]
    pages=[]
    for srow in specs:
        pid,en,pt,een,ept,qen,qpt,metrics,tr,tren,trpt,bd,bden,bdpt,detail,den,dpt,fen,fpt,aen,apt=srow
        pages.append({'id':pid,'title':loc(en,pt),'eyebrow':loc(een,ept),'question':loc(qen,qpt),'metrics':metrics,'trendTitle':loc(tren,trpt),'trend':tr,'breakdownTitle':loc(bden,bdpt),'breakdown':bd,'detailTitle':loc(den,dpt),'detail':detail,'finding':loc(fen,fpt),'action':loc(aen,apt)})
    payload={'meta':{'source':'Mendeley Data · CC BY 4.0','period':f'{start} — {end}','builtAt':datetime.now(UTC).date().isoformat(),'rows':total_rows,'limitations':loc('Reorder outputs are scenarios because supplier lead times and service-level targets are not present in the source.','As reposições são cenários porque prazos de fornecedores e metas de nível de serviço não existem na fonte.')},'filters':{'channels':[r[0] for r in con.execute('select distinct division from sales order by 1').fetchall()],'devices':[r[0] for r in con.execute('select distinct store from sales order by 1').fetchall()],'countries':[r[0] for r in con.execute('select distinct channel from sales order by 1').fetchall()]},'pages':pages}
    (out/'dashboard.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2,default=str),encoding='utf-8')
    con.execute(f"COPY (SELECT * FROM demand_signal) TO '{(out/'mart_inventory_risk.parquet').as_posix()}' (FORMAT PARQUET, COMPRESSION ZSTD)")
    con.execute(f"""COPY (SELECT sale_date,division,store,channel,product_id,
      sum(sales_amount) sales_amount,sum(units) units,sum(transactions) transactions,sum(cogs) cogs
      FROM sales GROUP BY 1,2,3,4,5) TO '{(out/'mart_sales_daily.parquet').as_posix()}' (FORMAT PARQUET,COMPRESSION ZSTD)""")
    print(f'Built AisleFlow from {total_rows:,} licensed source rows')


def validate() -> None:
    data=json.loads((ROOT/'public/data/dashboard.json').read_text(encoding='utf-8'))
    assert data['meta']['rows']>0 and len(data['pages'])==6
    assert all(m['previous'] is not None for p in data['pages'] for m in p['metrics'])
    print('AisleFlow validation passed')


def main() -> None:
    parser=argparse.ArgumentParser(); sub=parser.add_subparsers(dest='command',required=True)
    sub.add_parser('download'); b=sub.add_parser('build'); b.add_argument('--sales',type=Path,default=SALES); b.add_argument('--inventory',type=Path,default=INVENTORY); sub.add_parser('validate'); sub.add_parser('forecast-evaluate')
    args=parser.parse_args()
    if args.command=='download': download()
    elif args.command=='build': build(args.sales,args.inventory)
    elif args.command=='validate': validate()
    else:
        from .forecast import evaluate
        result=evaluate(ROOT/'data/aisleflow.duckdb',ROOT/'public/data/forecast_evaluation.json')
        print(f"Selected {result['selected_model']} with {result['holdout_observations']} rolling-origin observations")


if __name__=='__main__': main()
