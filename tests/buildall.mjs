import { chromium } from 'playwright-core';
const EXE='/opt/pw-browsers/chromium-1194/chrome-linux/chrome';const PROXY=process.env.HTTPS_PROXY||'';
const errs=[];
const b=await chromium.launch({executablePath:EXE,headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--ignore-certificate-errors','--no-sandbox',...(PROXY?['--proxy-server='+PROXY]:[])]});
const p=await b.newPage({viewport:{width:900,height:600}});
p.on('pageerror',e=>errs.push('PAGEERR: '+(e.message||e)));
p.on('console',m=>{if(m.type()==='error'&&!/fonts|favicon/.test(m.text()))errs.push('C: '+m.text());});
await p.addInitScript(()=>localStorage.clear());
await p.goto('http://localhost:8099/index.html',{waitUntil:'load',timeout:45000});
await p.waitForTimeout(8000);
await p.evaluate(()=>document.querySelector('#intro .bigbtn')?.click());
await p.waitForTimeout(1200);
const res=await p.evaluate(async ()=>{
  const mod=await import('./src/creatures/index.js');
  const env=window.__game.world.envState();
  const out=[];
  for(const meta of mod.SPECIES_LIST){
    try{
      const c=mod.buildCreature(meta.id,{x:0,z:0,seed:5,needs:{hunger:70,energy:70,joy:70,hygiene:70}});
      for(let i=0;i<24;i++){c.update(i*0.1,0.1,env); if(i===6)c.command('eat',1); if(i===12)c.command('play',1); if(i===18)c.command('walk',1);}
      let n=0;c.group.traverse(o=>{if(o.isMesh)n++;});
      out.push({id:meta.id,tier:meta.rarity,ok:true,meshes:n});
      c.dispose();
    }catch(e){out.push({id:meta.id,ok:false,err:e.message});}
  }
  return {count:mod.SPECIES_LIST.length, out};
});
console.log('TOTAL SPECIES:',res.count);
res.out.forEach(r=>console.log(' ',r.ok?'✓':'✗',r.id,r.ok?`[${r.tier}] ${r.meshes}m`:r.err));
console.log('FAILS:',res.out.filter(r=>!r.ok).length,'  PAGE ERRORS:',errs.length);
errs.slice(0,12).forEach(e=>console.log('  '+e));
await b.close();
