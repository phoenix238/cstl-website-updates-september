# Brief: "Every Scale", a standalone page from space to atom and back

## What it is
A standalone web page for Craniosacral Therapy London (Phoenix, CSTA registered; clinics in Bethnal Green and Waterloo). As you scroll, one continuous zoom travels:

**outer space → Earth → through the clouds → the land → a plant or leaf → plant cells → an atom → out through the nucleus → back into space** (ending where it started, so it loops).

It works like the film *Powers of Ten*: a short caption and a scale readout (10⁹ m … 10⁻¹⁵ m) at each step. The link to the therapy is quiet: the body is layers inside layers, connected at every scale, like fascia.

## The first attempt (reference only)
- Live preview: https://deploy-preview-1--nimble-salmiakki-70ec4c.netlify.app/concepts/11-every-scale.html
- Code: `concepts/11-every-scale.html` on branch `claude/admiring-turing-5ul11e` in `phoenix238/cstl-website-updates-september`. It is one WebGL fragment shader, and it needs `concepts/shared.js` and `concepts/shared.css`.
- Verdict: **love the concept, the execution was terrible.** Treat it as a sketch of the structure, not something to polish.
- What roughly worked: leaf veins turning into plant cells; the atom's electron cloud drawn as stippled dots that scatter into stars on the way back out to space.
- What didn't: the Earth goes blurry when close up; the cloud layer hides the Earth-to-land jump rather than making it feel seamless; the tree and land look crude; the overall look didn't land.

## Taste: what Phoenix likes and dislikes
- **Artistic, not spiritual.** It should feel like art or science illustration, never "miracle work". No chakras, auras or glowing energy symbols.
- **Soft and calm, not busy or hectic.** Big, busy animations get "love the concept, hate the execution". Quiet, soft details get liked.
- **Hand-made and painterly.** Organic and flowing; no hard, modern or futuristic lines, especially around images. Images should blend into the backdrop.
- **Colour:** soft pastels: peach `#f2b8a0`, apricot `#f6cf9f`, lilac `#c9b6e4`, mint `#a9d3c9`, blue `#9fb4d8`, cream `#fbf4ec`, and a soft indigo `#232548` for space. Not bold or saturated. No heavy grain or old-paper texture.
- **Scrolling:** never trap people. An earlier pinned band you couldn't scroll past was annoying. Scroll freely, and include a clear way to skip.
- **Inspiration:** Pinterest "micro to macro" board https://pin.it/30bUXT99M and the body board https://pin.it/4xaqfunfK. Also a YouTube short Phoenix liked for its painterly micro/macro nature feel: https://www.youtube.com/shorts/FcK--rzZfpA

## Suggested approach
- Make each scale a real piece of art in its own right: illustrated or painted layers, possibly real macro and microscope imagery, rather than one procedural shader trying to do everything.
- Transitions matter most. Aim for moments where one scale genuinely becomes the next (leaf veins → cell walls worked). Plan a real bridge for Earth → land.
- Keep captions short and grounded. Draft captions from the first attempt:
  - Space: "From far away, the whole planet is one small, bright stone."
  - Earth: "Closer, it has weather: water and air moving in slow, steady cycles."
  - Land: "Rivers, hedgerows and roots: the same branching patterns repeat at every size."
  - Leaf: "A leaf keeps its shape with a web of veins, a bit like fascia: layer inside layer, all connected."
  - Cells: "Each cell is held by the ones around it. Inside, everything is quietly moving."
  - Atom: "And at the smallest scale, almost everything is space."
  - Space again: "Look closely enough and it opens out again."
- End with a gentle link back to the practice and booking (the main site is craniosacral therapy in London).
- Must work well on phones, respect reduced-motion settings (hold on each scale with short dissolves) and stay light enough to run smoothly.
- Build it as previews for Phoenix to review before anything goes live. The main site is deployed through Netlify from this repo's `main` branch, so don't touch that.
