import {test} from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {projectImage} from '../lib/project-image.ts';
test('project image rejects disguised SVG/non-images and mismatched file types',async()=>{
 await assert.rejects(projectImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><image href="file:///etc/passwd"/></svg>'),'image/png'));
 const png=await sharp({create:{width:2,height:2,channels:3,background:'#fff'}}).png().toBuffer();
 await assert.rejects(projectImage(png,'image/jpeg'));
 await assert.rejects(projectImage(Buffer.alloc(2000001),'image/png'));
});
test('project image becomes bounded RGB pixels with no original metadata/file payload',async()=>{
 const png=await sharp({create:{width:2048,height:1024,channels:4,background:{r:255,g:255,b:255,alpha:1}}}).png().toBuffer();
 const image=await projectImage(png,'image/png');assert.equal(image.width,1024);assert.equal(image.height,512);assert.equal(Buffer.from(image.pixels,'base64').length,1024*512*3);
 const jpeg=await sharp(Buffer.from(image.pixels,'base64'),{raw:{width:image.width,height:image.height,channels:3}}).jpeg().toBuffer();const meta=await sharp(jpeg).metadata();assert.equal(meta.format,'jpeg');assert.equal(meta.exif,undefined);
});
