# Hero equipment presentation proof

Owner requested the supplied Archero 2 composition and a Wishfire power bar that shows the higher attack stat. The Gear landing view now surrounds centered full-body art with six boxes: Hat/Body/Boots on the left, two blank equipment boxes and a disabled future Orbs slot on the right. Inspecting a card reveals its saved name, rarity, level and bonuses. The bar compares ATK with stored MAG, displays MAG as MATK, and chooses ATK on equality. HERO retains numeric EXP; SKILLS and every saved roster record remain reachable.

Run from this worktree: `node output/qa/hero-equip/verify.cjs` against the existing localhost:8035 server. The installed Playwright dependency is reused. Four phone profiles PASS for separate cards/focus rings, containment above game navigation, level labels, selected inspection, ATK equality/greater and MATK greater, EXP/skills and primary VAULT/HERO navigation, and unchanged equipment save. The focused Hero screen contract PASS. Browser module syntax check PASS via `node --input-type=module --check < web-runner/systems/renderHeroScreen.js`.

The fixture stages levels 1/7/12 and valid six-stat gear records with Hat MAG+3 and all other bonuses zero, solely to exercise equal attack values. It makes no progression, eligibility or timing claim. The initial malformed fixture and an early render-tick assertion failed; their raw videos remain local. Compact visual review found overlapping cards; spacing was repaired and the separation assertion added before the final PASS.

Native earned profile: 835×1025, DPR2, Canvas CSS [129.5,0,576,1025], backing [1152,2050]. `native-earned.png` shows Fara's existing Guardian Cuirass level1, ATK8/HP83; `native-matk.png` shows Runa MATK16/HP60. These final screenshots were captured through the existing in-app Browser tab. One tab stays open. Raw finalized movie metadata is in video.json; all raw movies remain outside Git.

Existing source-owner mismatch and duplicate canonical/live roster records remain separate owner decisions. Tuning, saved item types, items and ownership are preserved. This lane is not Integration Ready against current main.

Owner follow-up removes Back because Hero belongs to main navigation. The revised four-phone guard requires no Back control and leaves/reenters through VAULT/HERO; shared navigation remains the exit path.

Full-flow review found portrait/CP overlap in the short HERO/SKILLS header. The non-Gear portrait now occupies the lower45% of that existing header; the four-phone guard verifies its box starts below the CP title. The larger Gear stage remains separate from the short header.

Latest owner composition: Gear has six square boxes in two columns and a centered portrait. The two right-hand equipment placeholders are blank and unassigned; Orbs stays disabled until that system exists. Skill descriptions render only in the Skills tab. The four-phone guard asserts exact box counts, column order, blank placeholders, disabled Orbs, focus-ring separation and no skill articles in Gear. `native-six-boxes.png` captures the earned profile after this change; earlier native images and films show superseded presentation.

Latest raw fixture film is retained and hash-ledgered. `/opt/homebrew/bin/ffprobe` failed to load `libx265.215.dylib`; its duration remains unverified. Final native screenshot and four-phone browser assertions provide the UI proof. No dependency installation was attempted.
