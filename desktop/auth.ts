import { timingSafeEqual } from 'node:crypto';
import { extensionOrigin, type ClientMessage } from '../shared/protocol';
export function authenticate(origin:string|undefined,bound:string|null,secret:string,message:ClientMessage|null) {
  if(!extensionOrigin(origin)||bound!==null&&origin!==bound||message?.type!=='auth')return false;
  const a=Buffer.from(secret),b=Buffer.from(message.secret);
  return a.length===b.length&&timingSafeEqual(a,b);
}
