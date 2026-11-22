import Journal from "../../../Journal";
import {articles} from "../../../articles";
export function generateStaticParams(){return articles.map(({slug})=>({slug}));}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const article=articles.find(item=>item.slug===slug);return {title:article?.title[1],description:article?.lead[1]}}
export default async function Page({params}:{params:Promise<{slug:string}>}){return <Journal en={true} slug={(await params).slug}/>;}
