/** Do not infer a currency or present unknown historical fees as free. */
export function formatFee(rials:number|null|undefined,en:boolean){
 if(rials==null)return en?'Fee not specified':'تعرفه اعلام نشده است';
 const amount=new Intl.NumberFormat(en?'en-GB':'fa-IR').format(rials);
 return en?`Session fee: ${amount} IRR`:`تعرفهٔ جلسه: ${amount} ریال`;
}
