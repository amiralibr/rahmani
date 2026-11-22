import "../globals.css";
const site=process.env.NEXT_PUBLIC_SITE_URL||'http://localhost:8080';
const jsonLd={"@context":"https://schema.org","@type":"Organization",name:"مرکز روان‌شناسی دکتر رحمانی",url:site,logo:site+"/icons.svg"};
export const metadata={metadataBase:new URL(site),title:{default:"مرکز روان‌شناسی دکتر رحمانی",template:"%s"},description:"مرکز تخصصی روان‌شناسی و مشاوره حضوری و آنلاین.",openGraph:{type:"website",siteName:"مرکز روان‌شناسی دکتر رحمانی",title:"مرکز روان‌شناسی دکتر رحمانی",description:"مرکز تخصصی روان‌شناسی و مشاوره حضوری و آنلاین.",images:["/assets/counselling.jpg"],locale:"fa_IR"},robots:{index:true,follow:true}};
export const viewport={themeColor:'#14332b'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="fa" dir="rtl"><head><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(jsonLd)}}/></head><body><a className="skip" href="#main">رفتن به محتوای اصلی</a>{children}</body></html>}
