'use client';
import './journal.css';
import {useMemo,useState} from 'react';
import {serviceSlugs,services} from './services';
import Foot from './Foot';
import {courses} from './courses';
import {articles} from './articles';
export default function Search({en}:{en:boolean}){
 const l=en?1:0,t=(a:string,b:string)=>en?b:a,home=en?'/en/':'/';const [query,setQuery]=useState('');
 const normalize=(s:string)=>s.normalize('NFKC').replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/[\u200c\s]+/g,' ').trim().toLowerCase();
 const items=useMemo(()=>{
  const pages=[{href:home+'about/',kind:t('صفحه','Page'),title:t('دربارهٔ مرکز','About the centre'),text:t('مأموریت، ارزش‌ها و ساختار مرکز','Mission, values and structure')},{href:home+'contact/',kind:t('صفحه','Page'),title:t('تماس با مرکز','Contact'),text:t('درخواست تماس با پذیرش','Request a call')},{href:home+'academy/',kind:t('صفحه','Page'),title:t('آکادمی رحمانی','Rahmani Academy'),text:t('دوره‌ها و کارگاه‌های آموزشی','Courses and workshops')},{href:home+'journal/',kind:t('صفحه','Page'),title:t('مجلهٔ روان‌شناسی','Psychology journal'),text:t('یادداشت‌های آموزشی','Educational articles')},{href:home+'profile/',kind:t('صفحه','Page'),title:t('معرفی مشاور و رزرو وقت','Counsellor & booking'),text:t('مشاهدهٔ تقویم جلسات','View the calendar')}];
  const svc=services.map(s=>({href:home+'services/'+s.slug+'/',kind:t('خدمت','Service'),title:s.name[l],text:s.lead[l]}));
  const crs=courses.map(c=>({href:home+'academy/'+c.id+'/',kind:t('دوره','Course'),title:c.title[l],text:c.intro[l]}));
  const art=articles.map(a=>({href:home+'journal/'+a.slug+'/',kind:t('مقاله','Article'),title:a.title[l],text:a.lead[l]}));
  return [...pages,...svc,...crs,...art];
 },[en,home,l,t]);
 const q=normalize(query);const results=q?items.filter(i=>normalize(i.title+' '+i.text).includes(q)):items;
 return <><header><div className="wrap bar"><a className="brand" href={home}><b className="mark"><svg aria-hidden="true"><use href="/icons.svg#sprout"/></svg></b><span>{t('مرکز دکتر رحمانی','Rahmani Centre')}<small>{t('جست‌وجو','Search')}</small></span></a><nav><a href={home}>{t('صفحه اصلی','Home')}</a><a href={home+'services/individual/'}>{t('خدمات','Services')}</a><a href={home+'academy/'}>{t('آکادمی','Academy')}</a><a href={home+'journal/'}>{t('مجله','Journal')}</a></nav><a className="lang" href={(en?'/':'/en/')+'search/'} hrefLang={en?'fa':'en'} aria-label={en?'Switch to Persian':'Switch to English'}><svg aria-hidden="true" className="i-lang"><use href="/icons.svg#languages"/></svg><span>{en?'فارسی':'English'}</span></a></div><span className="scroll-progress" aria-hidden="true"><i/></span></header><main id="main" className="search wrap"><h1>{t('جست‌وجو در سایت','Search the site')}</h1><label>{t('عبارت جست‌وجو','Search query')}<input autoFocus type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder={t('مثلاً: مشاوره زوج، ذهن‌آگاهی…','e.g. couples counselling, mindfulness…')}/></label><small role="status">{results.length.toLocaleString(en?'en':'fa')} {t('نتیجه','results')}</small>{results.map(r=><a key={r.href} className="journal-row" href={r.href}><div><small>{r.kind}</small><h3>{r.title}</h3><p>{r.text}</p></div><b aria-hidden="true">{en?'→':'←'}</b></a>)}{!results.length&&<p>{t('نتیجه‌ای پیدا نشد؛ عبارت دیگری امتحان کنید.','No matches; try another phrase.')}</p>}</main><Foot en={en}/></>;
}
