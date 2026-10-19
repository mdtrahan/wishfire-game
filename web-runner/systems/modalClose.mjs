export const MODAL_CLOSE_MARK='<span aria-hidden="true"><canvas></canvas></span>';

export function installModalCloseStyles(){
 if(document.getElementById('shared-modal-close-style'))return;
 const style=document.createElement('style');style.id='shared-modal-close-style';
 style.textContent=`.game-modal-close canvas{display:block;background:transparent;aspect-ratio:auto;filter:drop-shadow(0 2px 1px #172326)}
:is(#lamp-overlay,#training-ground) .game-modal-close{display:grid;place-items:center;flex-shrink:0;align-self:center;width:max(44px,calc(72px * var(--modal-close-scale,1)));height:max(44px,calc(66px * var(--modal-close-scale,1)));margin:calc(24px * var(--modal-close-scale,1)) 0 0;padding:0;border:0;background:transparent;box-shadow:none}
.game-modal-close>span{display:grid;place-items:center;width:calc(44px * var(--modal-close-scale,1));height:calc(44px * var(--modal-close-scale,1));border:2px solid #b8c5c9;border-radius:calc(8px * var(--modal-close-scale,1));background:linear-gradient(#58656b,#30383c);box-shadow:inset 0 1px 0 #ffffff50,0 3px 0 #151e22;color:#fff;font-size:calc(32px * var(--modal-close-scale,1));font-weight:800;line-height:1;text-shadow:0 2px 1px #172326}
.game-modal-close:focus-visible{outline:2px solid #75e4dd;outline-offset:1px}`;
 document.head.append(style);
}

// Crop the existing X glyph to its actual painted pixels before centering it.
export function paintModalClose(button,measure){
 const target=button?.querySelector('canvas');if(!target)return;
 const style=getComputedStyle(target.parentElement),size=parseFloat(style.fontSize),dpr=window.devicePixelRatio||1;
 measure.canvas.width=Math.ceil(size*2*dpr);measure.canvas.height=Math.ceil(size*2*dpr);
 measure.setTransform(dpr,0,0,dpr,0,0);measure.font=style.fontWeight+' '+style.fontSize+' '+style.fontFamily;measure.fillStyle=style.color;
 measure.fillText('×',size/2,size*1.3);
 const pixels=measure.getImageData(0,0,measure.canvas.width,measure.canvas.height);
 let left=pixels.width,top=pixels.height,right=-1,bottom=-1;
 for(let y=0;y<pixels.height;y++)for(let x=0;x<pixels.width;x++)if(pixels.data[(y*pixels.width+x)*4+3]>0){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
 if(right<left||bottom<top)return;
 target.width=right-left+1;target.height=bottom-top+1;target.style.width=target.width/dpr+'px';target.style.height=target.height/dpr+'px';
 target.getContext('2d').drawImage(measure.canvas,left,top,target.width,target.height,0,0,target.width,target.height);
}
