import{useEffect}from'react';
import type{SettingsNavigation}from'../../shared/ui';
export function useSettingsNavigation(target:SettingsNavigation|undefined){
  useEffect(()=>{
    if(target?.section==='match'){
      document.getElementById('match-section')?.scrollIntoView({block:'start',behavior:'instant'});
      document.getElementById('match-search')?.focus({preventScroll:true});
    }else if(target)window.scrollTo({top:0,behavior:'instant'});
  },[target?.request,target?.section]);
}
