import {Body,Controller,Get,Header,Inject,Patch,Req,UseGuards} from '@nestjs/common';
import {IsIn,Length} from 'class-validator';
import {DataSource,MigrationInterface,QueryRunner} from 'typeorm';
import {ManagerGuard} from './panels';
export const settingKeys=['phone','email','address_fa','address_en','hours_fa','hours_en','instagram','telegram','website'] as const;
export class SiteSettings1795046400031 implements MigrationInterface{
 async up(q:QueryRunner){await q.query(`CREATE TABLE site_settings(key text PRIMARY KEY CHECK(key ~ '^[a-z_]{2,32}$'), value text NOT NULL CHECK(char_length(value) BETWEEN 1 AND 300), updated_by uuid REFERENCES staff_accounts(id), updated_at timestamptz NOT NULL DEFAULT now())`)}
 async down(q:QueryRunner){await q.query('DROP TABLE site_settings')}
}
class Setting{@IsIn(settingKeys as unknown as string[]) key!:string; @Length(0,300) value!:string}
@Controller('api/v1/site') export class SiteSettingsController{constructor(@Inject(DataSource) private db:DataSource){}
 @Get('settings') @Header('Cache-Control','public, max-age=60') async settings(){const rows=await this.db.query('SELECT key,value FROM site_settings WHERE key=ANY($1)',[settingKeys]);return Object.fromEntries(rows.map((r:{key:string;value:string})=>[r.key,r.value]))}
 @Patch('settings') @UseGuards(ManagerGuard) @Header('Cache-Control','no-store') async save(@Body() b:Setting,@Req() req:{staff:{id:string}}){const v=b.value.trim();if(v){await this.db.query('INSERT INTO site_settings(key,value,updated_by,updated_at) VALUES($1,$2,$3,now()) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_by=excluded.updated_by,updated_at=now()',[b.key,v,req.staff.id])}else await this.db.query('DELETE FROM site_settings WHERE key=$1',[b.key]);return {ok:true}}
}
