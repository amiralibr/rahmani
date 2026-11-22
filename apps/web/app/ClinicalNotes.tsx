'use client';
import {useState} from 'react';
type Session={id:string;service:number;starts_at:string};
type Meta={id:string;record_type:'session'|'intake'|'note';created_at:string};
const typeName=(v:string,en:boolean)=>({session:en?'Session':'جلسه',intake:en?'Intake':'پذیرش اولیه',note:en?'Note':'یادداشت'}[v]||v);
export default function ClinicalNotes({en,busy,run,request}:{en:boolean;busy:boolean;run:(f:()=>Promise<void>)=>Promise<void>;request:(path:string,opts?:RequestInit)=>Promise<any>}){
 const t=(a:string,b:string)=>en?b:a;const [sessions,setSessions]=useState<Session[]>([]),[slot,setSlot]=useState(''),[items,setItems]=useState<Meta[]>([]),[open,setOpen]=useState<{id:string;content:string}|null>(null),[msg,setMsg]=useState('');
 async function loadSessions(){const [a,b]=await Promise.all([request('/api/v1/specialist/sessions?period=upcoming&page=0'),request('/api/v1/specialist/sessions?period=past&page=0')]);setSessions([...a.items,...b.items])}
 async function loadList(id:string){setSlot(id);setOpen(null);setItems(id?await request('/api/v1/clinical/records?slot_id='+id):[])}
 return <details className="desk-item" onToggle={e=>{if(e.currentTarget.open)void run(loadSessions)}}><summary>{t('یادداشت‌های بالینی (محرمانه)','Clinical notes (confidential)')}</summary><p><strong>{t('این بخش دادهٔ بالینی ذخیره می‌کند.','This section stores clinical data.')}</strong>{' '}{t('متن با کلید جداگانهٔ CLINICAL_KEY در سرور رمزنگاری می‌شود؛ مدیر و پذیرش به آن دسترسی ندارند؛ هر بار باز کردن ثبت می‌شود. فقط برای نوبت‌های قطعی بنویسید.','Content is encrypted server-side with a separate CLINICAL_KEY; managers and reception cannot read it; every open is logged. Write only for confirmed sessions.')}</p>
  <label>{t('جلسه','Session')}<select value={slot} onChange={e=>void run(()=>loadList(e.target.value))}><option value="">{t('انتخاب جلسه…','Choose a session…')}</option>{sessions.map(s=><option key={s.id} value={s.id}>{new Date(s.starts_at).toLocaleString(en?'en-GB':'fa-IR',{timeZone:'Asia/Tehran',dateStyle:'medium',timeStyle:'short'})}</option>)}</select></label>
  {slot&&<>
   <form onSubmit={e=>{e.preventDefault();const f=e.currentTarget,v=new FormData(f);const content=String(v.get('content')||'').trim();if(!content)return;void run(async()=>{await request('/api/v1/clinical/records',{method:'POST',body:JSON.stringify({slot_id:slot,record_type:v.get('record_type'),content})});f.reset();setMsg(t('یادداشت ثبت شد.','Note saved.'));setItems(await request('/api/v1/clinical/records?slot_id='+slot))})}}><label>{t('نوع','Type')}<select name="record_type"><option value="session">{t('جلسه','Session')}</option><option value="intake">{t('پذیرش اولیه','Intake')}</option><option value="note">{t('یادداشت','Note')}</option></select></label><label>{t('متن یادداشت (حداکثر ۴۰۰۰ نویسه)','Note (max 4000 characters)')}<textarea name="content" required minLength={1} maxLength={4000} rows={4}/></label><button disabled={busy} className="outline">{t('ثبت یادداشت','Save note')}</button></form>
   {items.map(i=><article key={i.id} className="desk-item"><small>{typeName(i.record_type,en)} · {new Date(i.created_at).toLocaleString(en?'en-GB':'fa-IR',{timeZone:'Asia/Tehran'})}</small><button disabled={busy} className="outline" onClick={()=>void run(async()=>{const r=await request('/api/v1/clinical/records/'+i.id);setOpen({id:i.id,content:r.content})})}>{t('خواندن (ثبت در گزارش دسترسی)','Read (logged)')}</button>{open?.id===i.id&&<p dir="auto">{open.content}</p>}</article>)}
   {!items.length&&<p>{t('هنوز یادداشتی برای این جلسه نیست.','No notes for this session yet.')}</p>}
  </>}
  <p role="status">{msg}</p>
 </details>;
}
