# Enemy Behavior Scripts

Enemy behavior should be readable in seconds. A combatant script answers four questions:

1. Opening
2. Loop
3. Rules
4. Fallback

Do not write behavior trees, utility scores, state machines, or hidden dice rolls for normal enemy action choice. Wishfire already has variety from the gem board, turn order, party composition, target preference, cards, and progression. Enemy behavior should be one of the stable things players learn.

## Authoring Template

### Enemy Name

Primary style: Melee or Magic

Target preference: optional existing targeting preference

Opening

- First action

Loop

- Repeating action 1
- Repeating action 2

Rules

- Plain rule sentence.
- Else next rule sentence.
- Repeat prevention sentence if needed.

Fallback

- Safe action if the script cannot use the intended action

## Style Rules

Each enemy should have one clear identity.

- A healer heals and casts.
- A mage casts and pressures the board.
- A brute attacks with melee.
- A tank absorbs pressure and uses simple physical actions.
- A gem locker pressures the board before casting.

Use Magic OR Melee as the default identity. Do not alternate melee and magic just to add variety. Only use both when the combatant is intentionally designed as a hybrid.

Use existing target preference for who the combatant wants to affect. The behavior script chooses what action to take. Target preference chooses who receives it.

## Allowed Script Parts

Opening is the first scripted action unless a rule must interrupt it.

Loop is the repeating rhythm after opening. The loop should be short.

Rules are simple interrupts. Use one or two when possible. Rules are checked in order, top to bottom.

Fallback is the reliable action when a rule or scripted action cannot be used.

## Repeat Prevention

Repeat prevention should stop annoying spam, not make enemies unpredictable.

Good repeat prevention examples:

- Scathe cannot be used twice in a row.
- Sweep cannot be used twice in a row.
- Healing cannot occur twice in a row unless a critical heal is required.
- Heavy attacks cannot be used twice in a row.

After a rule fires, the combatant resumes its normal loop on its next action.

Critical heal means self or an ally is at 25 percent HP or lower.

## Current Action Vocabulary

Use these action names in scripts:

- Melee Attack
- Magic Attack
- Scathe
- Sweep
- Heal Self
- Heal Ally
- Heal Party

Add new action names only when the runtime already has a matching enemy skill and the combatant needs a distinct identity.

## Examples

### Gobloc

Primary style: Melee

Opening

- Melee Attack

Loop

- Melee Attack

Rules

- None

Fallback

- Melee Attack

### Djinn

Primary style: Magic

Opening

- Scathe

Loop

- Magic Attack
- Magic Attack

Rules

- Scathe cannot be used twice in a row.
- If no lockable gems exist, use Magic Attack.

Fallback

- Magic Attack

### Marid

Primary style: Magic

Opening

- Sweep

Loop

- Magic Attack
- Magic Attack

Rules

- Sweep cannot be used twice in a row.
- If no lockable gems exist, use Magic Attack.

Fallback

- Magic Attack

### Chimerilass

Primary style: Magic

Opening

- Magic Attack

Loop

- Magic Attack

Rules

- Heal Party if two or more allies are damaged.
- Else Heal Ally if any ally is damaged.
- Else Heal Self below 50 percent HP.
- Healing cannot occur twice in a row unless a critical heal is required.

Fallback

- Magic Attack

## Runtime Notes

The runtime may store the current turn count and last used skill to execute these scripts. Designers do not need to author those fields.

The script should stay close to the four-section format above. If a combatant needs many conditions, split the idea into a simpler enemy or make one signature behavior more important.
