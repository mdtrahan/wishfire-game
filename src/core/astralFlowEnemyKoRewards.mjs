const ENEMY_KO_ASTRAL_FLOW_REWARD_PCT = Object.freeze({
  'high orc': 5,
  gobloc: 5,
  skeleton: 5,
  lizardo: 5,
  orc: 5,
  chimerilass: 5,
  djinn: 5,
  'high gobloc': 10,
  marid: 10,
  troll: 10,
});

export const ASTRAL_FLOW_METER_BLUE = '#1e7bd6';

function numberOr(value, fallback = 0) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
}

function positiveNumberOr(value, fallback = 1) {
  const normalized = numberOr(value, fallback);
  return normalized > 0 ? normalized : fallback;
}

function cleanRewardNumber(value) {
  return Math.round(numberOr(value, 0) * 1000) / 1000;
}

function normalizeEnemyName(enemyName = '') {
  return String(enemyName || '').trim().toLowerCase();
}

export function getEnemyKoAstralFlowRewardPercent(enemyName = '') {
  return ENEMY_KO_ASTRAL_FLOW_REWARD_PCT[normalizeEnemyName(enemyName)] || 0;
}

function clampUnit(value) {
  const normalized = numberOr(value, 0.5);
  if (normalized < 0) return 0;
  if (normalized >= 1) return 0.999999;
  return normalized;
}

function pickCount(min, max, randomUnit = 0.5) {
  const span = Math.max(0, Math.floor(max - min));
  return Math.max(min, Math.min(max, min + Math.floor(clampUnit(randomUnit) * (span + 1))));
}

export function getEnemyKoAstralFlowOrbPresentation(enemyName = '', randomUnit = 0.5) {
  const rewardPercent = getEnemyKoAstralFlowRewardPercent(enemyName);
  if (rewardPercent === 5) {
    const count = pickCount(3, 5, randomUnit);
    return {
      rewardPercent,
      color: ASTRAL_FLOW_METER_BLUE,
      orbScales: Array.from({ length: count }, () => 1),
    };
  }
  if (rewardPercent === 10) {
    const count = pickCount(2, 4, randomUnit);
    return {
      rewardPercent,
      color: ASTRAL_FLOW_METER_BLUE,
      orbScales: Array.from({ length: count }, (_, index) => (index % 2 === 1 ? 1.5 : 1)),
    };
  }
  return {
    rewardPercent: 0,
    color: ASTRAL_FLOW_METER_BLUE,
    orbScales: [],
  };
}

export function applyAstralFlowEnemyKoReward({
  enemyName = '',
  astralFlowAmpPoints = 0,
  astralFlowAmpMax = 18,
  astralFlowAmpReady = 0,
  astralFlowWallet = 0,
} = {}) {
  const rewardPercent = getEnemyKoAstralFlowRewardPercent(enemyName);
  const ampMax = positiveNumberOr(astralFlowAmpMax, 18);
  const currentPoints = Math.max(0, Math.min(ampMax, numberOr(astralFlowAmpPoints, 0)));
  const readyBefore = Number(astralFlowAmpReady || 0) ? 1 : 0;
  const rewardPoints = cleanRewardNumber((ampMax * rewardPercent) / 100);
  const shouldChargeMeter = rewardPercent > 0 && !readyBefore;
  const pointsAfter = shouldChargeMeter
    ? Math.min(ampMax, cleanRewardNumber(currentPoints + rewardPoints))
    : currentPoints;
  const openDraught = shouldChargeMeter && pointsAfter >= ampMax ? 1 : 0;
  const readyAfter = readyBefore || openDraught ? 1 : 0;
  const walletAfter = cleanRewardNumber(Math.max(0, numberOr(astralFlowWallet, 0)) + rewardPoints);

  return {
    enemyName: String(enemyName || ''),
    rewardPercent,
    rewardPoints,
    astralFlowWalletAfter: walletAfter,
    astralFlowAmpPointsAfter: pointsAfter,
    astralFlowAmpReadyAfter: readyAfter,
    openDraught,
  };
}
