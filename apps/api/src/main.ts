import 'reflect-metadata';
import { Module, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import {json} from 'express';
import { rateLimit } from 'express-rate-limit';
import { resolve } from 'node:path';
import { ContactModule } from './contact';
import { securityHeaders } from './security';
@Module({imports:[ContactModule]}) class AppModule {}
async function main(){
  const app=await NestFactory.create<NestExpressApplication>(AppModule,{logger:['error','warn']});
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.use(securityHeaders);
  app.use('/api/v1/reception/sessions/finance/statement',json({limit:'24kb'}));
  app.use('/api/v1/journal/submissions',json({limit:'64kb'}));
  app.useBodyParser('json',{limit:'4kb'});
  app.use(['/api/v1/client/register','/api/v1/client/login','/api/v1/client/recovery'],rateLimit({windowMs:15*60*1000,limit:12,standardHeaders:'draft-7',legacyHeaders:false}));
  app.use('/api/v1/holds',rateLimit({windowMs:60*1000,limit:5,skip:req=>req.method!=='POST',standardHeaders:'draft-7',legacyHeaders:false}));
  app.use(['/api/v1/contact-requests','/api/v1/journal/submissions','/api/v1/feedback','/api/v1/reception/cash','/api/v1/clinical'],rateLimit({windowMs:15*60*1000,limit:15,standardHeaders:'draft-7',legacyHeaders:false}));
  app.use('/api/v1/staff/login',rateLimit({windowMs:15*60*1000,limit:10,legacyHeaders:false,standardHeaders:'draft-7'}));
  app.use('/api/v1/reception',rateLimit({windowMs:15*60*1000,limit:12,skipSuccessfulRequests:true,legacyHeaders:false,standardHeaders:'draft-7'}));
  app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,validationError:{target:false,value:false}}));
  app.useStaticAssets(resolve(process.env.WEB_ROOT||'../web/out'),{index:'index.html'});
  await app.listen(Number(process.env.PORT||8080),'0.0.0.0');
}
void main();
