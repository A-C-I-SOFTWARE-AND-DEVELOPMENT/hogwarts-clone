import { chromium } from 'playwright-core';
const EXE='/opt/pw-browsers/chromium-1194/chrome-linux/chrome';const PROXY=process.env.HTTPS_PROXY||'';
const errs=[];
const b=await chromium.launch({executablePath:EXE,headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--ignore-certificate-errors','--no-sandbox',...(PROXY?['--proxy-server='+PROXY]:[])]});
const p=await b.newPage({viewport:{width:800,height:560}});
p.on('pageerror',e=>errs.push('ERR '+(e.message||e)));
p.on('console',m=>{if(m.type()==='error'&&!/fonts|favicon/.test(m.text()))errs.push('C '+m.text());});
await p.addInitScript(()=>localStorage.clear());
await p.goto('http://localhost:8099/index.html',{waitUntil:'load',timeout:45000});
await p.waitForTimeout(8000);
await p.evaluate(()=>document.querySelector('#intro .bigbtn')?.click());
await p.waitForTimeout(1500);
await p.evaluate(()=>{const g=window.__game; g.state.addCoins(999999);
  ['zouwu','basilisk','phoenix','lethifold','salamander','griffin'].forEach(s=>{const b=g.state.rescue(s,null,true); b.level=10; b.needs={hunger:95,energy:95,joy:95,hygiene:95};});
  g.director.sync();});
await p.waitForTimeout(3000);   // let it render many frames (incl. Water reflection)
const gv=await p.evaluate(async ()=>{
  const gen=await import('./src/game/genetics.js');
  const a=gen.randomGenes(), b=gen.randomGenes(); a.accentHue=0.3; b.shiny=true;
  const seen=new Set(); let shiny=0,two=0,glow=0;
  for(let i=0;i<300;i++){const c=gen.rollGenes(a,b); seen.add([Math.round(c.hue*40),Math.round((c.accentHue||0)*40),Math.round(c.light*20),Math.round(c.sizeMod*20),c.personality,c.shiny,c.glow,c.pattern].join(',')); if(c.shiny)shiny++; if(Math.abs(c.accentHue||0)>0.18)two++; if(c.glow)glow++;}
  return {uniqueOf300:seen.size, shinyPct:(shiny/3)|0, twotonePct:(two/3)|0, glowPct:(glow/3)|0, liveCreatures: window.__game.director.live.size};
});
console.log('GENE', JSON.stringify(gv));
console.log('ERRORS', errs.length); errs.slice(0,8).forEach(e=>console.log(' '+e));
await b.close();
