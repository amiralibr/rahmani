import {articles} from './articles';
import {courses} from './courses';
import {serviceSlugs} from './services';
export const dynamic='force-static';
const site=(process.env.NEXT_PUBLIC_SITE_URL||'http://localhost:8080').replace(/\/+$/,'');
export default function sitemap(){
 const fa=(p:string)=>({url:site+'/'+p,lastModified:new Date(),alternates:{languages:{fa:site+'/'+p,en:site+'/en/'+p}}});
 const paths=['','about/','contact/','academy/','journal/','academy/verify/','search/','profile/'];
 const servicePaths=serviceSlugs.map(s=>'services/'+s+'/');
 const articlePaths=articles.map(a=>'journal/'+a.slug+'/');
 const coursePaths=courses.map(c=>'academy/'+c.id+'/');
 return [...paths,...servicePaths,...articlePaths,...coursePaths].map(fa);
}
