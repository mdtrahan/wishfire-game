# Auto Equip total-hero CP correction

An ordinary 69-draw film on a4032e5 exposed four selected item-CP leaders that yielded zero/negative total hero gains, while21 later candidates were useful. Sheet05 requires positive total hero CP, matching slots, one piece per hero/four total, and recipient ties by maxHP then stable party order.

The shared selector now uses lampItemCPGain for eligibility and recipient ranking. Eligible candidates retain the displayed descending item-CP order; allocation scans the full eligible list rather than cutting it to four first. Existing saved transactions enforce unique recipients and four maximum. Raw generation, manual downgrades, progression/tuning and owner keys remain unchanged.

The frozen earned batch is tests/fixtures/lamp-auto-earned-69.json. The regression was RED before and GREEN after; all32 lamp transaction checks pass. Four-phone storage replay returns Runa+0.3, Fara+9.9, Hondo+1.4, Kaja+6.6, preserves1725partyEXP and all hero progression, and leaves27pieces for dismantling (25pending leftovers plus two replaced pieces). A separately arranged high-owned/weak-candidate variant disables Auto Equip. The first browser assertion omitted replaced pieces from that count; the guard was corrected. Raw fixture movies remain local and are excluded from timing.

Native in-app Browser entry on localhost:8036 used an ordinary new profile and one real draw. Preview gains were Fara10.1/Hondo11.1/Runa7/Kaja7.3. Auto chose Hondo and emitted saved+11.1. native-before.png/native-receipt.png retain that seam; the existing tab was reused. The8035profile remains separately preserved.

The first corrected ordinary movie reaches100draws, essence conversion, earned upgrade, full-storage stop/reload and Hero inspection, then its recorder wrongly waited for Gear while the retained Skills tab was active. Its raw movie and events remain in ordinary-flow-attempt-1. Actual review also found short-header portrait/CP overlap. Hero owner checkpoint2b234e7 fixes that separately; this lane carries the narrow dependency as e2e08a3. The next complete replay explicitly chooses Gear on return.

Canonical/live equipment projection remains failed and owner-dependent. This feature evidence is separate from final model decisions and Integration Ready.

Checks: node --test tests/lampEquipment.test.mjs; node output/qa/auto-cp/verify.cjs. The ordinary recorder uses only real inputs, fresh storage, owner-kept manual2s/Auto5s timing and current provisional essence prices.
