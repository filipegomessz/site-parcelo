/* Fetch ahead of the wheel; decode one bitmap at a time. The small prepared
   poses always own the angle, so a quality upgrade never changes the pose. */
const base=new URL('./assets/hero-hd/desktop.json',import.meta.url);
const LIMIT=14,DOWNLOADS=4;
export class HeroQuality {
  constructor(repaint){
    this.repaint=repaint;this.cache=new Map();this.pending=new Set();this.errors=new Set();this.ready=new Map();this.queue=[];
    this.references=new Map([...document.querySelectorAll('link[data-hero-still]')].map(link=>[link.dataset.heroStill,[Number(link.dataset.displayWidth),Number(link.dataset.displayHeight)]]));
    this.networkActive=0;this.active=0;this.generation=0;this.decoded=0;this.bytes=0;this.latency=250;this.velocity=0;this.initialFailed=false;this.controller=new AbortController();
  }
  async select(width,height,compact){
    const framing=compact?(width<=700?'compact':'tablet'):(width>1366||height>768?'wide':'desktop');
    const reference=this.references.get(framing);
    const native=(devicePixelRatio||1)<=1.05&&reference&&width<=reference[0]&&height<=reference[1];
    const name=framing+(native?'-1x':'');
    if(this.name===name)return;this.name=name;const generation=++this.generation;
    this.controller.abort();this.controller=new AbortController();
    for(const image of this.cache.values())this.release(image);
    this.cache.clear();this.pending.clear();this.errors.clear();this.ready.clear();this.queue=[];this.manifest=null;this.velocity=0;this.lastSample=0;this.initialFailed=false;
    try{
      const response=await fetch(new URL(name+'.json',base),{signal:this.controller.signal});if(!response.ok)throw Error('HD unavailable');
      const manifest=await response.json();if(generation!==this.generation)return;
      this.manifest=manifest;this.update(this.wanted||0,this.raw||0,this.reduced);this.repaint();
    }catch{/* Embedded originals remain usable when the optional upgrade fails. */}
  }
  update(wanted,raw,reduced){
    const now=performance.now(),previous=this.wanted??wanted,direction=wanted===previous?(this.direction||1):wanted>previous?1:-1;this.direction=direction;
    if(this.lastSample&&wanted!==previous){const speed=Math.abs(wanted-previous)/Math.max(16,now-this.lastSample);this.velocity=this.velocity*.6+Math.min(.18,speed)*.4;}
    if(wanted!==previous||!this.lastSample)this.lastSample=now;
    this.wanted=wanted;this.raw=raw;this.reduced=reduced;if(!this.manifest)return;
    const last=this.manifest.frames.length-1,bezel=last+1;
    const ahead=Math.max(2,Math.min(10,Math.ceil(this.velocity*(this.latency+80))));
    const requests=[];if(raw>=.04||reduced)requests.push(last,bezel);
    requests.push(wanted);
    // Start the forecast pose too; the current pose can expire during download.
    if(!reduced){requests.push(wanted+ahead*direction);for(let n=1;n<=ahead+4;n++)requests.push(wanted+n*direction);for(let n=1;n<=2;n++)requests.push(wanted-n*direction);}
    this.queue=[...new Set(requests)].filter(i=>i>=0&&i<=bezel&&!this.cache.has(i)&&!this.pending.has(i)&&!this.errors.has(i));
    this.pump();this.decode();this.trim();
  }
  get(index){return this.cache.get(index);}
  entry(index){return this.manifest.frames[index]||this.manifest.bezel;}
  async blob(entry,index,signal,file=entry.file||entry.webp){
    const response=await fetch(new URL(file,base),{signal,priority:index===0||index>=80?'high':'low'});
    if(!response.ok)throw Error('Pose unavailable');return {blob:await response.blob(),file};
  }
  pump(){
    while(this.networkActive<DOWNLOADS&&this.manifest&&this.queue.length){
      const index=this.queue.shift();if(this.cache.has(index)||this.pending.has(index)||this.errors.has(index))continue;
      const generation=this.generation,entry=this.entry(index),signal=this.controller.signal,start=performance.now();this.pending.add(index);
      const startup=window.__parceloStartup;
      if(index===0&&!this.initialFailed&&startup?.sharpReady&&startup.initialFile===entry.file){
        startup.sharpReady.then(image=>{if(generation!==this.generation)return;this.cache.set(0,image);this.decoded++;this.bytes+=entry.bytes;this.trim();this.repaint();})
          .catch(()=>{if(generation===this.generation){this.initialFailed=true;this.pending.delete(0);this.queue.push(0);this.pump();}})
          .finally(()=>{if(generation===this.generation&&!this.initialFailed)this.pending.delete(0)});
        continue;
      }
      this.networkActive++;
      this.blob(entry,index,signal).catch(error=>{
        if(signal.aborted||entry.file===entry.webp)throw error;
        return this.blob(entry,index,signal,entry.webp);
      }).then(item=>{
        if(generation!==this.generation)return;
        this.latency=this.latency*.65+(performance.now()-start)*.35;
        this.ready.set(index,{...item,entry,generation});this.decode();
      }).catch(()=>{if(generation===this.generation){this.pending.delete(index);this.errors.add(index)}})
        .finally(()=>{this.networkActive--;this.pump();});
    }
  }
  decode(){
    if(this.active||!this.manifest||!this.ready.size)return;
    const last=this.manifest.frames.length-1;
    const score=i=>i===this.wanted?-1000:i>=last?-500:Math.abs(i-this.wanted)*(i<this.wanted?2:1);
    const index=[...this.ready.keys()].sort((a,b)=>score(a)-score(b))[0],item=this.ready.get(index);this.ready.delete(index);
    if(index!==0&&index<last&&Math.abs(index-this.wanted)>18){this.pending.delete(index);this.decode();return;}
    const image=new Image();image.alt='';image.decoding='async';image.dataset.tier='hd';let url=URL.createObjectURL(item.blob);image.src=url;this.active=1;
    image.decode().catch(async error=>{
      if(item.generation!==this.generation||item.file===item.entry.webp)throw error;
      URL.revokeObjectURL(url);const fallback=await this.blob(item.entry,index,this.controller.signal,item.entry.webp);item.blob=fallback.blob;
      url=URL.createObjectURL(item.blob);image.src=url;await image.decode();
    }).then(()=>{
      if(item.generation!==this.generation){URL.revokeObjectURL(url);return;}
      image.dataset.heroObjectUrl=url;this.cache.set(index,image);this.decoded++;this.bytes+=item.blob.size;this.trim();
      if(index===this.wanted||index>=last)this.repaint();
    }).catch(()=>{URL.revokeObjectURL(url);if(item.generation===this.generation)this.errors.add(index)})
      .finally(()=>{this.active=0;if(item.generation===this.generation)this.pending.delete(index);this.decode();this.pump();});
  }
  release(image){if(image.dataset.heroObjectUrl)URL.revokeObjectURL(image.dataset.heroObjectUrl);}
  trim(){
    if(!this.manifest)return;const last=this.manifest.frames.length-1;
    const candidates=[...this.cache.keys()].filter(i=>i!==0&&i!==this.wanted&&i<last)
      .sort((a,b)=>Math.abs(b-this.wanted)*(b<this.wanted?2:1)-Math.abs(a-this.wanted)*(a<this.wanted?2:1));
    for(const i of candidates){if(this.cache.size<=LIMIT)break;this.release(this.cache.get(i));this.cache.delete(i);}
  }
  stats(){return {profile:this.name,decoded:this.decoded,decodedBytes:this.bytes,cache:this.cache.size,active:this.active,downloads:this.networkActive,ready:this.ready.size};}
}
