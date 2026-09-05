import type { BreakdownRow, SeriesPoint } from './types'

export type FilterState={channel:string;device:string;country:string;period:'7'|'30'|'90'|'all'}
export type DrillItem={dimension:'division'|'store'|'channel'|'product_id';value:string}
export type MartResult={current:Record<string,number>;previous:Record<string,number>;trend:SeriesPoint[];breakdown:BreakdownRow[];detail:Record<string,string|number>[];context:{topDriver:string;topShare:number;avgDaily:number;stock:number;dimension:string;canDrill:boolean;signal:'sales'|'units'|'rows'}}

let connectionPromise:Promise<import('@duckdb/duckdb-wasm').AsyncDuckDBConnection>|undefined
const literal=(value:string)=>`'${value.replaceAll("'","''")}'`
const records=(table:{toArray:()=>Record<string,unknown>[]})=>table.toArray().map(row=>Object.fromEntries(Object.entries(row).map(([k,v])=>[k,typeof v==='bigint'?Number(v):v]))) as Record<string,string|number>[]

async function connection(){
 if(!connectionPromise)connectionPromise=(async()=>{
  const d=await import('@duckdb/duckdb-wasm')
  const b=await d.selectBundle(d.getJsDelivrBundles())
  const workerUrl=URL.createObjectURL(new Blob([`importScripts("${b.mainWorker!}");`],{type:'text/javascript'}))
  const db=new d.AsyncDuckDB(new d.ConsoleLogger(),new Worker(workerUrl))
  await db.instantiate(b.mainModule,b.pthreadWorker)
  await db.registerFileURL('sales.parquet',new URL('./data/mart_sales_daily.parquet',window.location.href).href,d.DuckDBDataProtocol.HTTP,false)
  await db.registerFileURL('risk.parquet',new URL('./data/mart_inventory_risk.parquet',window.location.href).href,d.DuckDBDataProtocol.HTTP,false)
  return db.connect()
 })()
 return connectionPromise
}

let queryQueue:Promise<void>=Promise.resolve()
export function queryMart(filters:FilterState,pageId:string,drillPath:DrillItem[]=[]):Promise<MartResult>{
 const result=queryQueue.then(()=>runQuery(filters,pageId,drillPath))
 queryQueue=result.then(()=>undefined,()=>undefined)
 return result
}

async function runQuery(filters:FilterState,pageId:string,drillPath:DrillItem[]):Promise<MartResult>{
 const con=await connection()
 const clauses=[filters.channel&&`division=${literal(filters.channel)}`,filters.device&&`store=${literal(filters.device)}`,filters.country&&`channel=${literal(filters.country)}`,...drillPath.map(item=>`${item.dimension}=${literal(item.value)}`)].filter(Boolean)
 const where=clauses.length?`where ${clauses.join(' and ')}`:''
 const days=filters.period==='all'?0:Number(filters.period)
 const range=`with base as(select * from read_parquet('sales.parquet') ${where}),bounds as(select min(sale_date) lo,max(sale_date) hi from base),ranges as(select ${days?`hi-${days-1}`:'lo'} current_start,hi current_end,${days?`hi-${days*2-1}`:'NULL::DATE'} previous_start,${days?`hi-${days}`:'NULL::DATE'} previous_end from bounds)`
 const riskClauses=[filters.channel&&`division=${literal(filters.channel)}`,filters.device&&`store=${literal(filters.device)}`,...drillPath.filter(item=>item.dimension!=='channel').map(item=>`${item.dimension}=${literal(item.value)}`)].filter(Boolean)
 const riskWhere=riskClauses.length?`where ${riskClauses.join(' and ')}`:''

 const metrics=async(period:'current'|'previous')=>{
  const table=await con.query(`${range},scoped as(select b.* from base b,ranges where sale_date between ${period}_start and ${period}_end) select sum(sales_amount)::double sales,sum(units)::double units,sum(transactions)::double tx,sum(cogs)::double cogs,count(*)::double "rows",count(distinct store)::double stores,count(distinct product_id)::double sku,count(distinct sale_date)::double coverage_days from scoped`)
  const row=table.get(0) as Record<string,unknown>
  const sales=Number(row.sales??0),cogs=Number(row.cogs??0)
  const riskTable=await con.query(`select count(*) filter(where risk_status in ('Out of stock','Critical','Low stock'))::double risk,sum(on_hand)::double stock,sum(target_stock)::double "target",sum(reorder_qty)::double reorder,sum(avg_daily_28)::double avg_daily from read_parquet('risk.parquet') ${riskWhere}`)
  const risk=riskTable.get(0) as Record<string,unknown>
  return{sales,units:Number(row.units??0),tx:Number(row.tx??0),margin:sales?(sales-cogs)/sales:0,rows:Number(row.rows??0),stores:Number(row.stores??0),sku:Number(row.sku??0),coverage:Number(row.coverage_days??0),risk:Number(risk.risk??0),stock:Number(risk.stock??0),target:Number(risk.target??0),reorder:Number(risk.reorder??0),avg_daily:Number(risk.avg_daily??0)}
 }
 const current=await metrics('current')
 const previous=await metrics('previous')
 const signal:MartResult['context']['signal']=pageId==='command'||pageId==='explorer'?'sales':pageId==='trust'?'rows':'units'
 const trendExpression=signal==='sales'?'sum(sales_amount)':signal==='units'?'sum(units)':'count(*)'
 const trendTable=await con.query(`${range} select strftime(sale_date,'%b %d') period_label,(${trendExpression})::double metric_value from base,ranges where sale_date between current_start and current_end group by sale_date order by sale_date`)

 const hierarchies:Record<string,Array<DrillItem['dimension']>>={command:['division','store','product_id'],forecast:['division','store','product_id'],risk:['division','store','product_id'],explorer:['store','product_id'],replenishment:['division','store','product_id'],trust:['channel','division','store']}
 const hierarchy=hierarchies[pageId]??hierarchies.command
 const dimension=hierarchy[Math.min(drillPath.length,hierarchy.length-1)]
 const aggregate=signal==='sales'?'sum(sales_amount)':signal==='units'?'sum(units)':'count(*)'
 const breakdownTable=await con.query(`${range} select ${dimension} as driver_name,${aggregate} filter(where sale_date between current_start and current_end)::double as driver_value,${aggregate} filter(where sale_date between previous_start and previous_end)::double as previous_value from base,ranges group by 1 order by driver_value desc limit 12`)
 const denominatorTable=await con.query(`${range} select (${aggregate} filter(where sale_date between current_start and current_end))::double total from base,ranges`)
 const denominator=Number((denominatorTable.get(0) as Record<string,unknown>).total??0)

 const scoped=`${range},scoped as(select b.* from base b,ranges where sale_date between current_start and current_end),prior as(select b.* from base b,ranges where sale_date between previous_start and previous_end)`
 let detailTable
 if(pageId==='forecast'){
  detailTable=await con.query(`${scoped} select ${dimension} context,sum(units)::double observed_units,(select sum(p.units)::double from prior p where p.${dimension}=s.${dimension}) prior_units,round(sum(units)/nullif(count(distinct sale_date),0),1)::double daily_units from scoped s group by 1 order by observed_units desc limit 30`)
 }else if(pageId==='explorer'){
  detailTable=await con.query(`${scoped} select ${dimension} context,sum(sales_amount)::double net_sales,sum(units)::double units_sold,sum(transactions)::double transactions,round(100*(sum(sales_amount)-sum(cogs))/nullif(sum(sales_amount),0),1)::double margin_pct from scoped group by 1 order by net_sales desc limit 30`)
 }else if(pageId==='trust'){
  detailTable=await con.query(`${scoped} select 'Positive transaction values' check_name,case when count(*) filter(where sales_amount<0 or units<0 or transactions<0)=0 then 'Passed' else 'Failed' end status,(count(*) filter(where sales_amount<0 or units<0 or transactions<0))::varchar observed from scoped union all select 'Required dimensions present',case when count(*) filter(where division is null or store is null or product_id is null or sale_date is null)=0 then 'Passed' else 'Review' end,(count(*) filter(where division is null or store is null or product_id is null or sale_date is null))::varchar from scoped union all select 'Sales and COGS available',case when count(*) filter(where sales_amount is null or cogs is null)=0 then 'Passed' else 'Review' end,(count(*) filter(where sales_amount is null or cogs is null))::varchar from scoped`)
 }else{
  detailTable=await con.query(`select store,product_id,product_name,division,on_hand,target_stock,reorder_qty,risk_status,round(avg_daily_28,1)::double avg_daily_demand,round(avg_daily_prev,1)::double prior_daily_demand from read_parquet('risk.parquet') ${riskWhere} order by reorder_qty desc limit 30`)
 }
 const breakdown=records(breakdownTable).map(row=>({name:String(row.driver_name??'Unknown'),value:Number(row.driver_value??0),previous:filters.period==='all'?undefined:Number(row.previous_value??0)}))
 const detail=records(detailTable)
 const avgDaily=detail.reduce((sum,row)=>sum+Number(row.avg_daily_demand??row.daily_units??0),0)
 const stock=detail.reduce((sum,row)=>sum+Number(row.on_hand??0),0)
 return{current,previous,trend:trendTable.toArray().map(row=>({label:String(row.period_label),value:Number(row.metric_value)})),breakdown,detail,context:{topDriver:breakdown[0]?.name??'N/A',topShare:denominator?breakdown[0].value/denominator:0,avgDaily,stock,dimension,canDrill:drillPath.length<hierarchy.length-1,signal}}
}
