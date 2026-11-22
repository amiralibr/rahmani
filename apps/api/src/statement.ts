import {BadRequestException,ForbiddenException} from '@nestjs/common';
import {IsString,MaxLength} from 'class-validator';
import {DataSource} from 'typeorm';
export class StatementInput { @IsString() @MaxLength(8000) rows!:string; }
// Only redacted debit references and positive integer rials, never a full bank export.
export function parseStatement(text:string){
 const lines=text.replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).trim().split(/\r?\n/);if(lines.length>100)throw new BadRequestException();
 const seen=new Set<string>();return lines.map(line=>{const m=/^\s*([a-zA-Z0-9-]{4,64})\s*[,،]\s*([1-9][0-9]{0,12})\s*$/.exec(line);if(!m)throw new BadRequestException();const reference=m[1].toUpperCase();if(seen.has(reference))throw new BadRequestException();seen.add(reference);return {reference,amount:Number(m[2])}});
}
export async function compareStatement(db:DataSource,staff:string,text:string){
 const [access]=await db.query("SELECT id FROM staff_accounts WHERE id=$1 AND active AND role='reception' AND refund_approver",[staff]);if(!access)throw new ForbiddenException();
 const rows=parseStatement(text);const receipts=await db.query('SELECT reference,amount_irr FROM refund_receipts WHERE reference=ANY($1::text[])',[rows.map(r=>r.reference)]);const amounts=new Map<string,number>(receipts.map((r:{reference:string;amount_irr:number})=>[r.reference,r.amount_irr]));return rows.map(r=>({...r,receipt:amounts.get(r.reference)??null,status:!amounts.has(r.reference)?'unknown':amounts.get(r.reference)===r.amount?'matched':'different'}));
}
