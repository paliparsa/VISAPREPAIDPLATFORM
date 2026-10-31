import React, { FormEvent, useCallback, useEffect, useState } from "react";
import "./TremendousIntelligence.css";

type Props = { onMessage: (message: string, kind?: "success" | "error") => void };
type EventRow = { id:string; eventId:string; eventType:string; resourceType?:string; resourceId?:string; orderId?:string; processingStatus:string; category?:string; actionRequired?:number; lastError?:string; createdAt:string };
type AlertRow = { id:string; alertType:string; severity:string; title:string; message:string; status:string; createdAt:string; eventId:string; eventType:string; resourceId?:string };
async function request<T>(path:string, init:RequestInit = {}):Promise<T> {
  const response = await fetch(path,{...init,credentials:"same-origin",headers:{"Content-Type":"application/json",...(init.headers||{})}});
  const payload = await response.json().catch(()=>({})) as Record<string,unknown>;
  if(!response.ok) throw new Error(typeof payload.message==="string"?payload.message:typeof payload.error==="string"?payload.error:"HTTP "+response.status);
  return payload as T;
}
const fmt=(v:unknown)=>new Intl.NumberFormat("fa-IR").format(Number(v||0));
const when=(v?:string)=>v?new Date(v.replace(" ","T")+(v.endsWith("Z")?"":"Z")).toLocaleString("fa-IR"):"—";
const statusFa:Record<string,string>={PROCESSED:"پردازش‌شده",UNMATCHED:"بدون تطبیق",FAILED:"ناموفق",RECEIVED:"دریافت‌شده",PROCESSING:"در حال پردازش",IGNORED:"نادیده‌گرفته‌شده"};
const categoryFa:Record<string,string>={ORDER:"سفارش",REWARD:"پاداش",FRAUD:"تقلب و ریسک",FUNDING:"تأمین مالی",PRODUCT:"محصولات",UNKNOWN:"ناشناخته"};

export function TremendousIntelligence({onMessage}:Props) {
 const [summary,setSummary]=useState<any>(null),[events,setEvents]=useState<EventRow[]>([]),[alerts,setAlerts]=useState<AlertRow[]>([]),[rules,setRules]=useState<any[]>([]);
 const [status,setStatus]=useState(""),[category,setCategory]=useState(""),[query,setQuery]=useState(""),[selected,setSelected]=useState<any>(null);
 const [loading,setLoading]=useState(false),[detailLoading,setDetailLoading]=useState(false),[tab,setTab]=useState<"events"|"alerts"|"rules">("events");
 const load=useCallback(async()=>{
  setLoading(true);
  try {
   const params=new URLSearchParams({limit:"100"}); if(status)params.set("status",status); if(category)params.set("category",category); if(query.trim())params.set("q",query.trim());
   const results=await Promise.all([
    request<any>("/api/admin/operations/provider-event-summary"),
    request<{events:EventRow[]}>("/api/admin/operations/provider-events?"+params),
    request<{alerts:AlertRow[]}>("/api/admin/operations/provider-alerts?status=OPEN&limit=50"),
    request<{rules:any[]}>("/api/admin/operations/provider-automation-rules")
   ]);
   setSummary(results[0]);setEvents(results[1].events||[]);setAlerts(results[2].alerts||[]);setRules(results[3].rules||[]);
  } catch(error){onMessage(error instanceof Error?error.message:"بارگذاری مرکز هوشمندی ناموفق بود.","error");}
  finally{setLoading(false);}
 },[status,category,query,onMessage]);
 useEffect(()=>{void load();},[load]);
 async function openEvent(id:string){
  setDetailLoading(true);setSelected({loading:true});
  try{setSelected(await request<any>("/api/admin/operations/provider-events/"+encodeURIComponent(id)));}
  catch(error){setSelected(null);onMessage(error instanceof Error?error.message:"دریافت جزئیات رویداد ناموفق بود.","error");}
  finally{setDetailLoading(false);}
 }
 async function acknowledge(id:string){
  try{await request("/api/admin/operations/provider-alerts/"+encodeURIComponent(id)+"/acknowledge",{method:"POST",body:"{}"});onMessage("هشدار به‌عنوان بررسی‌شده ثبت شد.");await load();}
  catch(error){onMessage(error instanceof Error?error.message:"ثبت بررسی هشدار ناموفق بود.","error");}
 }
 const totals=summary?.totals||{}, categoryRows=Array.isArray(summary?.categories)?summary.categories:[];
 return <div className="ti-root">
  <div className="ti-heading"><div><div className="ti-kicker">TREMENDOUS / EVENT INTELLIGENCE</div><h3>مرکز هوشمندی Tremendous</h3><p>پایش یک‌طرفه رویدادها؛ بدون فراخوانی API یا ایجاد سفارش در Tremendous</p></div><button className="button button-quiet" onClick={()=>void load()} disabled={loading}>↻ بروزرسانی</button></div>
  <div className="ti-stats">
   <article><small>کل رویدادها</small><strong>{fmt(totals.total)}</strong></article><article><small>پردازش‌شده</small><strong>{fmt(totals.processed)}</strong></article><article><small>بدون تطبیق</small><strong>{fmt(totals.unmatched)}</strong></article><article><small>ناموفق</small><strong>{fmt(totals.failed)}</strong></article><article className="ti-alert-stat"><small>هشدار باز</small><strong>{fmt(summary?.alerts?.open)}</strong><em>{fmt(summary?.alerts?.critical)} بحرانی</em></article>
  </div>
  <div className="ti-categories">{categoryRows.map((item:any)=><button key={item.category} className={category===item.category?"active":""} onClick={()=>setCategory(category===item.category?"":item.category)}><span>{categoryFa[item.category]||item.category}</span><b>{fmt(item.total)}</b></button>)}</div>
  <div className="ti-tabs"><button className={tab==="events"?"active":""} onClick={()=>setTab("events")}>رویدادها</button><button className={tab==="alerts"?"active":""} onClick={()=>setTab("alerts")}>هشدارها <span>{fmt(summary?.alerts?.open)}</span></button><button className={tab==="rules"?"active":""} onClick={()=>setTab("rules")}>قوانین اتوماسیون</button></div>
  {tab==="events"&&<>
   <form className="ti-filters" onSubmit={e=>{e.preventDefault();void load();}}><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="جست‌وجوی UUID، نوع رویداد، شناسه منبع یا سفارش"/><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">همه وضعیت‌ها</option>{Object.entries(statusFa).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><button className="button button-primary" disabled={loading}>جست‌وجو</button></form>
   <div className="table-wrap"><table><thead><tr><th>رویداد</th><th>دسته</th><th>منبع</th><th>سفارش داخلی</th><th>وضعیت</th><th>زمان دریافت</th><th></th></tr></thead><tbody>
   {events.map(e=><tr key={e.id}><td><strong>{e.eventType}</strong><small className="sub-cell" dir="ltr">{e.eventId}</small></td><td>{categoryFa[e.category||""]||e.category||"—"}</td><td dir="ltr">{e.resourceType||"—"} / {e.resourceId||"—"}</td><td dir="ltr">{e.orderId||"—"}</td><td><span className={e.processingStatus==="FAILED"?"pill pill-off":e.processingStatus==="UNMATCHED"?"pill pill-warn":"pill"}>{statusFa[e.processingStatus]||e.processingStatus}</span>{Boolean(e.actionRequired)&&<small className="sub-cell">نیازمند بررسی</small>}</td><td>{when(e.createdAt)}</td><td><button className="text-button" onClick={()=>void openEvent(e.id)}>جزئیات</button></td></tr>)}
   {!events.length&&<tr><td colSpan={7} className="empty-cell">{loading?"در حال بارگذاری…":"رویدادی مطابق فیلترها پیدا نشد."}</td></tr>}
   </tbody></table></div><p className="ti-foot">حداکثر ۱۰۰ رویداد در این فهرست نمایش داده می‌شود؛ آمار بالا بر اساس کل رویدادهای ذخیره‌شده است.</p>
  </>}
  {tab==="alerts"&&<div className="ti-alert-list">{alerts.map(a=><article key={a.id} className={"ti-alert "+a.severity.toLowerCase()}><div><span className="ti-severity">{a.severity==="CRITICAL"?"بحرانی":a.severity==="WARNING"?"هشدار":"اطلاع"}</span><h4>{a.title}</h4><p>{a.message}</p><small>{a.eventType} · {when(a.createdAt)} · <span dir="ltr">{a.eventId}</span></small></div><button className="button button-quiet" onClick={()=>void acknowledge(a.id)}>تأیید بررسی</button></article>)}{!alerts.length&&<div className="empty-cell">هشدار بازی وجود ندارد.</div>}</div>}
  {tab==="rules"&&<div className="ti-rules"><div className="ops-callout"><b>قوانین داخلی فعال</b><p>این قوانین فقط هشدار و وضعیت بررسی داخلی ایجاد می‌کنند. هیچ‌کدام پرداخت، صدور، لغو یا استرداد را در Tremendous اجرا نمی‌کنند.</p></div>{rules.map(rule=><article key={rule.id}><div><strong>{rule.eventType}</strong><small>{rule.id}</small></div><span className="pill pill-on">فعال</span><span>{rule.action==="CREATE_CRITICAL_ALERT"?"هشدار بحرانی":"ایجاد هشدار"}</span></article>)}</div>}
  {selected&&<div className="ti-backdrop" role="presentation" onClick={()=>setSelected(null)}><section className="ti-modal" role="dialog" aria-modal="true" aria-label="جزئیات رویداد" onClick={e=>e.stopPropagation()}><header><div><small>EVENT DETAIL</small><h3>جزئیات رویداد Tremendous</h3></div><button className="button button-quiet" onClick={()=>setSelected(null)}>بستن ×</button></header>
   {detailLoading||selected.loading?<p>در حال دریافت اطلاعات…</p>:<><div className="ti-detail-grid">{Object.entries(selected.event||{}).filter(([k])=>k!=="payloadJson").map(([k,v])=><div key={k}><small>{k}</small><b>{String(v??"—")}</b></div>)}</div><h4>Payload خام تأییدشده</h4><pre className="ti-json">{(()=>{try{return JSON.stringify(JSON.parse(selected.event?.payloadJson||"{}"),null,2)}catch{return selected.event?.payloadJson||"—"}})()}</pre><h4>تاریخچه پردازش</h4><div className="ti-attempts">{(selected.attempts||[]).map((a:any)=><div key={a.attemptNumber}><b>تلاش {fmt(a.attemptNumber)}</b><span>{a.status}</span><small>{when(a.startedAt)}{a.errorMessage?" · "+a.errorMessage:""}</small></div>)}</div></>}
  </section></div>}
 </div>;
}
