import { createServer, type Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { parseMessage, extensionOrigin, MAX_MESSAGE, VERSION, type ClientMessage } from '../shared/protocol';
import { authenticate } from './auth';
import type { Store } from './store';
export class Bridge {
  private server?:Server; private wss?:WebSocketServer;private timer?:ReturnType<typeof setInterval>;private clients=new Map<string,WebSocket>();
  constructor(private store:Store,private status:(s:string)=>void,private message:(connection:string,instance:string,m:ClientMessage)=>void,private disconnected:(connection:string)=>void){}
  start() {
    this.stop();const port=this.store.data.settings.port;
    const server=this.server=createServer((req,res)=>{
      // Only a permission-triggering, credential-free endpoint for the extension popup.
      const origin=req.headers.origin;
      if(req.url==='/permission'&&extensionOrigin(origin)&&(!this.store.data.origin||origin===this.store.data.origin)) {res.writeHead(204,{'Access-Control-Allow-Origin':origin,'Vary':'Origin','Cache-Control':'no-store'});res.end();}else{res.writeHead(403);res.end();}
    });
    const wss=this.wss=new WebSocketServer({noServer:true,maxPayload:MAX_MESSAGE,perMessageDeflate:false});
    server.on('upgrade',(req,socket,head)=>{
      if(req.url!=='/'||req.headers.host!==`127.0.0.1:${port}`||!extensionOrigin(req.headers.origin)||(this.store.data.origin&&req.headers.origin!==this.store.data.origin)||wss.clients.size>=8){socket.destroy();return;}
      wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));
    });
    wss.on('connection',(ws,req)=>{
      const connection=randomUUID();let instance='';let last=Date.now();let count=0;let windowStart=last;
      const timeout=setTimeout(()=>ws.close(4001,'Pairing timed out'),5000);
      const send=(x:unknown)=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(x));};
      ws.on('error',()=>{});
      ws.on('message',(data,binary)=>{
        const now=Date.now();if(now-windowStart>1000){windowStart=now;count=0;}if(++count>80||binary){ws.close(4002,'Message rejected');return;}
        const m=parseMessage(data.toString());if(!m){ws.close(4002,'Invalid protocol message');return;}
        if(!instance){
          if(!authenticate(req.headers.origin,this.store.data.origin,this.store.data.secret,m)){ws.close(4003,'Pairing rejected');return;}
          if(m.type!=='auth')return;instance=m.instance;clearTimeout(timeout);
          // A restarted worker replaces its old connection; no old playback is reused.
          this.clients.get(instance)?.close(4000,'Replaced');this.clients.set(instance,ws);
          this.store.data.origin=req.headers.origin!;this.store.save();last=now;
          send({v:VERSION,type:'ready',captureVersion:1});this.status('Connected to browser');
        }else{
          if(this.clients.get(instance)!==ws||m.type==='auth'){ws.close(4002,'Invalid session');return;}
          last=now;if(m.type==='heartbeat')send({v:VERSION,type:'pong'});else this.message(connection,instance,m);
        }
      });
      const alive=setInterval(()=>{if(Date.now()-last>45000)ws.terminate();},15000);
      ws.once('close',()=>{clearTimeout(timeout);clearInterval(alive);if(this.clients.get(instance)===ws)this.clients.delete(instance);this.disconnected(connection);if(!this.clients.size)this.status('Waiting for extension');});
    });
    server.on('error',(e:NodeJS.ErrnoException)=>this.status(e.code==='EADDRINUSE'?`Port ${port} is in use. Choose another port in both apps.`:`Bridge unavailable: ${e.code??'connection error'}`));
    server.listen(port,'127.0.0.1',()=>this.status(`Waiting for extension on 127.0.0.1:${port}`));
  }
  stop(){for(const ws of this.wss?.clients??[])ws.terminate();this.clients.clear();this.wss?.close();this.server?.close();this.server=undefined;this.wss=undefined;if(this.timer)clearInterval(this.timer);}
  send(instance:string,message:unknown){const ws=this.clients.get(instance);if(ws?.readyState===WebSocket.OPEN){ws.send(JSON.stringify({v:VERSION,...message as object}));return true;}return false;}
}
