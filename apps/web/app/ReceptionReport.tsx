'use client';
import {useState} from 'react';
type Day={day:string;requests:number;quotes:number};
type Report={as_of:string;fresh:number;following:number;available:number;held:number;days:Day[]};
type Props={en:boolean;demo:boolean;counts:{fresh:number;following:number};request:(url:string)=>Promise<Report>;busy:boolean;run:(f:()=>Promise<void>)=>Promise<void>};
function sample(counts:Props['counts']):Report{
 const now=new Date(),parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const value=(key:string)=>Number(parts.find(p=>p.type===key)?.value);
 return {as_of:now.toISOString(),...counts,available:8,held:2,days:[2,3,0,5,3,4,1].map((requests,i)=>({day:new Date(Date.UTC(value('year'),value('month')-1,value('day')-6+i)).toISOString().slice(0,10),requests,quotes:[1,1,0,3,2,2,1][i]}))};
}
export default function ReceptionReport({en,demo,counts,request,busy,run}:Props){
 const [report,setReport]=useState<Report|null>(null),[open,setOpen]=useState(false);
 const t=(fa:string,english:string)=>en?english:fa,loc=en?'en-GB':'fa-IR',num=(n:number)=>n.toLocaleString(loc);
 const refresh=()=>run(async()=>{setReport(null);setReport(await request('/api/v1/reception/report'))});
 const data=demo&&open?sample(counts):report;
 return <details className="desk-item report-block" onToggle={e=>{const visible=e.currentTarget.open;setOpen(visible);if(visible&&!demo)void refresh()}}><summary>{t('گزارش عملیاتی پذیرش','Reception activity report')}</summary>{open&&<><p>{demo?t('نمونهٔ آموزشی؛ این اعداد دادهٔ واقعی مرکز نیستند.','Training example; these are not centre records.'):t('تصویر وضعیت پذیرش در زمان تهیهٔ گزارش.','A snapshot of the reception desk when the report was generated.')}</p>{!demo&&<button className="outline" disabled={busy} onClick={refresh}>{t('تازه‌سازی گزارش','Refresh report')}</button>}{data&&<><small>{t('زمان گزارش: ','As of ')}{new Date(data.as_of).toLocaleString(loc,{timeZone:'Asia/Tehran',dateStyle:'medium',timeStyle:'short'})} · {t('تهران','Tehran')}</small><dl className="report-metrics">{([[t('درخواست تازه','New requests'),data.fresh],[t('در حال پیگیری','In progress'),data.following],[t('وقت آزاد آینده','Available slots'),data.available],[t('وقت موقت فعال','Active holds'),data.held]] as const).map(([label,n])=><div key={label}><dt>{label}</dt><dd>{num(n)}</dd></div>)}</dl><table className="report-table"><caption>{t('هفت روز اخیر، شامل امروز · به وقت تهران','Last seven calendar days, including today · Tehran time')}</caption><thead><tr>{[t('روز','Day'),t('درخواست تماس جدید','Requests received'),t('پیش‌فاکتور صادرشده','Quotes issued')].map(h=><th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{data.days.map(d=><tr key={d.day}><th scope="row">{new Date(d.day+'T12:00:00Z').toLocaleDateString(loc,{timeZone:'Asia/Tehran',weekday:'short',month:'short',day:'numeric'})}</th><td>{num(d.requests)}</td><td>{num(d.quotes)}</td></tr>)}</tbody></table><small>{t('پیش‌فاکتور درآمد نیست و نگهداری موقت، نوبت قطعی نیست.','Issued quotes are not revenue; holds are not confirmed appointments.')}</small></>}</>}</details>;
}
