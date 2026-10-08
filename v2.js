/* v2 - progressive enhancement: v1 storage keys remain unchanged */
'use strict';
let routeIndex=0, stream=null, scannerLoop=null;
function routeData(){return read(KEY,null)}
function routeItems(v){
  if(!v)return [];
  const steps=Array.isArray(v.steps)?v.steps.filter(s=>typeof s==='string'&&s.trim()).slice(0,12):[];
  if(steps.length)return steps;
  return [v.entrance&&`Acesse pela ${v.entrance}`,v.elevator&&`Procure ${v.elevator}`,v.floor&&`Dirija-se ao piso ${v.floor}`,v.sector&&`Procure o setor ${v.sector}`,v.reference&&`Use como referência: ${v.reference}`,v.spot&&`Encontre a vaga ${v.spot}`].filter(Boolean);
}
function renderRoute(){const v=routeData(),steps=routeItems(v),box=$('returnRoute');box.hidden=!v;
  if(!v)return;routeIndex=Math.min(routeIndex,Math.max(0,steps.length-1));
  $('routeSteps').replaceChildren();
  $('stepHint').textContent=steps.length?'Marque cada etapa mentalmente conforme caminha. Confira também a foto salva.':'Nenhuma instrução registrada. Use as referências de piso, setor e foto.';
  steps.forEach((s,i)=>{const node=document.createElement('div');node.className='route-step'+(i===routeIndex?' selected':'')+(i<routeIndex?' done':'');const circle=document.createElement('span');circle.textContent=i<routeIndex?'✓':String(i+1);const info=document.createElement('span');info.textContent=s;node.append(circle,info);$('routeSteps').append(node)});
  $('previousStep').disabled=routeIndex===0||!steps.length;$('nextStep').disabled=!steps.length||routeIndex>=steps.length-1;
  $('routeProgress').textContent=steps.length?`Etapa ${routeIndex+1} de ${steps.length}`:'Registre um roteiro ao estacionar para usar este guia.';
}
$('previousStep').addEventListener('click',()=>{routeIndex=Math.max(0,routeIndex-1);renderRoute()});
$('nextStep').addEventListener('click',()=>{routeIndex++;renderRoute()});
const oldRenderFind=renderFind;
renderFind=function(){oldRenderFind();routeIndex=0;renderRoute();stopQR();$('qrPreview').hidden=true;$('downloadQR').hidden=true;$('qrStatus').textContent=''};
function qrPayload(v){return 'PARK2:'+JSON.stringify({place:v.place||'',floor:v.floor||'',sector:v.sector||'',spot:v.spot||'',reference:v.reference||'',entrance:v.entrance||'',elevator:v.elevator||'',notes:v.notes||'',steps:routeItems(v),savedAt:v.savedAt||''})}
$('createQR').addEventListener('click',()=>{const v=routeData();if(!v)return;
  try {const raw=qrPayload(v);const qr=new OfflineQRCode(0,1);qr.addData(Array.from(new TextEncoder().encode(raw),b=>String.fromCharCode(b)).join(''));qr.make();const n=qr.getModuleCount();const scale=7,border=4;const cv=document.createElement('canvas');cv.width=cv.height=(n+border*2)*scale;const ctx=cv.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,cv.width,cv.height);ctx.fillStyle='#000000';for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(qr.isDark(y,x))ctx.fillRect((x+border)*scale,(y+border)*scale,scale,scale);const uri=cv.toDataURL('image/png');$('qrPreview').src=uri;$('qrPreview').hidden=false;$('downloadQR').href=uri;$('downloadQR').hidden=false;$('qrStatus').textContent='QR gerado no próprio celular, sem servidor. Contém referências e roteiro; não inclui foto ou GPS.'}
  catch(e){$('qrStatus').textContent='Não foi possível gerar o QR. Tente reduzir o tamanho das instruções de retorno.'}
});
function stopQR(){if(scannerLoop){clearTimeout(scannerLoop);scannerLoop=null}if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}$('qrVideo').hidden=true;$('stopScan').hidden=true}
$('stopScan').addEventListener('click',stopQR);
$('scanQR').addEventListener('click',async()=>{
  if(!('BarcodeDetector' in window)||!navigator.mediaDevices?.getUserMedia){$('qrStatus').textContent='Leitura de QR não suportada neste navegador/contexto. Use HTTPS e um navegador compatível, ou leia a imagem com a câmera nativa.';return}
  try{stopQR();const detector=new BarcodeDetector({formats:['qr_code']});stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false});const video=$('qrVideo');video.srcObject=stream;video.hidden=false;$('stopScan').hidden=false;await video.play();$('qrStatus').textContent='Aponte a câmera para o QR do estacionamento.';
    const scan=async()=>{if(!stream)return;try{const detected=await detector.detect(video);const raw=detected.find(x=>x.rawValue?.startsWith('PARK2:'))?.rawValue;if(raw){const val=JSON.parse(raw.slice(6));if(!val||typeof val!=='object'||Array.isArray(val))throw Error('QR inválido');const fields=['place','floor','sector','spot','reference','entrance','elevator','notes'];const data={};fields.forEach(k=>data[k]=typeof val[k]==='string'?val[k].slice(0,400):'');data.steps=Array.isArray(val.steps)?val.steps.filter(x=>typeof x==='string').slice(0,12).map(x=>x.slice(0,200)):[];data.savedAt=new Date().toISOString();data.gps=null;data.photo=null;stopQR();if(confirm(`Recuperar este registro?\n${data.place} · ${data.floor} · ${data.sector} · ${data.spot}\n\nSubstituirá a vaga ativa neste navegador.`)){if(persist(KEY,data)){const hist=read(HIST,[]);hist.unshift(data);persist(HIST,hist.slice(0,20));renderHero();switchTab('find')}}else{$('qrStatus').textContent='Importação cancelada.'}return}}catch(e){$('qrStatus').textContent='QR incompatível ou leitura falhou.'}scannerLoop=setTimeout(scan,350)};scan();
  }catch(e){stopQR();$('qrStatus').textContent='A câmera não pôde ser aberta. Autorize a permissão no celular (HTTPS).'}
});
window.addEventListener('pagehide',stopQR);
