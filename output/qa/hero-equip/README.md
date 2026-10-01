# Hero equipment presentation proof

Owner requested the supplied Archero 2 composition and a Wishfire power bar that shows the higher attack stat. The Gear landing view now surrounds existing full-body art with Hat/Body/Boots cards. Inspecting a card reveals its saved name, rarity, level and bonuses. The bar compares ATK with stored MAG, displays MAG as MATK, and chooses ATK on equality. HERO retains numeric EXP; SKILLS and every saved roster record remain reachable.

Run from this worktree: `node output/qa/hero-equip/verify.cjs` against the existing localhost:8035 server. The installed Playwright dependency is reused. Four phone profiles PASS for separate cards/focus rings, containment above game navigation, level labels, selected inspection, ATK equality/greater and MATK greater, EXP/skills/Back navigation, and unchanged equipment save. Seven focused hero contracts PASS. Browser module syntax check PASS via `node --input-type=module --check < web-runner/systems/renderHeroScreen.js`.

The fixture stages levels 1/7/12 and valid six-stat gear records with Hat MAG+3 and all other bonuses zero, solely to exercise equal attack values. It makes no progression, eligibility or timing claim. The initial malformed fixture and an early render-tick assertion failed; their raw videos remain local. Compact visual review found overlapping cards; spacing was repaired and the separation assertion added before the final PASS.

Native earned profile: 835×1025, DPR2, Canvas CSS [129.5,0,576,1025], backing [1152,2050]. `native-earned.png` shows Fara's existing Guardian Cuirass level1, ATK8/HP83; `native-matk.png` shows Runa MATK16/HP60. These final screenshots were captured through the existing in-app Browser tab. One tab stays open. Raw finalized movie metadata is in video.json; all raw movies remain outside Git.

Existing source-owner mismatch and duplicate canonical/live roster records remain separate owner decisions. Tuning, slots, saved items and ownership are preserved. This lane is not Integration Ready against current main.
