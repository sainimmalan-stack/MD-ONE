/** CSV quotes alone do not stop spreadsheet formula interpretation. */
export function personalExpensesCsv(expenses:{date:string;description:string;category:string;kind:string;amount:number}[]){
 const escape=(value:unknown)=>{
  let s=String(value);
  if(/^[\s\u0000-\u001f]*[=+\-@]|^[\t\r\n]/.test(s))s="'"+s;
  return '"'+s.replaceAll('"','""')+'"';
 };
 return [['Date','Description','Category','Type','Amount INR'],...expenses.map(e=>[e.date,e.description,e.category,e.kind,e.amount/100])].map(row=>row.map(escape).join(',')).join('\r\n');
}
