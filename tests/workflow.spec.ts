import {test,expect} from '@playwright/test';

test('complete local OCR, evidence, permanent redaction, re-verification and safe exports',async({page})=>{
 const errors:string[]=[],external:string[]=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('request',request=>{if(!request.url().startsWith('http://127.0.0.1:4173')&&!request.url().startsWith('blob:')&&!request.url().startsWith('data:'))external.push(request.url());});
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'Share the screenshot. Keep the private parts.'})).toBeVisible();
 await page.screenshot({path:'test-results/overview-desktop.png',fullPage:true});
 await page.getByRole('button',{name:'Try a demo',exact:true}).click();
 await expect(page.getByRole('button',{name:'Scan again',exact:true})).toBeVisible({timeout:120000});
 await expect(page.locator('.finding-card')).not.toHaveCount(0);
 await expect(page.locator('.finding-card').filter({hasText:'Email address'})).toBeVisible();
 await expect(page.locator('.finding-overlay')).not.toHaveCount(0);
 await page.getByRole('tab',{name:/Connections/}).click();
 await expect(page.getByRole('heading',{name:'An identity, connected to a workplace'})).toBeVisible();
 await expect(page.locator('.graph-node')).not.toHaveCount(0);
 await page.locator('.graph-node').first().click();
 await expect(page.locator('.finding-overlay.focused')).toHaveCount(1);
 // Manual drawing at CSS scale must produce an original-image-coordinate mask.
 await page.getByRole('button',{name:'Draw redaction (R)',exact:true}).click();
 const layer=page.locator('.image-layer');const rect=(await layer.boundingBox())!;
 await page.mouse.move(rect.x+rect.width*.1,rect.y+rect.height*.05);
 await page.mouse.down();await page.mouse.move(rect.x+rect.width*.22,rect.y+rect.height*.1,{steps:8});await page.mouse.up();
 await expect(page.locator('.redaction-region')).toHaveCount(1);
 const mask=page.locator('.redaction-region');const previousStyle=await mask.getAttribute('style');
 await page.getByRole('button',{name:'Select and move (V)',exact:true}).click();
 const mr=(await mask.boundingBox())!;
 await page.mouse.move(mr.x+mr.width/2,mr.y+mr.height/2);await page.mouse.down();await page.mouse.move(mr.x+mr.width/2+12,mr.y+mr.height/2+9,{steps:5});await page.mouse.up();
 expect(await mask.getAttribute('style')).not.toBe(previousStyle);
 const resize=page.getByRole('button',{name:'Resize redaction region',exact:true});await resize.focus();await page.keyboard.press('ArrowRight');
 await page.getByRole('button',{name:'Undo',exact:true}).click();await page.getByRole('button',{name:'Redo',exact:true}).click();
 await page.getByRole('button',{name:'Redact all suggested regions',exact:true}).click();
 await page.screenshot({path:'test-results/studio-redacted.png',fullPage:true});
 await page.getByRole('button',{name:'Verify output',exact:true}).click();
 await expect(page.getByRole('button',{name:'Scan again',exact:true})).toBeVisible({timeout:120000});
 await expect(page.getByText('Detected exposures remaining: 0',{exact:true})).toBeVisible();
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export PNG',exact:true}).click();const png=await downloadPromise;
 expect(png.suggestedFilename()).toBe('contextleak-redacted.png');
 const filePath=await png.path();expect(filePath).toBeTruthy();
 await png.saveAs('test-results/verified-output.png');
 // Read the downloaded PNG back in a browser canvas; check resolution and opaque replaced pixels.
 const downloaded=await import('node:fs/promises').then(fs=>fs.readFile(filePath!));
 const pixel=await page.evaluate(async(base64)=>{const img=new Image();img.src='data:image/png;base64,'+base64;await img.decode();const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;const ctx=canvas.getContext('2d')!;ctx.drawImage(img,0,0);return {width:img.naturalWidth,height:img.naturalHeight,pixel:Array.from(ctx.getImageData(210,85,1,1).data)};},downloaded.toString('base64'));
 expect(pixel.width).toBe(1440);expect(pixel.height).toBe(960);expect(pixel.pixel).toEqual([0,0,0,255]);
 await page.getByRole('button',{name:'View report',exact:true}).click();
 const jsonPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Download JSON',exact:true}).click();const json=await jsonPromise;
 const text=await import('node:fs/promises').then(async fs=>fs.readFile((await json.path())!,'utf8'));
 expect(text).not.toContain('avery@');expect(text).not.toContain('sk_demo_');expect(text).not.toContain('sourceText');
 const report=JSON.parse(text);expect(report.verification.remainingCount).toBe(0);
 const stored=await page.evaluate(()=>Object.keys(localStorage));expect(stored).toEqual(['contextleak-preferences']);
 await page.getByRole('button',{name:'End session and clear image',exact:true}).click();await page.getByRole('button',{name:'End & clear session',exact:true}).click();
 await expect(page.getByText('No screenshots yet',{exact:false})).toBeVisible();await page.getByRole('button',{name:'Privacy report',exact:true}).click();await expect(page.getByRole('heading',{name:'A report starts with a screenshot.'})).toBeVisible();
 expect(external).toEqual([]);expect(errors).toEqual([]);
});

test('file validation, real upload, cancel, responsive layout and theme preferences',async({page})=>{
 await page.goto('/');
 await page.getByTestId('file-upload').setInputFiles({name:'unsafe.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')});
 await expect(page.getByRole('alert')).toContainText('PNG, JPG, or WebP');
 await page.getByRole('button',{name:'Dismiss error',exact:true}).click();
 await page.getByTestId('file-upload').setInputFiles({name:'broken.png',mimeType:'image/png',buffer:Buffer.from('not an image')});
 await expect(page.getByRole('alert')).toContainText('does not contain a supported image');
 await page.getByRole('button',{name:'Dismiss error',exact:true}).click();
 const image=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=1200;c.height=700;const x=c.getContext('2d')!;x.fillStyle='white';x.fillRect(0,0,1200,700);x.fillStyle='black';x.font='32px Arial';x.fillText('Email: fictional@example.test',80,120);return c.toDataURL('image/png').split(',')[1];});
 await page.getByTestId('file-upload').setInputFiles({name:'synthetic-upload.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')});
 await expect(page.getByRole('button',{name:'Analyze screenshot',exact:true})).toBeVisible();
 await expect(page.locator('.analysis-progress')).toBeHidden();
 await page.getByRole('button',{name:'Analyze screenshot',exact:true}).click();
 await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.locator('.analysis-progress')).toBeHidden();
 await page.getByRole('button',{name:'Analyze screenshot',exact:true}).click();await expect(page.getByRole('button',{name:'Scan again',exact:true})).toBeVisible({timeout:120000});
 await expect(page.locator('.finding-card').filter({hasText:'Email address'})).toBeVisible();
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Open navigation',exact:true}).click();await page.getByRole('button',{name:'Settings',exact:true}).click();
 await page.getByRole('combobox',{name:'Color theme'}).selectOption('light');await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await page.getByRole('checkbox',{name:'Reduce motion'}).check();await expect(page.locator('html')).toHaveAttribute('data-reduce-motion','true');
 await page.getByRole('button',{name:'Open navigation',exact:true}).click();await page.getByRole('button',{name:'Overview',exact:true}).click();
 await page.screenshot({path:'test-results/overview-mobile-light.png',fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

for(const demo of ['The meeting invitation','The too-good-to-be-true offer'])test(`real OCR and evidence: ${demo}`,async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:new RegExp(demo)}).click();await expect(page.getByRole('button',{name:'Scan again',exact:true})).toBeVisible({timeout:120000});
 await expect(page.locator('.finding-card')).not.toHaveCount(0);await page.getByRole('tab',{name:/Connections/}).click();await expect(page.locator('.inference-card')).not.toHaveCount(0);
});
