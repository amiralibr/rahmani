import {BadRequestException,Body,ConflictException,Controller,Get,Header,Inject,Param,Patch,ParseUUIDPipe,Post,Query,Req,UseGuards} from '@nestjs/common';
import {IsEmail,IsIn,Length} from 'class-validator';
import {randomUUID} from 'node:crypto';
import {DataSource,MigrationInterface,QueryRunner} from 'typeorm';
import {ReceptionGuard} from './reception';
const states=['new','in_progress','closed'];
export class Feedback1795046400032 implements MigrationInterface{
 async up(q:QueryRunner){await q.query(`CREATE TABLE feedback(id uuid PRIMARY KEY,email text NOT NULL CHECK(email ~* '^[^@\\s]{1,64}@[^@\\s]{1,255}\\.[^@\\s]{2,}$'),topic text NOT NULL CHECK(topic IN ('complaint','feedback','suggestion')),message text NOT NULL CHECK(char_length(message) BETWEEN 10 AND 2000),locale text NOT NULL CHECK(locale IN ('fa','en')),status text NOT NULL DEFAULT 'new' CHECK(status IN ('new','in_progress','closed')),created_at timestamptz NOT NULL DEFAULT now())`);await q.query('CREATE INDEX feedback_status ON feedback(status,created_at DESC)')}
 async down(q:QueryRunner){await q.query('DROP TABLE feedback')}
}
class Feedback{@IsEmail() email!:string; @IsIn(['complaint','feedback','suggestion']) topic!:string; @Length(10,2000) message!:string; @IsIn(['fa','en']) locale!:string}
class Update{@IsIn(states) previous!:string; @IsIn(states) status!:string}
@Controller('api/v1/feedback') export class FeedbackController{constructor(@Inject(DataSource) private db:DataSource){}
 @Post() submit(@Body() b:Feedback){return this.db.query('INSERT INTO feedback(id,email,topic,message,locale) VALUES($1,$2,$3,$4,$5) RETURNING id',[randomUUID(),b.email.trim().toLowerCase(),b.topic,b.message.trim(),b.locale]).then(r=>({reference:r[0].id}))}
}
@Controller('api/v1/reception/feedback') @UseGuards(ReceptionGuard) export class FeedbackQueueController{constructor(@Inject(DataSource) private db:DataSource){}
 @Get() @Header('Cache-Control','no-store') list(@Query('status') status='new',@Query('page') page='0'){if(!states.includes(status)||!/^\d{1,6}$/.test(page))throw new BadRequestException();return this.db.query('SELECT id,topic,message,locale,created_at,status FROM feedback WHERE status=$1 ORDER BY created_at DESC LIMIT 21 OFFSET $2',[status,Number(page)*20]).then(rows=>({items:rows.slice(0,20),more:rows.length>20}))}
 @Patch(':id') @Header('Cache-Control','no-store') async change(@Param('id',ParseUUIDPipe) id:string,@Body() body:Update,@Req() req:{staff:{id:string}}){const rows=await this.db.query('WITH u AS (UPDATE feedback SET status=$2 WHERE id=$1 AND status=$3 RETURNING id) SELECT id FROM u',[id,body.status,body.previous]);if(!rows.length)throw new ConflictException('Refresh the queue');return {updated:true}}
}
