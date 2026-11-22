const $ = id => document.getElementById(id);
const form = document.querySelector('form');
const service = $('service');
const initial = Number(new URLSearchParams(location.search).get('service'));
if (Number.isInteger(initial) && initial >= 0 && initial < service.length) service.selectedIndex = initial;
function choices(container, values, selected) {
  $(container).replaceChildren(...values.map((value, i) => {
    const label = document.createElement('label'), radio = document.createElement('input'), text = document.createElement('span');
    radio.type = 'radio'; radio.name = container; radio.value = value; radio.checked = i === selected;
    text.textContent = value; label.append(radio, text); return label;
  }));
}
const tz = 'Asia/Tehran';
const localDate = new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
const part = key => Number(localDate.find(p=>p.type===key).value);
const dayFormat = new Intl.DateTimeFormat('fa-IR',{timeZone:tz,weekday:'short',day:'numeric',month:'short'});
const days = Array.from({length:5},(_,i)=>dayFormat.format(Date.UTC(part('year'),part('month')-1,part('day')+1+i,12)));
choices('modes',['حضوری','آنلاین'],0); choices('days',days,0);
function refreshSlots(){
  const day = days.indexOf(form.elements.days.value);
  const start = (form.elements.modes.value === 'آنلاین' ? 15 : 9) + day % 2;
  choices('slots',[0,1,2].map(n=>(start+n).toLocaleString('fa-IR')+'‌:۰۰'),-1);
}
refreshSlots();
form.addEventListener('change',e=>{
  $('summary').textContent='';
  if(e.target.name!=='slots') refreshSlots();
  $('review').disabled=!form.elements.slots.value;
});
form.onsubmit=e=>{
  e.preventDefault(); const values=new FormData(form);
  if(!values.get('slots')) return;
  $('summary').textContent=`${service.value} · ${values.get('modes')} · ${values.get('days')}، ساعت ${values.get('slots')} به وقت تهران. این انتخاب نمایشی است و نوبتی ثبت نشده است.`;
};
if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches){
  const observer=new IntersectionObserver(entries=>entries.forEach(({target,isIntersecting})=>{if(isIntersecting){target.classList.replace('pending','enter');observer.unobserve(target)}}));
  document.querySelectorAll('.booking-layout > *').forEach(el=>{el.classList.add('pending');observer.observe(el)});
}
