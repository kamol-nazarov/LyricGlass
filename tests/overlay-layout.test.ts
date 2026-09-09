import{describe,it,expect}from'vitest';
import{OverlayLayout}from'../desktop/overlay-layout';
import type{Rect}from'../shared/settings';
function fixture(){
  let bounds:Rect={x:100,y:200,width:400,height:214};let saved={x:100,y:200};const resizes:Rect[]=[];
  const layout=new OverlayLayout({getBounds:()=>({...bounds}),setBounds:value=>{bounds={...value};resizes.push({...value});},setPosition:(x,y)=>{bounds={...bounds,x,y};}},position=>saved=position);
  return{layout,resizes,bounds:()=>bounds,saved:()=>saved,externalMove:(x:number,y:number)=>{bounds={...bounds,x,y};}};
}
describe('overlay positioning during lyric changes',()=>{
 it('does not overwrite startup coordinates when no drag was active',()=>{const f=fixture();f.externalMove(500,500);f.layout.endDrag();expect(f.saved()).toEqual({x:100,y:200});});
 it('resizes at the live location even when the saved position is stale',()=>{const f=fixture();f.externalMove(820,460);expect(f.saved()).toEqual({x:100,y:200});f.layout.resize(400,260);expect(f.bounds()).toEqual({x:820,y:460,width:400,height:260});expect(f.saved()).toEqual({x:820,y:460});});
 it('remembers every drag move immediately without waiting for native move events',()=>{const f=fixture();f.layout.beginDrag();f.layout.moveTo(850,470);expect(f.saved()).toEqual({x:850,y:470});f.layout.endDrag();f.layout.resize(400,280);expect(f.bounds()).toMatchObject({x:850,y:470});});
 it('defers a changing lyric height during dragging and applies only the latest height on release',()=>{const f=fixture();f.layout.beginDrag();f.layout.moveTo(200,300);f.layout.resize(400,230);f.layout.moveTo(300,400);f.layout.resize(400,260);f.layout.resize(400,250);expect(f.resizes).toHaveLength(0);expect(f.bounds()).toEqual({x:300,y:400,width:400,height:214});f.layout.endDrag();expect(f.resizes).toEqual([{x:300,y:400,width:400,height:250}]);expect(f.saved()).toEqual({x:300,y:400});});
 it('does not jump back during repeated line changes or a later drag',()=>{const f=fixture();f.layout.beginDrag();f.layout.moveTo(900,500);f.layout.endDrag();for(const height of[230,214,270,214])f.layout.resize(400,height);expect(f.bounds()).toMatchObject({x:900,y:500});f.layout.beginDrag();f.layout.resize(400,300);f.layout.moveTo(600,350);f.layout.endDrag();expect(f.bounds()).toEqual({x:600,y:350,width:400,height:300});});
 it('avoids redundant native resize calls and preserves positions during width changes',()=>{const f=fixture();f.layout.resize(400,214);expect(f.resizes).toHaveLength(0);f.externalMove(-400,250);f.layout.resize(560,240);expect(f.bounds()).toEqual({x:-400,y:250,width:560,height:240});});
});
