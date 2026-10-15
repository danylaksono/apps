// Per-frame HUD: KPI gauge, day text, comparison note and the hover tooltip.
import {$} from './dom.js';
import {K,CSS_CLASS,CLASS_NAME} from './config.js';
import {fmt,pctTxt} from './utils.js';
import {st,nearest,isBurnt,wtdAt,classOf,allBlocks,donorGis} from './model.js';
import {canvas} from './renderer.js';
import {kpi} from './terrain.js';
import {app} from './app.js';
import {sb,CLIM} from './sandbox.js';
import {cmpRes} from './story.js';
import {input} from './camera.js';
import {mouse} from './input.js';
import {pickTerrain} from './picking.js';

const tip=$('tip');let tipT=0;

function updateKpi(){
  const pc=Math.round(kpi.pct*100);$('kpiVal').textContent=app.mode==='intro'?'–':pc+'%';
  const g=$('kpiGauge');g.style.width=(app.mode==='intro'?0:pc)+'%';g.style.background=pc>=60?'var(--ok)':pc>=30?'var(--mod)':'var(--ext)';
  const day=Math.round(st.t);let dtxt='';
  if(app.mode==='story'){dtxt=app.sceneIdx===0?'Awal musim kemarau':app.sceneIdx===4?'Hari ke-'+day+', BBM pompa '+Math.round(3*4.9*72*st.pump).toLocaleString('id-ID')+' liter':app.sceneIdx===6?(st.k<1?'Tahun normal':'Tahun El Niño')+', hari ke-'+day:'Hari ke-'+day+' musim kemarau';}
  else if(app.mode==='sandbox'){dtxt=sb.running||sb.done?CLIM[sb.clim].label+', hari ke-'+day:'Pratinjau hari ke-50, '+CLIM[sb.clim].label.toLowerCase();}
  $('kpiDay').textContent=dtxt;
  if(app.mode==='story'&&app.sceneIdx===6){let t='';if(app.elapsed>7.2)t='Akhir musim, tahun normal: '+pctTxt(cmpRes.n)+' luas KHG dengan TMA aman.';if(app.elapsed>15.6)t+=' Tahun El Niño: '+pctTxt(cmpRes.e)+'.';$('cmp').textContent=t;}
}
function updateTip(dt,hov){
  tipT-=dt;if(tipT<=0){tipT=0.08;
    if(app.mode!=='intro'&&mouse.in&&!input.down&&hov<0){const p=pickTerrain(mouse);
      if(p){const w=wtdAt(p.x,p.z);const c=classOf(w);const n=nearest(p.x,p.z);
        tip.innerHTML='<b>TMA '+fmt(w,2)+' m</b><i style="background:'+CSS_CLASS[c]+'"></i>Kelas '+CLASS_NAME[c]+'<br>±'+Math.round(n.d*K.U/10)*10+' m dari kanal terdekat'+(isBurnt(p.x,p.z)?'<br>Gambut bekas terbakar':'');
        const tx=Math.min(mouse.x+16,canvas.clientWidth-200),ty=Math.max(mouse.y-70,8);tip.style.transform=`translate(${tx}px,${ty}px)`;tip.classList.add('on');}
      else tip.classList.remove('on');}
    else if(hov>=0&&app.mode==='sandbox'){const b=allBlocks[hov];tip.innerHTML='<b>'+(sb.blocks.has(hov)?'Cabut sekat':'Pasang sekat')+'</b>'+(sb.blocks.has(hov)?'Kembalikan 5 poin':'5 poin')+(donorGis.includes(hov)?'<br>Hulu kanal utama: sumber surplus':'');
      tip.style.transform=`translate(${Math.min(mouse.x+16,canvas.clientWidth-200)}px,${Math.max(mouse.y-60,8)}px)`;tip.classList.add('on');}
    else tip.classList.remove('on');}
}

export {updateKpi,updateTip};
