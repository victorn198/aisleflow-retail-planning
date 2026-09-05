import { useEffect, useState } from 'react'
import { Activity, ChevronDown, ChevronUp, ExternalLink, Languages, RotateCcw, Route, Sparkles } from 'lucide-react'
import { BarChart, DataGrid, DecisionNote, MetricCard, TrendChart } from './components'
import { ui } from './i18n'
import { MartVerifier } from './MartVerifier'
import { queryMart, type DrillItem, type MartResult } from './queryMart'
import { PageInsight, type ForecastEvaluation } from './innovation'
import type { DashboardData, Lang } from './types'

export default function App() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('aisleflow-lang') as Lang) || 'en')
  const [pageId, setPageId] = useState('command')
  const [filters, setFilters] = useState({ channel: '', device: '', country: '', period:'30' as '7'|'30'|'90'|'all' })
  const [mart, setMart] = useState<MartResult | null>(null)
  const [forecast,setForecast]=useState<ForecastEvaluation>()
  const [queryState,setQueryState]=useState<'loading'|'ready'|'error'>('loading')
  const [drillPath,setDrillPath]=useState<DrillItem[]>([])
  useEffect(() => { fetch('./data/dashboard.json').then(r => r.json()).then(setData) }, [])
  useEffect(()=>{fetch('./data/forecast_evaluation.json').then(r=>r.json()).then(setForecast).catch(()=>setForecast(undefined))},[])
  useEffect(() => { localStorage.setItem('aisleflow-lang', lang); document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en' }, [lang])
  useEffect(()=>{let active=true;setQueryState('loading');queryMart(filters,pageId,drillPath).then(result=>{if(active){setMart(result);setQueryState('ready')}}).catch(error=>{console.error(error);if(active)setQueryState('error')});return()=>{active=false}},[filters.channel,filters.device,filters.country,filters.period,pageId,drillPath])
  if (!data) return <main className="loading"><Activity className="spin" /> Loading AisleFlow...</main>
  const page = data.pages.find(p => p.id === pageId) ?? data.pages[0]
  const metrics = page.metrics.map(metric => mart?.current[metric.id] === undefined ? metric : { ...metric, value: mart.current[metric.id], previous: mart.previous[metric.id] ?? metric.previous })
  const trend = mart?.trend.length ? mart.trend : page.trend
  const breakdown=mart?.breakdown.length?mart.breakdown:page.breakdown,detail=mart?.detail.length?mart.detail:page.detail
  const riskVisible=detail.filter(row=>String(row.risk_status).match(/Critical|Out of stock|Low stock/)).length
  const reviewChecks=detail.filter(row=>'status'in row&&String(row.status)!=='Passed').length
  const findingByPage:Record<string,{en:string;pt:string}> = mart ? {
    command:{en:`${mart.context.topDriver} contributes ${(mart.context.topShare*100).toFixed(1)}% of scoped sales; ${riskVisible} visible items require inventory review.`,pt:`${mart.context.topDriver} contribui com ${(mart.context.topShare*100).toFixed(1)}% das vendas; ${riskVisible} itens visíveis exigem revisão.`},
    forecast:{en:`${String(forecast?.selected_model??'The baseline').replaceAll('_',' ')} is selected after ${forecast?.holdout_observations??0} rolling holdout observations.`,pt:`${String(forecast?.selected_model??'O baseline').replaceAll('_',' ')} foi selecionado após ${forecast?.holdout_observations??0} observações de holdout móvel.`},
    risk:{en:`${riskVisible} visible positions are at risk; ${mart.context.topDriver} carries the largest demand exposure.`,pt:`${riskVisible} posições visíveis estão em risco; ${mart.context.topDriver} concentra a maior exposição de demanda.`},
    explorer:{en:`${mart.context.topDriver} contributes ${(mart.context.topShare*100).toFixed(1)}% of scoped network sales.`,pt:`${mart.context.topDriver} contribui com ${(mart.context.topShare*100).toFixed(1)}% das vendas da rede no recorte.`},
    replenishment:{en:`The current snapshot suggests ${Math.round(mart.current.reorder??0).toLocaleString()} units before lead-time and safety-stock assumptions.`,pt:`O snapshot atual sugere ${Math.round(mart.current.reorder??0).toLocaleString('pt-BR')} unidades antes das premissas de prazo e segurança.`},
    trust:{en:`${Math.round(mart.current.rows??0).toLocaleString()} mart rows cover ${Math.round(mart.current.coverage??0)} days; ${reviewChecks} checks need review.`,pt:`${Math.round(mart.current.rows??0).toLocaleString('pt-BR')} linhas cobrem ${Math.round(mart.current.coverage??0)} dias; ${reviewChecks} testes exigem revisão.`}
  } : {}
  const actionByPage:Record<string,{en:string;pt:string}>={
    command:{en:'Assign the risk queue, then test replenishment assumptions before purchase approval.',pt:'Atribua a fila de risco e teste as premissas antes de aprovar compras.'},
    forecast:{en:'Use the selected baseline for planning; do not promote the trend model without measurable backtest gain.',pt:'Use o baseline selecionado; não promova o modelo de tendência sem ganho mensurável.'},
    risk:{en:'Resolve stockouts and critical gaps first, then review demand exposure by division and store.',pt:'Resolva rupturas e gaps críticos primeiro; depois revise a exposição por divisão e loja.'},
    explorer:{en:'Compare leader growth with margin and tail performance before reallocating volume.',pt:'Compare crescimento do líder, margem e cauda antes de redistribuir volume.'},
    replenishment:{en:'Set lead time, safety stock and demand scenario, then submit the simulated recommendation for human review.',pt:'Defina prazo, segurança e demanda; depois envie a recomendação simulada para revisão humana.'},
    trust:{en:'Block operational use when a required check fails or source coverage is insufficient.',pt:'Bloqueie uso operacional quando um teste necessário falhar ou a cobertura for insuficiente.'}
  }
  const finding=mart?(findingByPage[page.id]?.[lang]??page.finding[lang]):page.finding[lang]
  const action=actionByPage[page.id]?.[lang]??page.action[lang]
  const t = ui[lang]
  const comparisonAvailable=filters.period!=='all'
  const comparisonLabel=comparisonAvailable?(lang==='pt'?`vs. ${filters.period} dias anteriores`:`vs. previous ${filters.period} days`):(lang==='pt'?'sem janela anterior':'no prior window')
  const snapshotMetrics=new Set(['risk','stock','reorder'])
  const select = (label: string, key: keyof typeof filters, values: string[]) => <label className="filter"><span>{label}</span><div><select disabled={queryState==='loading'} value={filters[key]} onChange={e => {setDrillPath([]);setFilters(v => ({ ...v, [key]: e.target.value }))}}><option value="">{t.all}</option>{values.map(v => <option key={v}>{v}</option>)}</select><ChevronDown size={15} /></div></label>
  const changePage=(id:string)=>{setPageId(id);setDrillPath([])},drill=(name:string)=>{if(mart?.context.canDrill)setDrillPath(path=>[...path,{dimension:mart.context.dimension as DrillItem['dimension'],value:name}])}
  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="#top"><span className="brand-mark"><Route /></span><span><b>AisleFlow</b><small>Retail Planning</small></span></a><nav>{data.pages.map(p => <button className={p.id === page.id ? 'active' : ''} onClick={() => changePage(p.id)} key={p.id}>{p.title[lang]}</button>)}</nav><button className="language" onClick={() => setLang(lang === 'en' ? 'pt' : 'en')}><Languages size={17} />{lang === 'en' ? 'PT' : 'EN'}</button></header>
    <main id="top">
      <section className="page-head"><div><span className="eyebrow"><Sparkles size={15} />{page.eyebrow[lang]}</span><h1>{page.title[lang]}</h1><p>{page.question[lang]}</p></div><div className="source-stamp"><span>{t.source}</span><b>{data.meta.source}</b><small>{data.meta.period}</small></div></section>
      <section className="filterbar"><div className="filter-heading"><span>{t.filters}</span><small>{data.meta.rows.toLocaleString()} rows</small></div><label className="filter"><span>{lang==='pt'?'Período':'Period'}</span><div><select value={filters.period} onChange={e=>{setDrillPath([]);setFilters(v=>({...v,period:e.target.value as typeof filters.period}))}}><option value="7">{lang==='pt'?'Últimos 7 dias':'Last 7 days'}</option><option value="30">{lang==='pt'?'Últimos 30 dias':'Last 30 days'}</option><option value="90">{lang==='pt'?'Últimos 90 dias':'Last 90 days'}</option><option value="all">{lang==='pt'?'Todo histórico (sem comparação)':'All history (no comparison)'}</option></select><ChevronDown size={15}/></div></label>{select(t.channel, 'channel', data.filters.channels)}{select(t.device, 'device', data.filters.devices)}{select(t.country, 'country', data.filters.countries)}<button className="reset" onClick={() => {setDrillPath([]);setFilters({ channel: '', device: '', country: '',period:'30' })}}><RotateCcw size={15} />{t.reset}</button></section>
      <section className="metrics">{metrics.map(metric => {const isSnapshot=snapshotMetrics.has(metric.id);return <MetricCard key={metric.id} metric={metric} lang={lang} prior={isSnapshot?(lang==='pt'?'snapshot atual':'current snapshot'):comparisonLabel} comparisonAvailable={comparisonAvailable&&!isSnapshot} />})}</section>
      {queryState==='error'&&<div className="query-error" role="alert">{lang==='pt'?'Não foi possível recalcular o recorte.':'The selected scope could not be recalculated.'}</div>}
      <PageInsight pageId={page.id} values={mart?.current??Object.fromEntries(metrics.map(metric=>[metric.id,metric.value]))} trend={trend} breakdown={breakdown} detail={detail} forecast={forecast} lang={lang}/>
      <section className={`decision-strip ${queryState==='loading'?'is-loading':''}`}><DecisionNote title={t.finding}>{finding}</DecisionNote><DecisionNote title={t.action} action>{action}</DecisionNote></section>
      <section className="analysis-grid"><article className="panel wide"><div className="panel-title"><h2>{page.trendTitle[lang]}</h2><span>{lang==='pt'?'Comparação temporal':'Time comparison'}</span></div><TrendChart data={trend} lang={lang} /></article><article className="panel"><div className="panel-title"><h2>{page.breakdownTitle[lang]}</h2><span>{lang==='pt'?'Clique em uma barra para detalhar':'Click a bar to drill down'}</span></div><div className="drillbar"><span>{lang==='pt'?'Caminho':'Path'}: <b>{mart?.context.dimension??'division'}</b>{drillPath.map(item=><i key={`${item.dimension}-${item.value}`}> / {item.value}</i>)}</span><div><button disabled={!drillPath.length} onClick={()=>setDrillPath(path=>path.slice(0,-1))}><ChevronUp/>{lang==='pt'?'Voltar nível':'Drill up'}</button><button disabled={!drillPath.length} onClick={()=>setDrillPath([])}><RotateCcw/>{lang==='pt'?'Início':'Reset'}</button></div></div><BarChart data={breakdown} lang={lang} onSelect={drill}/></article></section>
      <section className="panel detail"><div className="panel-title"><h2>{page.detailTitle[lang]}</h2><span>{t.details}</span></div><DataGrid rows={detail} /></section>
      <section className="trust"><div><h2>{t.trust}</h2><p>{data.meta.limitations[lang]}</p>{page.id === 'trust' && <MartVerifier file="mart_inventory_risk.parquet" lang={lang}/>}</div><div><span>Built</span><b>{data.meta.builtAt}</b></div><div><span>Rows</span><b>{data.meta.rows.toLocaleString()}</b></div></section>
    </main>
    <footer><span>AisleFlow · Portfolio case by Victor N.</span><a href="mailto:victorn198@outlook.com">{t.contact}<ExternalLink size={14} /></a></footer>
  </div>
}
