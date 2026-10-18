import sharp from 'sharp';
export async function personalFile(data:unknown,mime:unknown){
 if(typeof data!=='string'||data.length>2666668||!/^[A-Za-z0-9+/]+={0,2}$/.test(data))throw new Error('Choose a PDF, JPEG or PNG below 2 MB.');
 const input=Buffer.from(data,'base64');
 if(!input.length||input.length>2000000)throw new Error('Choose a document below 2 MB.');
 if(mime==='application/pdf'){
  if(input.subarray(0,5).toString()!=='%PDF-')throw new Error('This file is not a PDF.');
  // PDFs remain unscanned. Never inline-render or share them; owner-only attachment download.
  return {data:input.toString('base64'),mime:'application/pdf'};
 }
 const jpeg=input.subarray(0,3).equals(Buffer.from('ffd8ff','hex'));
 const png=input.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'));
 if(!(mime==='image/jpeg'&&jpeg||mime==='image/png'&&png))throw new Error('Choose a valid JPEG or PNG.');
 // Decode/re-encode pixels to remove metadata and embedded original payloads. Do not claim malware scanning.
 const output=await sharp(input,{limitInputPixels:25000000,failOn:'warning'}).rotate().resize({width:4096,height:4096,fit:'inside',withoutEnlargement:true}).flatten({background:'#fff'}).jpeg({quality:90}).toBuffer();
 if(output.length>2000000)throw new Error('This image is too large after processing. Choose a smaller image.');
 return {data:output.toString('base64'),mime:'image/jpeg'};
}
