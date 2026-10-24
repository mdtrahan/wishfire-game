export function formatCompactCount(value){
 if(!Number.isFinite(value)||value<=0)return'0';
 const count=Math.floor(value);
 if(count<10000)return count.toLocaleString('en-US');
 const [unit,suffix]=count>=1e9?[1e9,'B']:count>=1e6?[1e6,'M']:[1e3,'K'];
 const tenths=Math.floor(count/(unit/10));
 return Math.floor(tenths/10)+(tenths%10?'.'+tenths%10:'')+suffix;
}
