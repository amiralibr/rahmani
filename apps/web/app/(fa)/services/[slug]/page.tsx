import ServicePage from "../../../ServicePage";
import {services} from "../../../services";
export function generateStaticParams(){return services.map(s=>({slug:s.slug}))}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const s=services.find(x=>x.slug===slug)!;return {title:s.name[0]+" | مرکز دکتر رحمانی",description:s.lead[0],alternates:{canonical:"/services/"+slug+"/",languages:{fa:"/services/"+slug+"/",en:"/en/services/"+slug+"/"}}}}
export default async function Page({params}:{params:Promise<{slug:string}>}){return <ServicePage en={false} slug={(await params).slug}/>}
