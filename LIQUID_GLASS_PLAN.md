# Liquid Glass Wallpaper — Design Plan

> Mimics Apple's iOS 26 "Liquid Glass" aesthetic in a static PNG rendered by Satori/vercel-og.
> Real backdrop-blur is impossible in a PNG, so every effect is *simulated* with layered
> gradients, specular highlights, and controlled transparency.

---

## What iOS 26 Liquid Glass actually is

Apple's Liquid Glass is a UI material with five simultaneous properties:

| Property | What you see |
|---|---|
| **Translucency** | Whatever is behind the panel shows through, blurred |
| **Specular highlight** | A bright "shine" line at the top/inner edges — light refracting through glass |
| **Internal depth gradient** | The glass interior is slightly darker at bottom, lighter at top — physical thickness |
| **Refractive distortion** | Subtle warping of the content underneath (magnification at edges) |
| **Ambient color bleed** | The glass tints slightly toward the dominant color behind it |

In a static PNG we can simulate all of them except real-time blur/distortion.

---

## Simulation strategy

### Layer 1 — Background atmosphere

Keep the black background but add a very subtle warm glow in the safe zone center
to simulate ambient color "bleeding" behind the glass:

```
background: radial-gradient(ellipse 900px 600px at 50% 55%,
  rgba(255,105,60,0.04) 0%,    // very faint orange warmth (our accent color)
  rgba(20,10,5,0.0) 70%,
  transparent 100%
)
```

This makes the background feel like it has a light source — the glass will appear to
react to it.

---

### Layer 2 — The main glass card

Wrap the entire reminder block (header + items + footer) in one glass card:

```jsx
<div style={{
  background: "linear-gradient(160deg, rgba(28,20,16,0.88) 0%, rgba(10,7,5,0.94) 50%, rgba(18,12,8,0.90) 100%)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderTop: "1.5px solid rgba(255,255,255,0.22)",    // specular top edge
  borderLeft: "1px solid rgba(255,255,255,0.13)",
  borderRadius: 32,
  boxShadow: [
    "0 0 0 1px rgba(0,0,0,0.5)",                      // tight outline
    "0 2px 0 0 rgba(255,255,255,0.08) inset",         // inner top glow
    "0 -1px 0 0 rgba(0,0,0,0.4) inset",               // inner bottom shadow
    "0 32px 64px rgba(0,0,0,0.7)",                     // deep drop shadow
    "0 8px 24px rgba(255,105,60,0.04)",                // faint orange ambient
  ].join(", "),
  padding: "28px 36px",
  marginLeft: SIDE_PAD - 8,
  marginRight: SIDE_PAD - 8,
}}/>
```

The critical detail: `borderTop` at `rgba(255,255,255,0.22)` is the specular highlight —
the bright line where "light hits the top edge of the glass". This single detail sells the
entire glass illusion.

---

### Layer 3 — Individual item rows as micro-glass panels

Each reminder row gets its own lightweight glass treatment (thinner, more transparent than
the main card):

```jsx
// Pending item
background: "linear-gradient(180deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.015) 100%)"
border: "1px solid rgba(255,255,255,0.06)"
borderTop: "1px solid rgba(255,255,255,0.12)"   // per-row specular
borderRadius: 14

// Done item (even more transparent, de-emphasized)
background: "rgba(255,255,255,0.01)"
border: "1px solid rgba(255,255,255,0.03)"
```

---

### Layer 4 — Orange accent redesign (glowing, not flat)

The orange bar and numbers go from flat orange → luminous orange:

```jsx
// Left accent bar
background: "linear-gradient(180deg, #FF8C5A 0%, #FF5A1A 100%)"
boxShadow: "0 0 12px rgba(255,105,60,0.7), 0 0 4px rgba(255,105,60,0.9)"
borderRadius: 3

// Number labels
color: "#FF8C5A"   // slightly lighter orange for glass environment
textShadow: "0 0 16px rgba(255,105,60,0.5)"
```

---

### Layer 5 — Header divider as light refraction line

Instead of a thin orange line, the divider becomes a specular refraction effect:

```jsx
<div style={{
  height: 1,
  background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.20) 20%, rgba(255,105,60,0.35) 50%, rgba(255,255,255,0.20) 80%, transparent 100%)",
  marginBottom: 22,
}}/>
```

This reads as light refracting through the glass edge — white peaks at the extremes,
orange in the center (our accent color bleeding through).

---

### Layer 6 — Quote state glass card

The empty/quote state gets a single elegant glass panel centered on screen:

```jsx
<div style={{
  background: "linear-gradient(145deg, rgba(30,20,12,0.85) 0%, rgba(8,5,3,0.92) 100%)",
  borderTop: "1.5px solid rgba(255,255,255,0.20)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 28,
  padding: "52px 48px",
  boxShadow: "0 24px 60px rgba(0,0,0,0.75), 0 0 0 1px rgba(0,0,0,0.5)",
}}/>
```

---

## Layout changes needed alongside glass

| Current | With Liquid Glass |
|---|---|
| Content flush to screen edges with `SIDE_PAD` | Content inside a card with internal padding — card itself gets outer margin |
| Items separated by `1px solid #0A0A0A` | Items separated by their own glass panel borders + a tiny gap between rows |
| Black background flat | Background has radial warm glow behind card position |
| Header sits in same flow as items | Header rendered separately above the glass card (floats above it) OR inside the card with extra top padding |
| Signature/timestamp outside card | Floated below/outside the glass card |

---

## Implementation steps (file: `app/api/image/route.tsx`)

### Step 1 — Background warmth layer
Add a second `<div>` absolutely-positioned background with the radial orange glow.

### Step 2 — Glass card wrapper
Wrap `sorted.map(...)` and the header in a single glass `<div>` with the styles in Layer 2.
Adjust `SIDE_PAD` and `topPad` to account for the card's own padding.

### Step 3 — Per-row glass panels
Each reminder row `<div>` gets its own background/border from Layer 3.
Replace `borderBottom` separators with `gap: 4` between rows (gap between glass panels).

### Step 4 — Orange glow effects
Add `textShadow` and `boxShadow` to orange accent elements (Layer 4).

### Step 5 — Divider refraction
Replace the flat orange divider with the gradient refraction line (Layer 5).

### Step 6 — Quote state card
Wrap the quote content in a glass panel (Layer 6). Adjust centering math.

### Step 7 — Signature area
Add a small separate glass pill/strip at the bottom for the signature, e.g.:
```jsx
<div style={{
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.05)",
  borderRadius: 16,
  padding: "8px 16px",
}}>
  <SignatureEl />
</div>
```

---

## Satori constraints to keep in mind

- No `backdrop-filter` — simulate with opacity + gradients only
- `boxShadow` works but `inset` + multiple shadows all must be in one comma-joined string
- `textShadow` is supported in Satori
- `borderRadius` on `<div>` works fully
- No `::before`/`::after` pseudo-elements — simulate with absolutely-positioned child `<div>` elements
- `overflow: hidden` clips children to `borderRadius` correctly
- Multiple background layers are **not** supported — use stacked `<div>` elements instead of `background-image` with multiple values

---

## What it will look like

Imagine holding a premium dark glass tile with a faintly orange-lit interior against a black
background. The top edge gleams. The orange numbers have a soft halo. The reminder text is
crisp white through the glass. The whole block feels like it's floating slightly above the
wallpaper — not painted on it.

That's the target.

---

*Ready to implement on approval. Estimated changes: ~120 lines modified in route.tsx.*
