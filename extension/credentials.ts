// Firefox cannot rely on Chromium's storage.local access-level restriction.
// This database belongs to the extension origin, not the YouTube content origin.
// Imported only by the background script, never by the content script.
export class CredentialVault {
  constructor(private factory:IDBFactory=indexedDB){}
  private open():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{
    const request=this.factory.open('lyricglass-private',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('pairing');
    request.onerror=()=>reject(Error('Cannot open private pairing storage.'));
    request.onblocked=()=>reject(Error('Pairing storage is blocked. Close extension options and retry.'));
    request.onsuccess=()=>resolve(request.result);
  });}
  async read():Promise<string|undefined>{const db=await this.open();return new Promise((resolve,reject)=>{
    const transaction=db.transaction('pairing','readonly');const request=transaction.objectStore('pairing').get('secret');
    transaction.oncomplete=()=>{db.close();resolve(typeof request.result==='string'&&/^[a-f0-9]{64}$/.test(request.result)?request.result:undefined);};
    transaction.onabort=transaction.onerror=()=>{db.close();reject(Error('Cannot read private pairing storage.'));};
  });}
  async write(secret:string):Promise<void>{if(!/^[a-f0-9]{64}$/.test(secret))throw Error('Invalid pairing secret');const db=await this.open();return new Promise((resolve,reject)=>{
    const transaction=db.transaction('pairing','readwrite');transaction.objectStore('pairing').put(secret,'secret');
    transaction.oncomplete=()=>{db.close();resolve();};
    transaction.onabort=transaction.onerror=()=>{db.close();reject(Error('Cannot save private pairing storage.'));};
  });}
}
