import Foot from './Foot';
export default function NotFound(){
 const en=false;
 return <><header><div className="wrap bar"><a className="brand" href="/"><b className="mark"><svg aria-hidden="true"><use href="/icons.svg#sprout"/></svg></b><span>مرکز دکتر رحمانی<small>روان‌شناسی و مشاوره</small></span></a></div><span className="scroll-progress" aria-hidden="true"><i/></span></header><main id="main" className="wrap article-page"><p className="eyebrow">۴۰۴ · صفحه پیدا نشد</p><h1>این صفحه در دسترس نیست</h1><p className="lead">نشانی اشتباه است یا صفحه جابه‌جا شده. Page not found.</p><p><a className="solid" href="/">بازگشت به خانه</a> <a className="outline" href="/search/">جست‌وجو در سایت</a></p></main><Foot en={en}/></>;
}
