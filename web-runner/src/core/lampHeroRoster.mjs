import {HERO_DEFINITIONS} from './heroDefinitions.mjs';

// Current authored owners, in party order. Combat copies never own lamp gear.
export function lampHeroRoster(progress,{requireComplete=false}={}){
 const ids=Object.keys(HERO_DEFINITIONS),records=progress?.heroes||{};
 const missing=ids.filter(id=>records[id]?.heroInstanceKey!==id);
 if(requireComplete&&missing.length)throw new Error('Equipment is unavailable: hero records are missing or invalid. Your gear is preserved.');
 return ids.filter(id=>!missing.includes(id)).map(id=>records[id]);
}
