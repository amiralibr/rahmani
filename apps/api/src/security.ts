import {NextFunction,Request,Response} from 'express';
/** Baseline security headers (OWASP secure headers). CSP allows inline scripts/styles because the statically exported Next.js app embeds them. */
export function securityHeaders(req:Request,res:Response,next:NextFunction){
 const https=(process.env.PUBLIC_ORIGIN||'').startsWith('https://');
 const csp=["default-src 'self'","script-src 'self' 'unsafe-inline'","style-src 'self' 'unsafe-inline'","img-src 'self' data:","font-src 'self'","connect-src 'self'","object-src 'none'","base-uri 'self'","frame-ancestors 'none'","form-action 'self'","worker-src 'self'",...(https?['upgrade-insecure-requests']:[])].join('; ');
 res.setHeader('Content-Security-Policy',csp);
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('X-Frame-Options','DENY');
 res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
 res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=(), payment=(), usb=()');
 res.setHeader('Cross-Origin-Opener-Policy','same-origin');
 res.setHeader('Cross-Origin-Resource-Policy','same-origin');
 res.setHeader('X-XSS-Protection','0');
 if(https)res.setHeader('Strict-Transport-Security','max-age=15552000; includeSubDomains');
 next();
}
