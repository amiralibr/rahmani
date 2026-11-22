'use client';
import {useEffect,useState} from 'react';
export default function SaveCourse({id,en}:{id:string;en:boolean}){
 const [state,set]=useState<'loading'|'guest'|'saved'|'available'|'error'>('loading'),[busy,work]=useState(false),[attempt,retry]=useState(0);
 const t=(fa:string,eng:string)=>en?eng:fa, url='/api/v1/client/library';
 useEffect(()=>{const controller=new AbortController();set('loading');fetch(url,{cache:'no-store',signal:controller.signal}).then(async r=>{if(r.status===401){set('guest');return}if(!r.ok)throw Error();set((await r.json()).includes(id)?'saved':'available')}).catch(()=>{if(!controller.signal.aborted)set('error')});return ()=>controller.abort()},[id,attempt]);
 async function toggle(){work(true);try{const r=await fetch(url+'/'+id,{method:state==='saved'?'DELETE':'POST',headers:{'X-Rahmani-Client':'1'}});if(r.status===401)set('guest');else if(r.ok)set((await r.json()).saved?'saved':'available');else set('error')}catch{set('error')}finally{work(false)}}
 return <section className="course-save"><strong>{t('کتابخانهٔ شخصی','Personal library')}</strong><p>{t('ذخیره برای مرور بعدی است؛ ثبت‌نام یا رزرو ظرفیت نیست.','Save for later. This does not enrol you or reserve a place.')}</p>{state==='guest'?<a className="back" href={(en?'/en/':'/')+'account/'}>{t('ورود به حساب مراجع','Sign in to your account')}</a>:state==='error'?<button onClick={()=>retry(attempt+1)}>{t('دریافت کتابخانه ناموفق بود؛ تلاش دوباره','Library unavailable; retry')}</button>:<button disabled={busy||state==='loading'} aria-pressed={state==='saved'} onClick={toggle}>{state==='loading'?t('در حال دریافت…','Loading…'):state==='saved'?t('ذخیره شده · حذف از کتابخانه','Saved · remove from library'):t('ذخیره در کتابخانه','Save to library')}</button>}</section>;
}
