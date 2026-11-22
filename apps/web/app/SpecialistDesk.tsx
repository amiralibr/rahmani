'use client';
import {useState} from 'react';
import {serviceNames} from './SlotEditor';
import ClinicalNotes from './ClinicalNotes';
type Session={id:string;service:number;mode:string;starts_at:string;status:string|null};
type Props={en:boolean;busy:boolean;run:(f:()=>Promise<void>)=>Promise<void>;request:(path:string,opts?:RequestInit)=>Promise<any>};
export default function SpecialistDesk({en,busy,run,request}:Props){
 const t=(a:string,b:string)=>en?b:a;const [period,setPeriod]=useState('upcoming'),[rows,setRows]=useState<Session[]>([]),[earnings,setEarnings]=useState<{month:string;sessions:number;total_irr:string}[]>([]),[page,setPage]=useState(0),[more,setMore]=useState(false);
 const api='/api/v1/specialist';
 async function load(p=period,n=page){const d=await request(`${api}/sessions?period=${p}&page=${n}`);setRows(d.items);setMore(d.more);setPeriod(p);setPage(n)}
 async function loadEarnings(){setEarnings(await request(api+'/earnings'))}
 return <>
  <details className="desk-item" onToggle={e=>{if(e.currentTarget.open)void run(()=>load())}}><summary>{t('برنامهٔ جلسات حرفه‌ای من','My professional schedule')}</summary><p>{t('فقط جلسات قطعی؛ بدون اطلاعات بالینی.','Confirmed sessions only; no clinical data.')}</p><div className="desk-tabs">{['upcoming','past'].map(p=><button key={p} disabled={busy} aria-pressed={period===p} onClick={()=>run(()=>load(p,0))}>{p==='past'?t('پایان‌یافته','Ended'):t('پیش رو و در حال برگزاری','Upcoming')}</button>)}<button disabled={busy} onClick={()=>run(()=>load())}>{t('تازه‌سازی','Refresh')}</button></div>{rows.map(s=><article key={s.id} className="desk-item"><strong>{serviceNames[s.service][+en]} · {s.mode==='online'?t('آنلاین','Online'):t('حضوری','In person')}</strong><p>{new Date(s.starts_at).toLocaleString(en?'en-GB':'fa-IR',{timeZone:'Asia/Tehran',dateStyle:'medium',timeStyle:'short'})} ({t('تهران','Tehran')})</p>{period==='past'&&<small>{s.status==='attended'?t('حضور ثبت شده','Marked present'):s.status==='absent'?t('عدم حضور ثبت شده','Marked absent'):t('حضور ثبت نشده','Not recorded')}</small>}</article>)}{!rows.length&&!busy&&<p>{t('جلسه‌ای در این فهرست نیست.','No sessions in this list.')}</p>}{page>0&&<button disabled={busy} onClick={()=>run(()=>load(period,page-1))}>{t('قبلی','Previous')}</button>}{more&&<button disabled={busy} onClick={()=>run(()=>load(period,page+1))}>{t('بعدی','Next')}</button>}</details>
  <details className="desk-item" onToggle={e=>{if(e.currentTarget.open)void run(loadEarnings)}}><summary>{t('خلاصهٔ درآمد ۱۲ ماه اخیر','Earnings summary, last 12 months')}</summary><p>{t('مجموع پرداخت‌های تأییدشدهٔ جلسات؛ واریزی بانکی جدا باید با گزارش مالی تطبیق داده شود.','Totals of verified session payments; bank settlement must be reconciled with the finance report.')}</p>{earnings.length===0&&<p>{t('پرداختی در این بازه ثبت نشده است.','No payments in this period.')}</p>}{earnings.map(e=><p key={e.month}><bdi>{e.month}</bdi> · {e.sessions} {t('جلسه','sessions')} · {Number(e.total_irr).toLocaleString(en?'en-GB':'fa-IR')} {t('ریال','IRR')}</p>)}</details>
  <ClinicalNotes en={en} busy={busy} run={run} request={request}/>
 </>;
}
