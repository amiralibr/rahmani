const services=[['مشاوره فردی','خودشناسی و رشد فردی','brain','#e4eee3','#4a7150','برای گفت‌وگو درباره نگرانی‌ها، احساسات و چالش‌های زندگی روزمره.'],['زوج‌درمانی','گفت‌وگو و بهبود رابطه','heart-handshake','#f7e9df','#986949','برای زوج‌هایی که می‌خواهند الگوهای ارتباطی خود را بهتر بشناسند.'],['مشاوره خانواده','همراهی در چالش‌های خانواده','users','#e9e7f4','#786695','برای بررسی تعارض‌ها و یافتن راه‌های گفت‌وگوی سازنده در خانواده.'],['کودک و نوجوان','رشد هیجانی و ارتباط با والدین','baby','#faf0d8','#916d28','برای والدینی که درباره رشد، رفتار یا ارتباط با فرزند خود پرسش دارند.']];
const icon=n=>`<svg aria-hidden="true"><use href="icons.svg#${n}"></use></svg>`;
document.querySelectorAll('[data-i]').forEach(e=>e.innerHTML=icon(e.dataset.i));
const dialog=document.querySelector('dialog'),detail=document.querySelector('#detail');
function openPanel(html){detail.innerHTML=html;if(!dialog.open)dialog.showModal()}
function booking(index=0){location.assign(`profile.html?service=${index}#calendar`)}
const cards=document.querySelector('#cards');services.forEach(([title,sub,id,bg,fg],i)=>{const b=document.createElement('button');b.className='card';b.style=`--bg:${bg};--fg:${fg}`;b.innerHTML=`<b>${icon(id)}</b><strong>${title}<span class="go">${icon('chevron-left')}</span></strong><small>${sub}</small>`;b.onclick=()=>booking(i);cards.append(b)});
document.querySelectorAll('[data-book]').forEach(b=>b.onclick=()=>booking());document.querySelector('#close').onclick=()=>dialog.close();document.querySelectorAll('[data-info]').forEach(b=>b.onclick=()=>openPanel(`<h2>${b.textContent}</h2><p>${b.dataset.info==='online'?'جلسه آنلاین برای گفت‌وگو از فضای خصوصی شما طراحی می‌شود. در نسخه فعلی، اتاق جلسه فعال نیست.':'این مرکز برای ارائه خدمات روان‌شناسی، مشاوره و آموزش به صورت حضوری و آنلاین طراحی شده است.'}</p>`));

// Start visible by default: older browsers and reduced-motion users lose no content.
if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const observer = new IntersectionObserver(entries => {
    for (const { target, isIntersecting } of entries) {
      if (!isIntersecting) continue;
      target.classList.remove('waiting');
      observer.unobserve(target);
    }
  }, { threshold: 0.12 });
  document.querySelectorAll('.services-intro, .card, footer').forEach((el, i) => {
    if (el.matches('.card')) el.style.setProperty('--delay', `${(i - 1) * 55}ms`);
    el.classList.add('reveal', 'waiting');
    observer.observe(el);
  });
}
