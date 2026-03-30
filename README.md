# Soak Pretext

Interactive demo for a `pretext`-style text layout idea where visible soak elements resize to preserve later anchor positions.

## What It Shows

- A responsive editorial scene with a `1 / 2 / 3 / 4` column selector.
- Soak items that grow or shrink so selected words open columns 2, 3, and 4.
- Soak items rendered as irregular silhouettes instead of plain rectangular reservoirs.
- A drag-and-drop motion palette for stars, moons, sparks, and a hammer, with in-flow avoidance shapes so the text moves out of their way.
- A large moving city silhouette that cuts back into the ad scene rather than sitting like a tiny footer.
- A second scene that treats three paper-like pages as one shared flow and soaks page starts for `Lemma II.` and `Lemma III.`

## Run It

No build step is required.

1. Open [index.html](./index.html) directly in a browser, or
2. Serve the folder with a static server:

```bash
python3 -m http.server 4173
```

Then visit [http://localhost:4173](http://localhost:4173).

## Files

- [index.html](./index.html): page structure and demo controls
- [styles.css](./styles.css): editorial styling, paper styling, skyline, and motion surfaces
- [script.js](./script.js): soak solver, draggable floaters, and scene wiring

## Notes

- The ad copy is original, but it nods to the visual logic of Apple’s 1984 hammer-throw moment.
- The soak solver is deliberately lightweight: it inserts resizable blocks before anchor words and binary-searches their height until the target word reaches the requested future column or page.
