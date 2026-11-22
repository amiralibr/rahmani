import {BadRequestException,ConflictException,Body,Controller,Get,Header,Inject,NotFoundException,Param,Patch,Post,Query,Req,UseGuards} from '@nestjs/common';
import {IsIn,IsEmail,Length,Matches} from 'class-validator';
import {randomUUID} from 'node:crypto';
import {DataSource,MigrationInterface,QueryRunner} from 'typeorm';
import {ManagerGuard} from './panels';
export class Journal1795046400029 implements MigrationInterface {
 async up(q:QueryRunner){await q.query(`CREATE TABLE journal_submissions(id uuid PRIMARY KEY,title text NOT NULL CHECK(char_length(title) BETWEEN 3 AND 200),author text NOT NULL CHECK(char_length(author) BETWEEN 2 AND 80),email text NOT NULL CHECK(email ~* '^[^@\\s]{1,64}@[^@\\s]{1,255}\\.[^@\\s]{2,}$'),abstract text NOT NULL CHECK(char_length(abstract) BETWEEN 10 AND 500),body text NOT NULL CHECK(char_length(body) BETWEEN 100 AND 20000),locale text NOT NULL CHECK(locale IN ('fa','en')),status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected')),submitted_at timestamptz NOT NULL DEFAULT now(),decided_by uuid REFERENCES staff_accounts(id),decided_at timestamptz)`);await q.query('CREATE INDEX journal_status ON journal_submissions(status,submitted_at)')}
 async down(q:QueryRunner){await q.query('DROP TABLE journal_submissions')}
}
class Submission { @Length(3,200) @Matches(/\S/) title!:string; @Length(2,80) @Matches(/\S/) author!:string; @IsEmail() email!:string; @Length(10,500) @Matches(/\S/) abstract!:string; @Length(100,20000) @Matches(/\S/) body!:string; @IsIn(['fa','en']) locale!:'fa'|'en' }
class Decision { @IsIn(['accepted','rejected']) status!:'accepted'|'rejected' }
@Controller('api/v1/journal') export class JournalController{constructor(@Inject(DataSource) private db:DataSource){}
 // Public submission; always accepted as 'pending'. No status is disclosed.
 @Post('submissions') submit(@Body() b:Submission){return this.db.query('INSERT INTO journal_submissions(id,title,author,email,abstract,body,locale) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',[randomUUID(),b.title.trim(),b.author.trim(),b.email.trim().toLowerCase(),b.abstract.trim(),b.body.trim(),b.locale]).then(()=>({ok:true}))}
 // Public reading room: accepted pieces only; email and decisions are never exposed.
 @Get('published') @Header('Cache-Control','public, max-age=60') published(@Query('locale') locale?:string){if(locale&&!['fa','en'].includes(locale))throw new BadRequestException();return this.db.query(`SELECT id,title,author,abstract,body,locale,decided_at AS published_at FROM journal_submissions WHERE status='accepted' ${locale?'AND locale=$1':''} ORDER BY decided_at DESC LIMIT 20`,locale?[locale]:[])}
 // Editorial review; manager role only.
 @Get('submissions') @UseGuards(ManagerGuard) @Header('Cache-Control','no-store') list(@Query('status') status='pending',@Query('page') page='0'){if(!['pending','accepted','rejected'].includes(status)||!/^\d{1,6}$/.test(page))throw new BadRequestException();return this.db.query('SELECT id,title,author,email,abstract,locale,status,submitted_at FROM journal_submissions WHERE status=$1 ORDER BY submitted_at DESC LIMIT 21 OFFSET $2',[status,Number(page)*20]).then(rows=>({items:rows.slice(0,20),more:rows.length>20}))}
 @Get('submissions/:id') @UseGuards(ManagerGuard) @Header('Cache-Control','no-store') async one(@Param('id') id:string){const [row]=await this.db.query('SELECT id,title,author,email,abstract,body,locale,status,submitted_at,decided_at FROM journal_submissions WHERE id=$1',[id]);if(!row)throw new NotFoundException();return row}
 @Patch('submissions/:id') @UseGuards(ManagerGuard) @Header('Cache-Control','no-store') decide(@Param('id') id:string,@Body() b:Decision,@Req() req:{staff:{id:string}}){return this.db.query("WITH u AS (UPDATE journal_submissions SET status=$2,decided_by=$3,decided_at=now() WHERE id=$1 AND status='pending' RETURNING id) SELECT id FROM u",[id,b.status,req.staff.id]).then(r=>{if(!r.length)throw new ConflictException();return {ok:true}})}
}
