import type { SeriesPoint } from './types'

export type FilterState = { channel: string; device: string; country: string }
export type MartResult = { current: Record<string, number>; previous: Record<string, number>; trend: SeriesPoint[] }
let connectionPromise: Promise<import('@duckdb/duckdb-wasm').AsyncDuckDBConnection> | undefined
const literal=(value:string)=>`'${value.replaceAll("'","''")}'`

async function connection(){
  if(!connectionPromise) connectionPromise=(async()=>{const d=await import('@duckdb/duckdb-wasm');const b=await d.selectBundle(d.getJsDelivrBundles());const workerUrl=URL.createObjectURL(new Blob([`importScripts("${b.mainWorker!}");`],{type:'text/javascript'}));const db=new d.AsyncDuckDB(new d.ConsoleLogger(),new Worker(workerUrl));await db.instantiate(b.mainModule,b.pthreadWorker);await db.registerFileURL('sales.parquet',new URL('./data/mart_sales_daily.parquet',window.location.href).href,d.DuckDBDataProtocol.HTTP,false);await db.registerFileURL('risk.parquet',new URL('./data/mart_inventory_risk.parquet',window.location.href).href,d.DuckDBDataProtocol.HTTP,false);return db.connect()})()
  return connectionPromise
}

export async function queryMart(filters:FilterState):Promise<MartResult>{
  const con=await connection();const clauses=[filters.channel&&`division=${literal(filters.channel)}`,filters.device&&`store=${literal(filters.device)}`,filters.country&&`channel=${literal(filters.country)}`].filter(Boolean);const where=clauses.length?`where ${clauses.join(' and ')}`:''
  const riskClauses=[filters.channel&&`division=${literal(filters.channel)}`,filters.device&&`store=${literal(filters.device)}`].filter(Boolean);const riskWhere=riskClauses.length?`where ${riskClauses.join(' and ')}`:''
  const metrics=async(period:'current'|'previous')=>{const op=period==='current'?'>=':'<';const t=await con.query(`with base as(select * from read_parquet('sales.parquet') ${where}),bounds as(select min(sale_date) lo,max(sale_date) hi from base),scoped as(select b.* from base b,bounds where sale_date ${op} lo+((hi-lo)/2)::integer) select sum(sales_amount)::double sales,sum(units)::double units,sum(transactions)::double tx,sum(cogs)::double cogs,count(distinct store)::double stores,count(distinct product_id)::double sku,count(distinct sale_date)::double coverage_days from scoped`);const r=t.get(0) as Record<string,unknown>;const sales=Number(r.sales??0),cogs=Number(r.cogs??0);const rt=await con.query(`select count(*) filter(where risk_status in ('Out of stock','Critical','Low stock'))::double risk,sum(on_hand)::double stock,sum(reorder_qty)::double reorder from read_parquet('risk.parquet') ${riskWhere}`);const rr=rt.get(0) as Record<string,unknown>;return{sales,units:Number(r.units??0),tx:Number(r.tx??0),margin:sales?(sales-cogs)/sales:0,stores:Number(r.stores??0),sku:Number(r.sku??0),coverage:Number(r.coverage_days??0),risk:Number(rr.risk??0),stock:Number(rr.stock??0),reorder:Number(rr.reorder??0)}}
  const current=await metrics('current'),previous=await metrics('previous');const t=await con.query(`select strftime(sale_date,'%b %d') as period_label,sum(sales_amount)::double as metric_value from read_parquet('sales.parquet') ${where} group by sale_date order by sale_date`);return{current,previous,trend:t.toArray().map(r=>({label:String(r.period_label),value:Number(r.metric_value)}))}
}
