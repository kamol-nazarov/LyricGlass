import{number}from'./protocol';
export class OverlayDrag {
  private origin:{pointerX:number;pointerY:number;x:number;y:number;updated:number}|null=null;
  end(){this.origin=null;}
  start(pointerX:number,pointerY:number,x:number,y:number,now:number){this.origin={pointerX,pointerY,x,y,updated:now};}
  move(pointerX:number,pointerY:number,now:number){
    const start=this.origin;
    if(!start||now-start.updated>10000||!number(pointerX,-100000,100000)||!number(pointerY,-100000,100000)){this.end();return null;}
    start.updated=now;return{x:Math.round(start.x+pointerX-start.pointerX),y:Math.round(start.y+pointerY-start.pointerY)};
  }
}
