import "../globals.css";
const site=(process.env.NEXT_PUBLIC_SITE_URL||'http://localhost:8080').replace(/\/+$/,'');
const jsonLd={"@context":"https://schema.org","@type":"Organization",name:"Rahmani Counselling Centre",url:site,logo:site+"/icons.svg"};
export const metadata={metadataBase:new URL(site),title:{default:"Rahmani Counselling Centre",template:"%s"},description:"Specialist counselling centre, in person and online.",openGraph:{type:"website",siteName:"Rahmani Counselling Centre",title:"Rahmani Counselling Centre",description:"Specialist counselling centre, in person and online.",images:["/assets/counselling.jpg"],locale:"en_GB"},robots:{index:true,follow:true}};
export const viewport={themeColor:'#14332b'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en" dir="ltr"><head><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(jsonLd)}}/></head><body><a className="skip" href="#main">Skip to main content</a>{children}</body></html>}
