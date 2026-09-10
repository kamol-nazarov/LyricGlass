export function initialSettingsPage(args:string[],paired:boolean,packaged:boolean):'general'|'match'|null{
  if(args.includes('--match'))return 'match';
  if(args.includes('--settings'))return 'general';
  // Installed launches stay in the tray. Development retains the first-run setup window.
  return !packaged&&!paired?'general':null;
}
