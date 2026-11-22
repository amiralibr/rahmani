export const dynamic='force-static';
const site=process.env.NEXT_PUBLIC_SITE_URL||'http://localhost:8080';
export default function robots(){return {rules:{userAgent:'*',allow:'/',disallow:['/account/','/reception/','/en/account/','/en/reception/','/api/']},sitemap:site+'/sitemap.xml'}}
