import { sceneLayout } from './phone-layout.js';
import { transitionPose, DOCK_AT } from './money-transition.js';
import { loadScreen, prepareScreens } from './screen-assets.js';
import { HeroQuality } from './hero-quality.js';
const base = new URL('./models/hero-frames/desktop.json', import.meta.url);
const CACHE_LIMIT = 24;
export class LiteScene {
  constructor(host, requestPaint) {
    this.host = host; this.requestPaint = requestPaint;
    this.quality = new HeroQuality(requestPaint);
    this.cache = new Map(); this.pending = new Set(); this.badFrames = new Set();
    this.queue = []; this.activeLoads = 0; this.generation = 0; this.current = -1;
    this.startup = window.__parceloStartup;
    this.startup?.stop();
    if(this.startup)this.startup.repaint=this.requestPaint;
    this.element = this.startup?.element || document.createElement('div');
    this.element.className = 'lite-object'; this.element.setAttribute('aria-hidden','true');
    this.screen = document.createElement('div'); this.screen.className = 'lite-screen';
    this.screen.setAttribute('aria-hidden','true'); this.screen.hidden = true;
    this.screenImage = new Image(); this.screenImage.decoding='async';
    this.screenShade = document.createElement('span'); this.screen.append(this.screenImage,this.screenShade);
    if(this.startup?.floatLayer)this.host.append(this.screen);else this.host.append(this.element,this.screen);
    this.screens = new Map(); this.screenRequests = new Set();
    this.warmClip=document.createElement('div');this.warmClip.setAttribute('aria-hidden','true');
    Object.assign(this.warmClip.style,{position:'absolute',left:'0',top:'0',width:'1px',height:'1px',overflow:'hidden',pointerEvents:'none'});
    this.host.append(this.warmClip);this.warmed=new Set();
    this.scrollIdle = true; this.overlayReady = false;
    window.addEventListener('scroll', () => {
      this.scrollIdle = false; clearTimeout(this.idleTimer);
      this.idleTimer = setTimeout(() => { this.scrollIdle = true; this.requestPaint(); }, 180);
    }, {passive:true});
  }
  async selectVariant(compact) {
    const variant = compact ? 'compact' : 'desktop'; if(this.variant === variant) return;
    this.variant=variant; const generation=++this.generation;
    this.manifest=null;this.cache.clear();this.pending.clear();this.badFrames.clear();this.queue=[];this.current=-1;
    this.screen.hidden=true;
    const embedded=this.startup?.data[variant]?.manifest;
    if(embedded) { this.manifest=embedded; return; }
    try {
      const response=await fetch(new URL(variant+'.json',base));
      if(!response.ok) throw Error('Frame manifest unavailable');
      const manifest=await response.json();
      if(manifest.version!==1||!Array.isArray(manifest.frames)||manifest.frames.length<2||!manifest.screen)throw Error('Invalid frames');
      if(generation!==this.generation)return;
      this.manifest=manifest;this.requestPaint();
    } catch { if(generation===this.generation)this.host.dataset.frames='unavailable'; }
  }
  update({width,height,compact,raw,reduced,chapter,brightness,chapterProgress=0}) {
    this.latest={width,height,compact,raw,reduced,chapter,brightness,chapterProgress};
    this.selectVariant(compact); if(!this.manifest)return;
    const motion=transitionPose(raw,reduced),frames=this.manifest.frames,last=frames.length-1;
    const wanted=reduced?(motion.exchange?last:0):Math.round(Math.min(raw/DOCK_AT,1)*last);
    const previous=this.wanted??wanted,direction=wanted===previous?(this.direction||1):wanted>previous?1:-1;this.wanted=wanted;this.direction=direction;
    this.quality.select(width,height,compact);this.quality.update(wanted,raw,reduced);
    const ahead=Math.max(2,Math.min(10,Math.ceil(this.quality.velocity*(this.quality.latency+80))));
    const nearby=[wanted];
    if(!reduced){nearby.push(wanted+ahead*direction);for(let offset=1;offset<=ahead+2;offset++)nearby.push(wanted+offset*direction);for(let offset=1;offset<=2;offset++)nearby.push(wanted-offset*direction);}
    if(raw>=.24)nearby.push(last,frames.length);
    this.queue=[...new Set(nearby)].filter(i=>i>=0&&i<=frames.length&&!this.quality.get(i)&&!this.cache.has(i)&&!this.pending.has(i)&&!this.badFrames.has(i));
    if(this.quality.fallbackRequired(wanted))this.pump(); prepareScreens(raw,chapterProgress);
    const docked=motion.approach===1;
    // The first home is already baked into the pose. Introduce its identical
    // live overlay while idle, avoiding two new GPU layers during arrival.
    if(docked && (this.scrollIdle || chapter > 0)) this.overlayReady = true;
    // Register the decoded screen while the phone is still approaching.
    if(raw>=.20&&!this.screenRequests.has(chapter)){
      this.screenRequests.add(chapter);
      loadScreen(chapter).then(image=>{this.screens.set(chapter,image);this.requestPaint();}).catch(()=>{this.screenRequests.delete(chapter)});
    }
    const bezel=docked&&this.overlayReady&&(this.quality.get(frames.length)||this.cache.has(frames.length))&&this.screens.has(chapter);
    const key=bezel?frames.length:wanted;const image=this.quality.get(key)||(wanted===0&&this.startup?.initialVariant===this.variant?this.startup?.sharpInitial:null)||this.cache.get(key)||(!bezel?this.quality.nearest(wanted):null);
    // Keep the optional HD cache bounded independently. Promoting an HD image
    // into the small-pose cache would retain it after the HD queue evicted it.
    if(image&&this.cache.get(key)===image){this.cache.delete(key);this.cache.set(key,image);}
    const frame=frames[image?.poseIndex??wanted];
    if(this.layoutKey!==width+':'+height+':'+compact+':'+this.variant){
      this.layoutKey=width+':'+height+':'+compact+':'+this.variant;
      this.layout=sceneLayout(width,height,compact,this.manifest.halfSize,this.manifest.moneyHalfSize);
    }
    const layout=this.layout,pixels=layout.startHeight+(layout.endHeight-layout.startHeight)*motion.approach;
    // Decode alone does not upload a bitmap to the compositor. Paint the final
    // phone and rim through a one-pixel clip before arrival. Their transparent
    // corner remains invisible; the same decoded nodes move into the scene.
    const warmKey=this.quality.name+':'+this.layoutKey;
    if(this.warmKey!==warmKey){this.warmKey=warmKey;this.warmClip.replaceChildren();this.warmed.clear();}
    if(wanted<last)for(const index of [last,frames.length]){
      const capture=this.quality.get(index);if(!capture||capture.sprite||this.warmed.has(capture))continue;
      const holder=document.createElement('div');Object.assign(holder.style,{position:'absolute',left:'0',top:'0',width:frames[last].width*layout.endHeight+'px',height:frames[last].height*layout.endHeight+'px',willChange:'transform'});
      Object.assign(capture.style,{display:'block',width:'100%',height:'100%'});holder.append(capture);this.warmClip.append(holder);this.warmed.add(capture);
    }
    const x=layout.startX+(width/2-layout.startX)*motion.approach,y=layout.startY+(layout.endY-layout.startY)*motion.approach;
    const floatLayer=this.startup?.floatLayer;if(floatLayer){floatLayer.style.setProperty('--prepared-float',(reduced?0:pixels*.008*(1-motion.approach))+'px');floatLayer.style.animationPlayState=document.hidden||reduced||motion.approach===1?'paused':'running';}
    this.position(this.element,x+frame.x*pixels,y+frame.y*pixels,frame.width*pixels,frame.height*pixels);
    if(this.startup){this.startup.raw=raw;this.startup.compact=compact;this.startup.show(wanted,image,bezel);}
    else if(image&&this.current!==wanted)this.element.replaceChildren(image);
    this.current=wanted;this.host.dataset.frame=String(wanted);
    if(image||this.startup)this.host.dataset.frames='ready';
    this.screen.hidden=raw<.50;this.screen.style.opacity=docked&&this.overlayReady?'1':'.001';this.screen.style.zIndex=bezel?1:3;
    this.host.dataset.screenReady=String(this.screens.has(chapter));
    if(raw>=.50){
      const screen=this.manifest.screen;this.position(this.screen,width/2+screen.x*layout.endHeight,layout.endY+screen.y*layout.endHeight,screen.width*layout.endHeight,screen.height*layout.endHeight);
      if(!this.screenRequests.has(chapter)){
        this.screenRequests.add(chapter);
        loadScreen(chapter).then(image=>{this.screens.set(chapter,image);this.requestPaint();}).catch(()=>{this.screenRequests.delete(chapter)});
      }
      if(this.screens.has(chapter)&&this.chapter!==chapter){this.chapter=chapter;const capture=this.screens.get(chapter);this.screenImage.src=capture.src;
        const repeat=(.07485/.16005)/(capture.naturalWidth/capture.naturalHeight);
        this.screenImage.style.width=(100/repeat)+'%';this.screenImage.style.marginLeft=((100-100/repeat)/2)+'%';this.screenImage.style.objectFit='fill';}
      // Until a capture is decoded, keep the home already present in the poses.
      if(!this.screens.has(chapter)){this.screen.hidden=true;}
      this.screenShade.style.opacity=String(1-brightness);
    }
    const parent=this.host.parentElement;
    if(this.parentKey !== this.layoutKey) { this.parentKey = this.layoutKey;
    parent.style.setProperty('--dock-phone-width',layout.endHeight*(.0776/.1628)+'px');
    parent.style.setProperty('--cash-x',layout.startX+'px');parent.style.setProperty('--cash-y',layout.startY+'px');parent.style.setProperty('--cash-width',layout.startHeight*1.33+'px');
    }
    this.trim();
  }
  hdStats(){return this.quality.stats();}
  position(element,x,y,width,height){
    const key=[x,y,width,height].map(v=>v.toFixed(2)).join(':');if(element.dataset.position===key)return;
    element.dataset.position=key;element.style.transform=`translate(${x.toFixed(2)}px,${y.toFixed(2)}px)`;
    element.style.width=width.toFixed(2)+'px';element.style.height=height.toFixed(2)+'px';
  }
  pump(){
    while(this.activeLoads<2&&this.queue.length){
      const index=this.queue.shift();if(!this.manifest||this.quality.get(index)||this.cache.has(index)||this.pending.has(index))continue;
      const generation=this.generation,image=new Image();image.alt='';image.decoding='async';
      this.activeLoads++;this.pending.add(index);
      image.src=new URL(this.manifest.frames[index]?.file||this.manifest.bezel,base).href;
      image.decode().then(()=>{if(generation!==this.generation)return;this.cache.set(index,image);this.trim();if(index===this.wanted||index>=this.manifest.frames.length-1)this.requestPaint();})
        .catch(()=>{if(generation===this.generation)this.badFrames.add(index)})
        .finally(()=>{this.activeLoads--;if(generation===this.generation)this.pending.delete(index);this.pump()});
    }
  }
  trim(){for(const i of this.cache.keys()){if(this.cache.size<=CACHE_LIMIT)break;if(i===this.current||i===this.wanted||i===0||i>=this.manifest.frames.length-1)continue;this.cache.delete(i);}}
}
