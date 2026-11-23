import Journal from "../../../Journal";
import {articles} from "../../../articles";
export function generateStaticParams(){return articles.map(({slug})=>({slug}));}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const article=articles.find(item=>item.slug===slug);return {title:(article?.title[0]||"مجلهٔ روان‌شناسی")+" | مرکز دکتر رحمانی",description:article?.lead[0],alternates:{canonical:"/journal/"+slug+"/",languages:{fa:"/journal/"+slug+"/",en:"/en/journal/"+slug+"/"}}}}
export default async function Page({params}:{params:Promise<{slug:string}>}){return <Journal en={false} slug={(await params).slug}/>;}
