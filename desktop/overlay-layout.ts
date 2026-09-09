import type{Rect}from'../shared/settings';
export interface GeometryWindow {
  getBounds():Rect;
  setBounds(bounds:Rect):void;
  setPosition(x:number,y:number):void;
}
// Native window geometry has one owner. Saved coordinates are for startup/recovery,
// never for an ordinary lyric resize. Defer native resizing until pointer release.
export class OverlayLayout {
  private dragging=false;
  private pending:{width:number;height:number}|null=null;
  constructor(private window:GeometryWindow,private remember:(position:{x:number;y:number})=>void){}
  capture(){const{x,y}=this.window.getBounds();this.remember({x,y});}
  beginDrag(){this.dragging=true;this.capture();}
  moveTo(x:number,y:number){this.window.setPosition(x,y);this.capture();}
  endDrag(){if(!this.dragging)return;this.dragging=false;this.capture();this.flush();}
  resize(width:number,height:number){this.pending={width,height};if(!this.dragging)this.flush();}
  private flush(){
    if(!this.pending)return;const size=this.pending;this.pending=null;
    const current=this.window.getBounds();
    if(current.width===size.width&&current.height===size.height)return;
    this.window.setBounds({...current,...size});this.capture();
  }
}
