import Academy from "../../../Academy";
import {courses} from "../../../courses";
export async function generateMetadata({params}:{params:Promise<{id:string}>}){const {id}=await params;const {courses}=await import("../../../courses");const c=courses.find(x=>x.id===id);return {title:(c?.title?.[0]||"دوره")+" | آکادمی رحمانی",alternates:{canonical:"/academy/"+id+"/",languages:{fa:"/academy/"+id+"/",en:"/en/academy/"+id+"/"}}}}
export function generateStaticParams(){return courses.map(({id})=>({id}))}
export default async function Page({params}:{params:Promise<{id:string}>}){return <Academy en={false} id={(await params).id}/>;}
