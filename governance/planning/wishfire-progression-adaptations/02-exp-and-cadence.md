# 02 — EXP costs and lamp cadence

Status: the numeric trial below was declined. Current implementation retains the owner-selected tuning: 25 EXP per stored draw, a two-second manual minimum, five-second Auto cadence and ceil(100×level^1.5) costs. Verified against candidate `4338182d`.

**Historical trial goal:** Reach party Lv5 in roughly 22–30 minutes.

## Owner decision

Owner reply: **Keep current tuning**. Retain the existing ceil(100×level^1.5) EXP curve,25 EXP per stored draw, two-second saved minimum and five-second Auto cadence. The proposed eight-second/150-draw trial and1500 later-cost floor are declined. Their numeric criteria have an explicit owner exception; normal-play progression, overflow, capacity and timing evidence still apply. The22–30-minute trial target remains historical proposal context. Battle EXP policy is a separate pending choice.

## Declined trial

Award 25 EXP to each hero per successfully stored draw. Use one shared eight-second interval for manual and Auto draws; the first draw can happen immediately. Clicking repeatedly cannot queue rewards or bypass the cooldown.

| Transition | EXP cost | Draws | Cumulative draws |
|---|---:|---:|---:|
| Lv1 → 2 | 500 | 20 | 20 |
| Lv2 → 3 | 750 | 30 | 50 |
| Lv3 → 4 | 1,000 | 40 | 90 |
| Lv4 → 5 | 1,500 | 60 | 150 |

149 intervals take 19m52s at uninterrupted minimum cadence. Review and guidance time should bring a natural session toward the trial target. This is a tuning hypothesis, not a measured retention result. Retain the Lv5 Auto gate during the first trial so only cadence and EXP change.

A full cache blocks item creation and EXP. Auto stops at full capacity and requires the player's next enabling action. Equipping and dismantling add no extra EXP. Level transitions carry overflow and reset the meter to the remainder.

## Acceptance

Run a fresh lamp-only session without accelerators. Record every level transition and the moment all four heroes reach Lv5 and Auto unlocks. Confirm 150 successful draws under this trial. Run a second session with ordinary comparison and reading pauses. Spam input and show that it cannot accelerate the cadence. Measure cache-review time separately.

## Dependencies and approval

Audit battle and other EXP sources before tuning combined progression; preserve authorized rewards while identifying their contribution. Owner must approve the duration target, interval, costs and battle EXP policy. Define Lv5 onward before release: adopting only these early costs could create a later cost drop against the existing curve.
