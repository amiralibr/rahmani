import Academy from "../../../Academy";
import {courses} from "../../../courses";
export function generateStaticParams(){return courses.map(({id})=>({id}))}
export default async function Page({params}:{params:Promise<{id:string}>}){return <Academy en={true} id={(await params).id}/>;}
