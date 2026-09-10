import fs from 'node:fs';
import path from 'node:path';
import {credentials,type Credentials} from './acrcloud';
export interface Protection {isEncryptionAvailable():boolean;encryptString(value:string):Buffer;decryptString(value:Buffer):string}
export class RecognitionVault {
 private file:string;
 constructor(directory:string,private protection:Protection){this.file=path.join(directory,'recognition.secure');}
 available(){return this.protection.isEncryptionAvailable();}
 configured(){return this.available()&&fs.existsSync(this.file);}
 read():Credentials{if(!this.available()||!fs.existsSync(this.file)||fs.statSync(this.file).size>8192)throw Error('Recognition credentials unavailable.');try{return credentials(JSON.parse(this.protection.decryptString(fs.readFileSync(this.file))));}catch{throw Error('Recognition credentials unavailable.');}}
 write(value:unknown){if(!this.available())throw Error('Windows secret protection is unavailable.');const c=credentials(value);fs.mkdirSync(path.dirname(this.file),{recursive:true});fs.writeFileSync(`${this.file}.tmp`,this.protection.encryptString(JSON.stringify(c)));fs.renameSync(`${this.file}.tmp`,this.file);}
 remove(){if(fs.existsSync(this.file))fs.unlinkSync(this.file);}
}
