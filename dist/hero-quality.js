/* Load nine groups of approved angles, with bounded downloads and decoding. */
const stillBase=new URL('./assets/hero-hd/desktop.json',import.meta.url);
const motionBase=new URL('./assets/hero-motion/desktop.json',import.meta.url);
export class HeroQuality {
  constructor(repaint){
    this.repaint=repaint;this.cache=new Map();this.sheets=new Map();this.pending=new Set();this.errors=new Set();this.preloads=new Set();this.ready=new Map();this.queue=[];
    this.references=new Map([...document.querySelectorAll('link[data-hero-still]')].map(l=>[l.dataset.heroStill,[+l.dataset.displayWidth,+l.dataset.displayHeight]]));
    this.sourceCache=new Map();this.sourceBytes=0;
    this.networkActive=0;this.active=0;this.generation=0;this.decoded=0;this.bytes=0;this.latency=250;this.velocity=0;this.controller=new AbortController();
  }
  async select(width,height,compact){
    const framing=compact?(width<=700?'compact':'tablet'):(width>1366||height>768?'wide':'desktop'),reference=this.references.get(framing);
    const native=(devicePixelRatio||1)<=1.05&&reference&&width<=reference[0]&&height<=reference[1],name=framing+(native?'-1x':'');
    if(this.name===name)return;this.name=name;const generation=++this.generation;this.controller.abort();this.controller=new AbortController();
    [...this.cache.values(),...this.sheets.values()].forEach(image=>this.release(image));
    this.sourceCache.clear();this.sourceBytes=0;
    this.cache.clear();this.sheets.clear();this.pending.clear();this.errors.clear();this.preloads.clear();this.ready.clear();this.queue=[];this.motion=null;this.velocity=0;this.lastSample=0;
    const embedded=window.__parceloStartup?.data.motion?.[name];
    if(embedded){this.motion=embedded;this.update(this.wanted||0,this.raw||0,this.reduced);return;}
    try{
      const response=await fetch(new URL(name+'.json',motionBase),{signal:this.controller.signal});if(!response.ok)throw Error('Motion sheets unavailable');
      const manifest=await response.json();if(generation!==this.generation)return;this.motion=manifest;this.update(this.wanted||0,this.raw||0,this.reduced);this.repaint();
    }catch{/* Original per-angle files remain available. */}
  }
  update(wanted,raw,reduced){
    const now=performance.now(),previous=this.wanted??wanted;this.direction=wanted===previous?(this.direction||1):wanted>previous?1:-1;
    if(this.lastSample&&wanted!==previous)this.velocity=this.velocity*.6+Math.min(.18,Math.abs(wanted-previous)/Math.max(16,now-this.lastSample))*.4;
    if(wanted!==previous||!this.lastSample)this.lastSample=now;this.wanted=wanted;this.raw=raw;this.reduced=reduced;if(!this.motion)return;
    const sheet=this.motion.frames[wanted].sheet,keys=[];if(wanted===0)keys.push('first');
    if(!reduced)keys.push('sheet:'+sheet,'sheet:'+(sheet+this.direction));
    keys.push('last','bezel');if(!reduced)keys.push('sheet:'+(sheet+2*this.direction),'sheet:'+(sheet+3*this.direction),'sheet:'+(sheet-this.direction));
    this.queue=[...new Set(keys)].filter(k=>this.entry(k)&&!this.has(k)&&!this.pending.has(k)&&!this.errors.has(k));this.pump();this.decode();this.trim();
  }
  has(key){return key.startsWith('sheet:')?this.sheets.has(+key.slice(6)):this.cache.has(key==='first'?0:key==='last'?80:81);}
  entry(key){return key.startsWith('sheet:')?this.motion?.sheets[+key.slice(6)]:this.motion?.[key];}
  get(index){
    if(this.cache.has(index))return this.cache.get(index);
    const tile=this.motion?.frames[index],image=tile&&this.sheets.get(tile.sheet);if(!image)return;
    this.sheets.delete(tile.sheet);this.sheets.set(tile.sheet,image);
    return {sprite:true,image,tile,sheet:this.motion.sheets[tile.sheet],poseIndex:index,src:image.src+'#'+index,dataset:{tier:'sharp'}};
  }
  nearest(index){for(let gap=1;gap<=4;gap++){const image=this.get(index-gap*this.direction)||this.get(index+gap*this.direction);if(image)return image;}}
  fallbackRequired(index){return !this.motion||this.errors.has('sheet:'+this.motion.frames[Math.min(index,80)].sheet);}
  async blob(entry,key,signal,file=entry.file){
    const url=new URL(file,key.startsWith('sheet:')?motionBase:stillBase).href;
    if(signal.aborted)throw new DOMException('Aborted','AbortError');
    const cached=this.sourceCache.get(url);
    if(cached){this.sourceCache.delete(url);this.sourceCache.set(url,cached);return {blob:cached,file};}
    const response=await fetch(url,{signal,priority:key.startsWith('sheet:')?'high':'low'});
    if(!response.ok)throw Error('Pose unavailable');
    const blob=await response.blob();
    // Retain only compressed motion files, never extra decoded GPU images.
    // Profile changes and aborted requests cannot repopulate an old cache.
    if(key.startsWith('sheet:')&&!signal.aborted&&blob.size<=2097152){
      this.sourceCache.set(url,blob);this.sourceBytes+=blob.size;
      while(this.sourceCache.size>9||this.sourceBytes>2097152){
        const oldest=this.sourceCache.keys().next().value;
        this.sourceBytes-=this.sourceCache.get(oldest).size;this.sourceCache.delete(oldest);
      }
    }
    return {blob,file};
  }
  pump(){
    while(this.networkActive<3&&this.motion&&this.queue.length){
      const key=this.queue.shift();if(this.has(key)||this.pending.has(key)||this.errors.has(key))continue;
      const generation=this.generation,entry=this.entry(key),signal=this.controller.signal,start=performance.now();this.pending.add(key);
      const startup=window.__parceloStartup,preload=key==='first'?startup?.sharpReady:key==='last'?startup?.finalReady:key.startsWith('sheet:')?startup?.motionPreloads?.get(+key.slice(6)):undefined;
      if(preload&&!this.preloads.has(key)&&startup.initialQuality===this.name){
        let failed=false;this.preloads.add(key);preload.then(image=>{if(generation===this.generation){this.preloads.delete(key);this.save(key,image);this.repaint();}})
          .catch(()=>{failed=true;})
          .finally(()=>{if(generation===this.generation){this.pending.delete(key);if(failed){this.queue.push(key);this.pump();}}});continue;
      }
      this.networkActive++;
      this.blob(entry,key,signal).catch(error=>{if(signal.aborted||!entry.webp||entry.file===entry.webp)throw error;return this.blob(entry,key,signal,entry.webp);})
        .then(item=>{if(generation!==this.generation)return;this.latency=this.latency*.65+(performance.now()-start)*.35;this.ready.set(key,{...item,entry,generation});this.decode();})
        .catch(()=>{if(generation===this.generation){this.pending.delete(key);this.errors.add(key);this.repaint();}})
        .finally(()=>{this.networkActive--;this.pump();});
    }
  }
  decode(){
    if(this.active||!this.motion||!this.ready.size)return;
    const wantedSheet=this.motion.frames[this.wanted].sheet,score=k=>k==='last'?-2:k==='bezel'?-1:k.startsWith('sheet:')?Math.abs(+k.slice(6)-wantedSheet):0;
    const key=[...this.ready.keys()].sort((a,b)=>score(a)-score(b))[0],item=this.ready.get(key);this.ready.delete(key);
    const image=new Image();image.alt='';image.decoding='async';image.dataset.tier=key.startsWith('sheet:')?'sharp':'hd';
    let url=URL.createObjectURL(item.blob);image.src=url;this.active=1;
    image.decode().catch(async error=>{
      if(item.generation!==this.generation||!item.entry.webp||item.file===item.entry.webp)throw error;
      URL.revokeObjectURL(url);const fallback=await this.blob(item.entry,key,this.controller.signal,item.entry.webp);item.blob=fallback.blob;url=URL.createObjectURL(item.blob);image.src=url;await image.decode();
    }).then(()=>{
      if(item.generation!==this.generation){URL.revokeObjectURL(url);return;}image.dataset.heroObjectUrl=url;this.bytes+=item.blob.size;this.save(key,image);this.repaint();
    }).catch(()=>{URL.revokeObjectURL(url);if(item.generation===this.generation){this.errors.add(key);this.repaint();}})
      .finally(()=>{this.active=0;if(item.generation===this.generation)this.pending.delete(key);this.decode();this.pump();});
  }
  save(key,image){if(key.startsWith('sheet:'))this.sheets.set(+key.slice(6),image);else this.cache.set(key==='first'?0:key==='last'?80:81,image);this.decoded++;this.trim();}
  release(image){if(image.dataset.heroObjectUrl)URL.revokeObjectURL(image.dataset.heroObjectUrl);}
  trim(){const current=this.motion?.frames[this.wanted]?.sheet;for(const [index,image] of this.sheets){if(this.sheets.size<=5)break;if(index===current)continue;this.release(image);this.sheets.delete(index);}}
  stats(){return {profile:this.name,decoded:this.decoded,decodedBytes:this.bytes,cache:this.cache.size,sheets:this.sheets.size,active:this.active,downloads:this.networkActive,ready:this.ready.size,errors:[...this.errors]};}
}
