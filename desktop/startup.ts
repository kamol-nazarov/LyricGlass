export function loginItemOptions(enabled:boolean,packaged:boolean,executable:string,appPath:string){
  return{openAtLogin:enabled,path:executable,args:packaged?[]:[`"${appPath}"`],name:'LyricGlass'};
}
interface LoginApp{setLoginItemSettings(options:ReturnType<typeof loginItemOptions>):void;getLoginItemSettings(options:{path:string;args:string[]}):{openAtLogin:boolean}}
export function configureStartup(app:LoginApp,enabled:boolean,packaged:boolean,executable:string,appPath:string){
  const options=loginItemOptions(enabled,packaged,executable,appPath);app.setLoginItemSettings(options);
  if(app.getLoginItemSettings({path:options.path,args:options.args}).openAtLogin!==enabled)throw Error('Windows did not apply the startup preference. Check Startup Apps in Windows settings.');
}
