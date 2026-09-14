export const ROUTINE_ENEMY_TEMPLATE=Object.freeze({HP:45,ATK:2,DEF:4,MAG:2,RES:4,SPD:7});
export function scaleRoutineEnemy(row={},level=1){const scale=1+(Math.max(1,Number(level)||1)-1)*.06;const stats=Object.fromEntries(Object.entries(ROUTINE_ENEMY_TEMPLATE).map(([key,value])=>[key,Math.max(1,Math.floor(value*scale))]));return {...row,...stats,HP:stats.HP,maxHP:stats.HP,routineTier:'routine'};}
