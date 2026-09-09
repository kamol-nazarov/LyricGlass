import{describe,it,expect}from'vitest';
import{authenticate}from'../desktop/auth';
import{parseMessage,extensionOrigin,MAX_MESSAGE}from'../shared/protocol';
import{settings,recoverBounds}from'../shared/settings';
import{playback}from'./fixtures';
const origin='chrome-extension://'+'a'.repeat(32),secret='ab'.repeat(32),auth={v:1 as const,type:'auth' as const,secret,instance:'browser1'};
describe('bridge trust boundary',()=>{
 it('authenticates a secret and binds the exact extension origin',()=>{expect(authenticate(origin,null,secret,auth)).toBe(true);expect(authenticate(origin,origin,secret,auth)).toBe(true);expect(authenticate(origin,'chrome-extension://'+'b'.repeat(32),secret,auth)).toBe(false);expect(authenticate(origin,null,'cd'.repeat(32),auth)).toBe(false);});
 it.each(['https://www.youtube.com','http://127.0.0.1:43821','null',undefined,origin+'/path','chrome-extension://short'])('rejects website/missing/malformed origins %s',o=>{expect(extensionOrigin(o)).toBe(false);expect(authenticate(o,null,secret,auth)).toBe(false);});
 it('refuses playback before authentication',()=>{expect(authenticate(origin,null,secret,{v:1,type:'snapshot',tab:1,document:'document1',playback:playback()})).toBe(false);});
 it('validates version, sizes, numbers, identity and message types',()=>{const valid={v:1,type:'snapshot',tab:1,document:'document1',playback:playback()};expect(parseMessage(JSON.stringify(valid))).not.toBeNull();for(const patch of[{v:2},{type:'exec'},{tab:-1},{document:'x'},{playback:playback({rate:0})},{playback:playback({title:'x'.repeat(401)})},{playback:playback({position:Infinity})},{playback:{...playback(),playing:'yes'}}])expect(parseMessage(JSON.stringify({...valid,...patch}))).toBeNull();expect(parseMessage('{')).toBeNull();expect(parseMessage('x'.repeat(MAX_MESSAGE+1))).toBeNull();});
});
describe('persistent appearance validation',()=>{
 it('recovers defaults from corrupt/out-of-range settings',()=>{expect(settings({port:80,opacity:7,fontSize:Infinity,width:900,locked:'yes'})).toMatchObject({port:43821,opacity:.72,fontSize:18,width:400,locked:false});expect(settings({port:54321,opacity:0,textOnly:true})).toMatchObject({port:54321,opacity:0,textOnly:true});});
 it('recovers a removed monitor to bottom center',()=>{expect(recoverBounds(settings({x:-2000,y:200}),250,[{x:0,y:0,width:1920,height:1040}])).toEqual({x:760,y:766,width:400,height:250});});
 it('clamps partly offscreen windows and handles small monitors',()=>{expect(recoverBounds(settings({x:1800,y:990}),300,[{x:0,y:0,width:1920,height:1040}])).toEqual({x:1520,y:740,width:400,height:300});const b=recoverBounds(settings({x:null,y:null,width:720}),600,[{x:0,y:0,width:400,height:300}]);expect(b.width).toBe(400);expect(b.height).toBe(300);expect(b.y).toBeGreaterThanOrEqual(0);});
});

