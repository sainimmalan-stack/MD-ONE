import sharp from 'sharp';
/** Discard the original file, orientation metadata and ancillary content. */
export async function projectImage(input:Buffer,mime:string){
 const valid=mime==='image/jpeg'?input.subarray(0,3).equals(Buffer.from([255,216,255])):mime==='image/png'?input.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):false;
 if(!valid||input.length>2000000)throw new Error('Use a valid JPEG or PNG below 2 MB.');
 const {data,info}=await sharp(input,{limitInputPixels:25000000,failOn:'warning'}).rotate().resize({width:1024,height:1024,fit:'inside',withoutEnlargement:true}).removeAlpha().toColourspace('srgb').raw().toBuffer({resolveWithObject:true});
 if(info.channels!==3)throw new Error('Could not prepare this image.');return {width:info.width,height:info.height,pixels:data.toString('base64')};
}
