(() => {
  const started=performance.now();
  const report={version:'20261120-a',userAgent:navigator.userAgent,language:navigator.language,online:navigator.onLine,secureContext:window.isSecureContext,controller:navigator.serviceWorker?.controller?.scriptURL||null,events:[],probes:[]};
  window.audioDiagnostic={report};
  const output=document.querySelector('#diagnostic-report');
  const sources={wav:'output/audio/echo/LM-057.wav',aac:'output/audio/diagnostics/LM-057.m4a'};
  const timers=new Map();
  const stamp=()=>Math.round(performance.now()-started);
  const render=()=>{output.value=JSON.stringify(report,null,2);};
  function log(format,type,extra={}){report.events.push({atMs:stamp(),format,type,...extra});if(report.events.length>150)report.events.shift();render();}
  function urlFor(src){const url=new URL(src,document.baseURI);url.searchParams.set('diag',`${Date.now()}-${Math.random().toString(36).slice(2)}`);return url.href;}
  for(const [format,src]of Object.entries(sources)){
    const audio=document.querySelector('#audio-'+format);const label=document.querySelector('#state-'+format);
    audio.src=urlFor(src);document.querySelector('#link-'+format).href=audio.src;
    const snapshot=()=>({time:audio.currentTime,readyState:audio.readyState,networkState:audio.networkState,duration:Number.isFinite(audio.duration)?audio.duration:null,errorCode:audio.error?.code||null,errorMessage:audio.error?.message||null,muted:audio.muted,volume:audio.volume});
    for(const type of ['loadstart','loadedmetadata','canplay','playing','waiting','stalled','ended','error'])audio.addEventListener(type,()=>{
      log(format,type,snapshot());
      if(type==='playing'||type==='error'||type==='ended'){clearTimeout(timers.get(format));timers.delete(format);}
      if(type==='playing')label.textContent='播放器已开始播放。请确认是否实际听到声音。';
      else if(type==='error')label.textContent=`加载/解码失败：MediaError ${audio.error?.code||'未知'} ${audio.error?.message||''}`;
      else if(type==='ended')label.textContent='播放已结束。';
      else if(type==='waiting'||type==='stalled')label.textContent='音频正在等待数据…';
    });
    let lastSecond=-1;audio.addEventListener('timeupdate',()=>{const sec=Math.floor(audio.currentTime);if(sec!==lastSecond){lastSecond=sec;log(format,'timeupdate',snapshot());}});
    document.querySelector(`[data-play="${format}"]`).addEventListener('click',event=>{
      for(const other of document.querySelectorAll('audio'))if(other!==audio)other.pause();
      clearTimeout(timers.get(format));label.textContent='正在尝试播放…';
      log(format,'requested',{trusted:event.isTrusted,userActivation:navigator.userActivation?.isActive??null,...snapshot()});
      if(audio.error)audio.load();
      if(audio.readyState>0)try{audio.currentTime=0;}catch{}
      timers.set(format,setTimeout(()=>{label.textContent='播放等待超过 10 秒，请运行下面的资源加载检查。';log(format,'play-timeout',snapshot());},10000));
      // Call synchronously from the trusted click, not from a timer or fetch callback.
      audio.play().catch(error=>{clearTimeout(timers.get(format));label.textContent=`播放失败：${error.name} ${error.message}`;log(format,'rejected',{name:error.name,message:error.message,...snapshot()});});
    });
  }
  async function request(src,range){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),10000);const time=performance.now();try{
    const r=await fetch(urlFor(src),{cache:'no-store',signal:controller.signal,headers:range?{Range:'bytes=0-1'}:{}});const bytes=await r.arrayBuffer();
    return {status:r.status,ok:r.ok,ms:Math.round(performance.now()-time),bytes:bytes.byteLength,type:r.headers.get('Content-Type'),contentRange:r.headers.get('Content-Range'),acceptRanges:r.headers.get('Accept-Ranges'),sha256:!range&&crypto.subtle?Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join(''):null};
  }catch(error){return {ms:Math.round(performance.now()-time),error:controller.signal.aborted?'timeout':error.name,message:error.message};}finally{clearTimeout(timer);}}
  document.querySelector('#probe').addEventListener('click',async event=>{event.target.disabled=true;report.probes=[];document.querySelector('#probe-result').textContent='正在检查…';try{
    for(const [format,src]of Object.entries(sources)){const range=await request(src,true);const full=await request(src,false);report.probes.push({format,range,full});render();document.querySelector('#probe-result').textContent=report.probes.map(p=>`${p.format.toUpperCase()}：分段 ${p.range.status||p.range.error}，${p.range.bytes??0} 字节；完整 ${p.full.status||p.full.error}，${p.full.bytes??0} 字节`).join('\n');}
  }finally{event.target.disabled=false;}});
  document.querySelector('#copy-report').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(output.value);document.querySelector('#copy-status').textContent='已复制，可粘贴回聊天。';}catch{output.focus();output.select();document.querySelector('#copy-status').textContent='请长按选中的记录并复制。';}});
  render();
})();
