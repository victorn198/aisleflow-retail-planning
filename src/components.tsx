import { useMemo, useState } from 'react'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { BarChart as EBarChart, LineChart as ELineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { LegacyGridContainLabel } from 'echarts/features'
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { ArrowDownRight, ArrowUpRight, Database, MoveRight } from 'lucide-react'
import type { Lang, Metric, SeriesPoint, BreakdownRow } from './types'

echarts.use([EBarChart, ELineChart, GridComponent, TooltipComponent, LegacyGridContainLabel, CanvasRenderer])

const number = (value: number, format: Metric['format'], lang: Lang) => {
  const locale = lang === 'pt' ? 'pt-BR' : 'en-US'
  if (format === 'percent') return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(value)
  if (format === 'currency') return new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
  return new Intl.NumberFormat(locale, { maximumFractionDigits: format === 'decimal' ? 1 : 0, notation: value > 999999 ? 'compact' : 'standard' }).format(value)
}

export function MetricCard({ metric, lang, prior, comparisonAvailable = true }: { metric: Metric; lang: Lang; prior: string; comparisonAvailable?: boolean }) {
  const delta = metric.previous === 0 ? 0 : (metric.value - metric.previous) / Math.abs(metric.previous)
  const good = metric.improvement === 'up' ? delta >= 0 : delta <= 0
  const Icon = delta >= 0 ? ArrowUpRight : ArrowDownRight
  return <article className="metric-card">
    <div className="metric-label"><span>{metric.label[lang]}</span><Database size={15} aria-hidden="true" /></div>
    <strong>{number(metric.value, metric.format, lang)}</strong>
    {comparisonAvailable ? <div className={`delta ${good ? 'good' : 'bad'}`}><Icon size={15} /><span>{number(Math.abs(delta), 'percent', lang)}</span><small>{prior}</small></div> : <div className="delta neutral"><span>—</span><small>{prior}</small></div>}
  </article>
}

export function TrendChart({ data, lang }: { data: SeriesPoint[]; lang: Lang }) {
  const [mode,setMode]=useState<'value'|'index'|'change'>('value'),first=data[0]?.value||1,values=data.map((point,index)=>mode==='index'?100*point.value/first:mode==='change'?(index&&data[index-1].value?100*(point.value-data[index-1].value)/data[index-1].value:0):point.value)
  const axis=(value:number)=>mode==='change'?`${value}%`:new Intl.NumberFormat(lang==='pt'?'pt-BR':'en-US',{notation:'compact',maximumFractionDigits:0}).format(value)
  const option={animationDuration:350,grid:{left:12,right:22,top:24,bottom:18,containLabel:true},tooltip:{trigger:'axis'},xAxis:{type:'category',data:data.map(d=>d.label),boundaryGap:false,axisLabel:{color:'#697386',hideOverlap:true}},yAxis:{type:'value',splitNumber:4,splitLine:{lineStyle:{color:'#edf1f7'}},axisLabel:{color:'#697386',formatter:axis}},series:[{type:'line',data:values,smooth:.25,symbolSize:5,lineStyle:{width:3,color:'#0f766e'},itemStyle:{color:'#0f766e'},areaStyle:{color:'rgba(15,118,110,.10)'}}]}
  const labels=lang==='pt'?['Valor','Índice 100','Variação %']:['Value','Index 100','Change %'],modes=['value','index','change'] as const
  return <><div className="chart-modes">{modes.map((item,index)=><button className={mode===item?'active':''} onClick={()=>setMode(item)} key={item}>{labels[index]}</button>)}</div><div className="chart-viewport"><ReactEChartsCore echarts={echarts} option={option} style={{height:300,width:'100%'}}/></div></>
}

export function BarChart({ data, lang, onSelect }: { data: BreakdownRow[]; lang: Lang; onSelect?:(name:string)=>void }) {
  const [share,setShare]=useState(false)
  const sorted = [...data].sort((a,b) => a.value - b.value).slice(-8)
  const compact = (value: number) => new Intl.NumberFormat(lang === 'pt' ? 'pt-BR' : 'en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
  type LabelPoint={data:{value:number;delta:number;hasPrevious?:boolean;isNew?:boolean}}
  const total=sorted.reduce((s,r)=>s+r.value,0),previousTotal=sorted.reduce((s,r)=>s+(r.previous??0),0),format=(v:number)=>share?`${v.toFixed(1)}%`:compact(v),seriesData=sorted.map(row=>{const value=share?(total?100*row.value/total:0):row.value,hasPrevious=row.previous!==undefined,previous=share?(previousTotal?100*(row.previous??0)/previousTotal:0):(row.previous??0),delta=previous?100*(value-previous)/Math.abs(previous):0;return{value,delta,hasPrevious,isNew:hasPrevious&&previous===0}}),comparison=(p:LabelPoint,rich=false)=>!p.data.hasPrevious?(rich?`{neutral|${lang==='pt'?'sem anterior':'no prior'}}`:(lang==='pt'?'sem anterior':'no prior')):p.data.isNew?(rich?`{new|${lang==='pt'?'nova':'new'}}`:(lang==='pt'?'nova':'new')):rich?`{${p.data.delta>=0?'up':'down'}|${p.data.delta>=0?'▲':'▼'} ${Math.abs(p.data.delta).toFixed(1)}%}`:`${p.data.delta>=0?'▲':'▼'} ${Math.abs(p.data.delta).toFixed(1)}%`,label=(p:LabelPoint)=>`{value|${format(p.data.value)}} {divider||} ${comparison(p,true)}`
  const option={animationDuration:350,grid:{left:12,right:108,top:12,bottom:12,containLabel:true},tooltip:{trigger:'item',formatter:(p:{name:string}&LabelPoint)=>`${p.name}<br/>${format(p.data.value)} | ${comparison(p)}`},xAxis:{type:'value',splitNumber:3,max:share?100:undefined,splitLine:{lineStyle:{color:'#edf1f7'}},axisLabel:{color:'#697386',fontSize:10,hideOverlap:true,formatter:format}},yAxis:{type:'category',data:sorted.map(d=>d.name),axisLine:{show:false},axisTick:{show:false},axisLabel:{color:'#27364b',width:130,overflow:'truncate'}},series:[{type:'bar',data:seriesData,barWidth:12,itemStyle:{color:'#0f766e',borderRadius:[0,4,4,0]},emphasis:{disabled:true},label:{show:true,position:'right',formatter:label,rich:{value:{color:'#415269'},divider:{color:'#aab4c3'},up:{color:'#07855b',fontWeight:700},down:{color:'#d9364f',fontWeight:700},new:{color:'#1f6feb',fontWeight:700},neutral:{color:'#7c8798'}}}}]}
  return <><div className="chart-modes"><button className={!share?'active':''} onClick={()=>setShare(false)}>{lang==='pt'?'Valor':'Value'}</button><button className={share?'active':''} onClick={()=>setShare(true)}>{lang==='pt'?'Participação':'Share'}</button></div><div className="chart-viewport"><ReactEChartsCore echarts={echarts} option={option} onEvents={onSelect?{click:(params:{name:string})=>onSelect(params.name)}:undefined} style={{height:300,width:'100%'}}/></div></>
}

export function DataGrid({ rows }: { rows: Record<string, string | number>[] }) {
  const columns = useMemo(() => Object.keys(rows[0] ?? {}).map(key => ({ accessorKey: key, header: key.replaceAll('_', ' ') })), [rows])
  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() })
  return <div className="table-wrap"><table><thead>{table.getHeaderGroups().map(group => <tr key={group.id}>{group.headers.map(h => <th key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</th>)}</tr>)}</thead><tbody>{table.getRowModel().rows.slice(0, 10).map(row => <tr key={row.id}>{row.getVisibleCells().map(cell => <td key={cell.id}>{String(cell.getValue() ?? '')}</td>)}</tr>)}</tbody></table></div>
}

export function DecisionNote({ title, children, action = false }: { title: string; children: React.ReactNode; action?: boolean }) {
  return <div className={`decision-note ${action ? 'action' : ''}`}><span>{title}</span><p>{children}</p>{action && <MoveRight size={18} />}</div>
}
