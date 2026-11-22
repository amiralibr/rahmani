'use client';
import {useEffect,useState} from 'react';
export type Address={name_fa:string;name_en:string;address_fa:string;address_en:string};
export type Branch=Address&{id:string};
export function locationLabel(branch:Address|null|undefined,en:boolean){return branch?en?`${branch.name_en} · ${branch.address_en}`:`${branch.name_fa} · ${branch.address_fa}`:''}
export function BranchDirectory({en}:{en:boolean}){
 const [rows,setRows]=useState<Branch[]|null>(null),[failed,setFailed]=useState(false),[retry,setRetry]=useState(0);const t=(a:string,b:string)=>en?b:a;
 useEffect(()=>{const c=new AbortController();setFailed(false);fetch('/api/v1/branches',{cache:'no-store',signal:c.signal}).then(r=>{if(!r.ok)throw Error();return r.json()}).then(setRows).catch(()=>{if(!c.signal.aborted)setFailed(true)});return()=>c.abort()},[retry]);
 return <section className="desk-item" data-reveal><div className="eyebrow">{t('مراجعهٔ حضوری','Visiting in person')}</div><h2>{t('شعب مرکز','Centre locations')}</h2>{failed?<button className="outline" onClick={()=>setRetry(n=>n+1)}>{t('دریافت نشد · تلاش مجدد','Could not load · retry')}</button>:rows===null?<p>{t('در حال دریافت…','Loading…')}</p>:rows.length?rows.map(b=><article className="desk-item" key={b.id}><strong>{en?b.name_en:b.name_fa}</strong><address>{en?b.address_en:b.address_fa}</address></article>):<p>{t('هنوز نشانی شعبه‌ای منتشر نشده است. پیش از مراجعه با پذیرش هماهنگ کنید.','No location has been published yet. Contact reception before visiting.')}</p>}</section>;
}
export function BranchForm({en,onCreate,busy}:{en:boolean;onCreate:(b:Address)=>Promise<void>;busy:boolean}){
 const t=(a:string,b:string)=>en?b:a;return <details className="desk-item"><summary>{t('افزودن شعبهٔ تأییدشده','Add an approved location')}</summary><p>{t('نام و نشانی عمومی شعبه بلافاصله در صفحهٔ تماس منتشر می‌شوند.','The location name and public address will appear immediately on the contact page.')}</p><form onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;const d=new FormData(form);await onCreate(Object.fromEntries(d) as Address)}}>{(['name_fa','name_en','address_fa','address_en'] as const).map((k,i)=><label key={k}>{[t('نام فارسی','Persian name'),t('نام انگلیسی','English name'),t('نشانی فارسی','Persian address'),t('نشانی انگلیسی','English address')][i]}<input name={k} required maxLength={i<2?90:240} dir={i%2?'ltr':'rtl'}/></label>)}<button disabled={busy} className="outline">{t('انتشار شعبه','Publish location')}</button></form></details>;
}
