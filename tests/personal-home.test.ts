import {test} from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {personalFile} from '../lib/personal-file.ts';
import {amortize} from '../lib/finance.ts';
test('personal files reject spoofed formats, corrupt images and oversized files',async()=>{
 await assert.rejects(personalFile(Buffer.from('<svg>bad</svg>').toString('base64'),'image/png'));
 await assert.rejects(personalFile(Buffer.from('not a pdf').toString('base64'),'application/pdf'));
 await assert.rejects(personalFile(Buffer.alloc(2000001).toString('base64'),'application/pdf'));
 await assert.rejects(personalFile('%%%%','image/jpeg'));
 const png=await sharp({create:{width:2,height:2,channels:3,background:'#fff'}}).png().toBuffer();
 await assert.rejects(personalFile(png.toString('base64'),'image/jpeg'));
});
test('images are re-encoded, metadata removed and PDF bytes remain explicitly unscanned',async()=>{
 const image=await sharp({create:{width:4500,height:2500,channels:4,background:'#fff'}}).withExif({IFD0:{Artist:'PRIVATE TEST METADATA'}}).png().toBuffer();
 const out=await personalFile(image.toString('base64'),'image/png');
 const meta=await sharp(Buffer.from(out.data,'base64')).metadata();
 assert.equal(out.mime,'image/jpeg');assert.equal(meta.exif,undefined);assert.equal(meta.width,4096);
 const pdf=Buffer.from('%PDF-1.4\nTEST fixture only\n%%EOF');const p=await personalFile(pdf.toString('base64'),'application/pdf');assert.deepEqual(Buffer.from(p.data,'base64'),pdf);
});
test('EMI estimates handle zero interest, reducing balance, prepayments and invalid inputs',()=>{
 const z=amortize(12000,0,12);assert.equal(z.emi,1000);assert.equal(z.totalInterest,0);assert.equal(z.schedule.at(-1)?.balance,0);
 const a=amortize(3500000,8.5,240);const b=amortize(3500000,8.5,240,5000);
 assert.ok(Math.abs(a.emi-30373.81)<.1);assert.ok(b.months<a.months);assert.ok(b.totalInterest<a.totalInterest);
 assert.equal(a.schedule.at(-1)?.balance,0);assert.ok(Math.abs(a.totalRepayment-3500000-a.totalInterest)<.02);
 for(const args of [[0,8,12],[100,-1,12],[100,101,12],[100,8,0],[100,8,1.5],[100,8,601],[NaN,8,12]])assert.throws(()=>amortize(...args as [number,number,number]));
});

import {personalExpensesCsv} from '../lib/personal-csv.ts';
test('expense CSV preserves paise and neutralizes formula prefixes including whitespace',()=>{
 const entries=['=1+1','  +CMD','\t@SUM(1)','ordinary "quoted", entry'].map(description=>({description,date:'2026-10-18',category:'Other',kind:'expense',amount:12345}));
 const csv=personalExpensesCsv(entries);assert.ok(csv.includes('"\'=1+1"'));assert.ok(csv.includes('"\'  +CMD"'));assert.ok(csv.includes('"\'\t@SUM(1)"'));assert.ok(csv.includes('"ordinary ""quoted"", entry"'));assert.ok(csv.includes('"123.45"'));
});
