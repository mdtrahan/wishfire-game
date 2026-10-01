# Lamp reveal feedback review

Owner request: make the puff readable and add scale-up to the equipment bounce.

The shared manual/Auto presentation holds the puff at full opacity for 585 ms and fades it through 900 ms. Equipment appears around 650 ms at 65% scale, reaches 115% with an upward bounce, and settles at 100% by 1.35 seconds. The emission presentation clears after 1.45 seconds. The existing two-second generation gate remains unchanged.

## Player-facing evidence

- `lamp-reveal-feedback.webm`: recorded fresh player journey, eight manual emissions, cache review, eight skips, Dismantle All, and the next emission.
- `../../test-results/lamp/reveal-feedback/annotated-timing.png`: decoded video frames at 200 ms intervals. Around 13.8–14.2 seconds the fifth arrival is a visible puff; 14.4 seconds shows its fade and gear appearance; 14.6–14.8 seconds shows the gear growing and bouncing; 15.0 seconds shows the settled item.
- `../../test-results/lamp/reveal-feedback/in-app-final.png`: direct in-app lamp click on the reloaded build captured the held puff and cache count increasing to two.

The recording driver asserts full puff opacity and hidden equipment around 480 ms, then equipment scale above 105% around 1.03 seconds. It also verifies five arrival icons after eight emissions, zero cache and zero arrival icons after dismantling, exactly one icon after the next emission, and no page errors. The driver passed. JavaScript syntax and diff whitespace checks passed.

Motion is the only runtime change in this revision. Manual and Auto route through the same emission helper.
