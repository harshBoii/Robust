# Theme Toggle Implementation Plan

## Overview
Add a theme toggle button to the sidebar that allows users to switch between multiple theme variants. Based on the example themes provided, we'll implement a multi-theme system supporting: **Default** (parchment), **Dark** (gold leaf), **Monochrome** (editorial), and **Minimal** (Render-inspired).

## Theme Variants

### 1. Default (Light)
- **Palette**: Parchment + Rich Navy + Burnt Orange
- **Background**: Warm parchment (#FAF8F2)
- **Primary**: Burnt orange
- **Style**: Glassmorphism with warm tones

### 2. Dark
- **Palette**: True Black + Gold Leaf
- **Background**: Near-true black (#0E0C0A)
- **Primary**: Gold leaf
- **Style**: Glassmorphism with gold accents

### 3. Monochrome (Light)
- **Palette**: Editorial white & ink
- **Background**: Pure white
- **Primary**: Near-black
- **Style**: Flat, no glassmorphism, pure greys

### 4. Monochrome Dark
- **Palette**: Editorial black & white
- **Background**: Near-black
- **Primary**: Near-white
- **Style**: Flat, layered graphite surfaces

### 5. Minimal (Light)
- **Palette**: Render.com inspired
- **Background**: Pure white
- **Primary**: Slate-indigo
- **Style**: Flat surfaces, hairline borders, precise shadows

### 6. Minimal Dark
- **Palette**: Deep graphite + Slate-indigo
- **Background**: Deep graphite (#0e0f11)
- **Primary**: Bright slate-indigo
- **Style**: Flat, layered graphite, minimal glow

## Files to Create

### 1. `/app/components/ThemeProvider.tsx`
**Purpose**: Context provider to manage theme state, persist to localStorage, and apply theme classes to html element.

**Key Requirements**:
- Support theme modes: 'default' | 'dark' | 'monochrome' | 'monochrome-dark' | 'minimal' | 'minimal-dark' | 'system'
- Persist preference to localStorage
- Detect system preference for 'system' mode (maps to default/dark based on OS)
- Apply appropriate classes to `<html>` element:
  - Default: no class (or 'light')
  - Dark: 'dark'
  - Monochrome: 'monochrome'
  - Monochrome Dark: 'dark monochrome' or 'monochrome dark'
  - Minimal: 'minimal'
  - Minimal Dark: 'minimal dark' or 'dark minimal'
- Handle hydration mismatch with suppressHydrationWarning

**Implementation Notes**:
- Use React Context + useState for state management
- Use useEffect to initialize from localStorage and listen for system changes
- Match existing code patterns (no external theme libraries needed)

### 2. `/app/components/UI/ThemeToggle.tsx`
**Purpose**: Button component that opens a theme selector dropdown or cycles through themes.

**Key Requirements**:
- Use Palette icon from lucide-react (or Sun/Moon for simple toggle)
- Show current theme state
- Either:
  - **Option A**: Click to cycle through themes (default → dark → monochrome → monochrome-dark → minimal → minimal-dark → system → default)
  - **Option B**: Click to open dropdown with all theme options
- Match sidebar button styling (glassmorphic, icon-only)
- Add tooltip on hover showing current theme name

**Styling**:
- Match existing sidebar button pattern (w-10 h-10, rounded-xl, glass effect)
- Use `text-muted-foreground` default, `text-primary` when active

### 3. `/app/globals.css` (Append new theme blocks)
**Purpose**: Add CSS theme definitions for all variants.

**Structure**:
```css
/* Default theme (already exists) */
:root { ... }

/* Dark theme (already exists) */
.dark { ... }

/* Monochrome Light */
.monochrome:not(.dark) { ... }

/* Monochrome Dark */
.dark.monochrome, .monochrome.dark { ... }

/* Minimal Light */
.minimal { ... }

/* Minimal Dark */
.minimal.dark, .dark.minimal { ... }
```

## Files to Modify

### 4. `/app/layout.tsx`
**Changes**:
- Import ThemeProvider
- Wrap children with ThemeProvider
- Add suppressHydrationWarning to html element

### 5. `/app/components/sideBar/SideBar.tsx`
**Changes**:
- Import ThemeToggle
- Add ThemeToggle button in the bottom utilities section (around line 700, grouped with Help, Privacy, Terms, Profile, Logout)
- Position it above the divider line, in the utilities group

## Implementation Steps

1. **Update globals.css** - Add monochrome and minimal theme blocks (adapted from examples)
2. **Create ThemeProvider** - Manage theme state with localStorage persistence
3. **Create ThemeToggle** - Theme selector button with icon
4. **Update layout.tsx** - Wrap with ThemeProvider
5. **Update SideBar.tsx** - Add ThemeToggle to utilities section
6. **Test all six themes** - Verify each applies correctly
7. **Test system mode** - Verify OS preference detection
8. **Verify persistence** - Theme persists across reloads

## CSS Adaptation Notes

From the example themes, adapt these key aspects:

### Monochrome Themes
- Remove all chroma (use oklch with 0 chroma)
- Flat surfaces (no backdrop-filter)
- Clean borders (no glassmorphism)
- Pure greys only

### Minimal Themes
- Slate-indigo accent (oklch(0.46 0.18 262))
- Flat white/dark surfaces
- Hairline borders (1px solid rgba)
- Minimal shadows (no glow effects)
- Remove bokeh/ambient effects
- Clean inputs with focus rings

### Key CSS Variables to Define Per Theme
- `--background`, `--foreground`
- `--primary`, `--primary-foreground`
- `--muted`, `--muted-foreground`
- `--card`, `--card-foreground`
- `--border`, `--input`, `--ring`
- `--glass-bg`, `--glass-border`, `--glass-shadow`
- `--sidebar-*` variants
- `--sibling-*` brand tokens

## Testing Checklist

- [ ] All 6 themes apply correctly
- [ ] System mode respects OS preference
- [ ] Theme persists after page reload
- [ ] No hydration warnings in console
- [ ] Toggle shows correct theme name in tooltip
- [ ] Button styling matches sidebar design
- [ ] Glassmorphism works in default/dark, disabled in monochrome/minimal
- [ ] Colors are accessible (contrast ratios)
- [ ] Smooth transitions between themes


themes to add 

@import "tailwindcss";
/* @import "tw-animate-css"; */


@custom-variant dark (&:is(.dark *));


@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);

  --font-heading: var(--font-playfair), 'Playfair Display', Georgia, 'Times New Roman', serif;
  --font-label:   var(--font-dm-sans),  'DM Sans',  system-ui, -apple-system, sans-serif;
  --font-body:    var(--font-outfit),   'Outfit',   system-ui, -apple-system, sans-serif;

  --color-sibling-primary:        var(--sibling-primary);
  --color-sibling-primary-light:  var(--sibling-primary-light);
  --color-sibling-primary-dark:   var(--sibling-primary-dark);
  --color-sibling-accent:         var(--sibling-accent);
  --color-sibling-accent-light:   var(--sibling-accent-light);
  --color-sibling-surface:        var(--sibling-surface);
  --color-sibling-surface-hover:  var(--sibling-surface-hover);

  --color-alien-glow-green:   var(--alien-glow-green);
  --color-alien-core-green:   var(--alien-core-green);
  --color-alien-accent-green: var(--alien-accent-green);

  --color-success:            var(--success);
  --color-success-foreground: var(--success-foreground);
  --color-warning:            var(--warning);
  --color-warning-foreground: var(--warning-foreground);
  --color-info:               var(--info);
  --color-info-foreground:    var(--info-foreground);

  --color-tier-free:       var(--tier-free);
  --color-tier-pro:        var(--tier-pro);
  --color-tier-business:   var(--tier-business);
  --color-tier-enterprise: var(--tier-enterprise);
  --color-tier-trial:      var(--tier-trial);

  --font-sans:    var(--font-outfit),    'Outfit',    system-ui, sans-serif;
  --font-mono:    var(--font-fira-code), 'Fira Code', ui-monospace, monospace;
  --font-sidebar: var(--font-dm-sans),   'DM Sans',   system-ui, sans-serif;
  --color-sidebar-ring:               var(--sidebar-ring);
  --color-sidebar-border:             var(--sidebar-border);
  --color-sidebar-accent-foreground:  var(--sidebar-accent-foreground);
  --color-sidebar-accent:             var(--sidebar-accent);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-primary:            var(--sidebar-primary);
  --color-sidebar-foreground:         var(--sidebar-foreground);
  --color-sidebar:                    var(--sidebar);
  --color-chart-5:     var(--chart-5);
  --color-chart-4:     var(--chart-4);
  --color-chart-3:     var(--chart-3);
  --color-chart-2:     var(--chart-2);
  --color-chart-1:     var(--chart-1);
  --color-ring:        var(--ring);
  --color-input:       var(--input);
  --color-border:      var(--border);
  --color-destructive:          var(--destructive);
  --color-accent-foreground:    var(--accent-foreground);
  --color-accent:               var(--accent);
  --color-muted-foreground:     var(--muted-foreground);
  --color-muted:                var(--muted);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-secondary:            var(--secondary);
  --color-primary-foreground:   var(--primary-foreground);
  --color-primary:              var(--primary);
  --color-popover-foreground:   var(--popover-foreground);
  --color-popover:              var(--popover);
  --color-card-foreground:      var(--card-foreground);
  --color-card:                 var(--card);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 6px);
}


/* ========================================
   BOKEH KEYFRAMES
   ======================================== */

@keyframes bokeh-drift-a {
  0%, 100% { transform: translate(0, 0)       scale(1.00); }
  33%       { transform: translate(50px, -40px) scale(1.08); }
  66%       { transform: translate(-30px, 28px) scale(0.94); }
}
@keyframes bokeh-drift-b {
  0%, 100% { transform: translate(0, 0)        scale(1.00); }
  40%       { transform: translate(-45px, 32px) scale(1.05); }
  75%       { transform: translate(28px, -48px) scale(0.97); }
}
@keyframes bokeh-drift-c {
  0%, 100% { transform: translate(0, 0)       scale(1.00); }
  50%       { transform: translate(36px, 36px) scale(1.10); }
}


/* ======================================================
   LIGHT MODE
   Palette: Parchment + Rich Navy + Burnt Orange

   Background  oklch(0.98 0.010 85)   #FAF8F2  Warm parchment
   Ink         oklch(0.20 0.06  240)  #151D35  Rich navy
   Primary     oklch(0.55 0.18  35)   #C4550A  Burnt orange
   Muted       oklch(0.52 0.03  240)  #606678  Navy-grey
   Border      oklch(0.91 0.008 240)  #E0E2EC  Cool-tinted

   Glass philosophy:
   ─ bg is warm parchment-tinted (not cold white)
   ─ borders are navy-tinted dark edge on light bg
   ─ top border is bright warm-white refraction
   ─ shadows are navy-tinted, deep and soft
   ─ active/hover state echoes burnt orange
   ─ the tension of warm bg + cool navy ink
     makes burnt orange feel vivid as a CTA
   ====================================================== */
:root {

    /* Mesh gradient — 3 anchored soft blobs in your brand palette:
     Burnt orange (top-left) · Navy (bottom-right) · Golden warmth (center)
     All kept ≤8% so they read as warm parchment, not a colored page */
/* In :root — replaces your current --page-mesh */


  --radius: 0.75rem;

  /* ── Brand tokens ── */
  --sibling-primary:       oklch(0.55 0.18 35);    /* Burnt orange         */
  --sibling-primary-light: oklch(0.68 0.15 35);    /* Orange mid           */
  --sibling-primary-dark:  oklch(0.40 0.18 35);    /* Deep burnt           */
  --sibling-accent:        oklch(0.28 0.07 240);   /* Rich navy            */
  --sibling-accent-light:  oklch(0.40 0.08 240);   /* Navy mid             */
  --sibling-surface:       oklch(0.98 0.010 85);   /* Warm parchment       */
  --sibling-surface-hover: oklch(0.95 0.012 85);   /* Parchment hover      */

  /* ── Alien greens ── */
  /* Neutral navy option — elegant, no color clash */
/* In :root — replace alien green tokens */

/* --alien-glow-green:   oklch(0.72 0.16 65 / 0.22);
--alien-core-green:   oklch(0.58 0.18 65 / 0.36);
--alien-accent-green: oklch(0.44 0.16 65 / 0.44); */

  --alien-glow-green:   oklch(0.72 0.16 65 / 0.22);
  --alien-core-green:   oklch(0.58 0.18 65 / 0.36);
  --alien-accent-green: oklch(0.44 0.16 65 / 0.44);
  
  --success:            oklch(0.52 0.18 145);
  --success-foreground: oklch(0.98 0.004 85);
  --warning:            oklch(0.68 0.18 72);
  --warning-foreground: oklch(0.14 0.04 240);
  --info:               oklch(0.48 0.16 240);
  --info-foreground:    oklch(0.98 0.004 85);

  /* ── Body Bokeh (light) ──
     Burnt orange bloom + cool navy depth.
     Warm parchment lets orange feel rich
     without overpowering.                */
  --bokeh-body-1: oklch(0.65 0.18 35  / 0.24);   /* orange bloom      */
  --bokeh-body-2: oklch(0.35 0.10 240 / 0.16);   /* navy depth        */
  --bokeh-body-3: oklch(0.72 0.14 60  / 0.16);   /* golden warmth     */

  /* ── Section Bokeh ── */
  --bokeh-primary:  oklch(0.55 0.18 35  / 0.22);
  --bokeh-accent:   oklch(0.35 0.10 240 / 0.14);
  --bokeh-tertiary: oklch(0.68 0.12 55  / 0.12);

  /* ── Glass ──
     Parchment-warm glass on light bg.
     Navy-tinted dark border edge.
     Orange-tinted active/hover state.   */
  --glass:            rgba(250, 248, 242, 0.22);
  --glass-bg:         rgba(250, 248, 242, 0.22);
  --glass-bg-solid:   rgba(249, 246, 238, 0.95);
  --glass-border:     rgba(21, 29, 53, 0.09);      /* navy edge on parchment      */
  --glass-border-top: rgba(255, 255, 255, 0.86);   /* bright warm refraction      */
  --glass-shadow:     0 4px 24px rgba(21, 29, 53, 0.07),
                      0 1px 4px  rgba(21, 29, 53, 0.05),
                      inset 0 1px 0 rgba(255, 255, 255, 0.90);
  --glass-shadow-lg:  0 8px 48px rgba(21, 29, 53, 0.10),
                      0 2px 10px rgba(21, 29, 53, 0.06),
                      inset 0 1px 0 rgba(255, 255, 255, 0.86);
  --glass-blur:       20px;
  --glass-saturate:   1.4;
  --glass-hover:      rgba(250, 248, 242, 0.40);
  --glass-active:     rgba(196, 85, 10, 0.10);     /* burnt orange active tint    */

  /* ── Sidebar Glass ── */
  --sidebar-glass-bg:               rgba(248, 246, 238, 0.30);
  --sidebar-glass-border:           rgba(234, 236, 243, 0.09);
  --sidebar-secondary-glass-bg:     rgba(232, 230, 226, 0.92); /* neutral grey body */
  --sidebar-secondary-glass-border: rgba(21, 29, 53, 0.12);
  --sidebar-secondary-header-border: oklch(0.55 0.18 35 / 0.2);
  --sidebar-icon-bg:                rgba(250, 248, 242, 0.36);
  --sidebar-icon-active:            rgba(196, 85, 10, 0.14);

  /* ── Navbar Glass ── */
  --navbar-glass-bg:     rgba(250, 248, 242, 0.18);
  --navbar-glass-border: rgba(21, 29, 53, 0.08);

  /* ── Tiers ── */
  --tier-free:        oklch(0.52 0.03 240);
  --tier-pro:         oklch(0.55 0.18 35);
  --tier-business:    oklch(0.28 0.07 240);
  --tier-enterprise:  oklch(0.18 0.06 240);
  --tier-trial:       oklch(0.68 0.15 35);

  /* ── shadcn/ui Base Tokens ──
     --background: transparent — layout wrappers
     become transparent, body parchment bleeds through.
     --primary = burnt orange (CTA action color).
     --foreground = rich navy (the ink).            */
  --background:           transparent;
  --foreground:           oklch(0.20 0.06 240);    /* rich navy ink              */
  --card:                 rgba(250, 248, 242, 0.22);
  --card-foreground:      oklch(0.20 0.06 240);
  --popover:              rgba(249, 246, 238, 0.97);
  --popover-foreground:   oklch(0.20 0.06 240);
  --primary:              oklch(0.55 0.18 35);     /* burnt orange               */
  --primary-foreground:   oklch(0.98 0.004 85);    /* warm parchment white       */
  --secondary:            rgba(250, 248, 242, 0.42);
  --secondary-foreground: oklch(0.25 0.06 240);
  --muted:                rgba(250, 248, 242, 0.40);
  --muted-foreground:     oklch(0.52 0.03 240);    /* navy-grey                  */
  --accent:               rgba(250, 248, 242, 0.42);
  --accent-foreground:    oklch(0.25 0.06 240);
  --destructive:          oklch(0.577 0.245 27.325);
  --border:               oklch(0.91 0.008 240);   /* cool-tinted border         */
  --input:                oklch(0.95 0.006 240);   /* slightly darker parchment  */
  --ring:                 oklch(0.55 0.18 35);     /* orange ring on focus       */

  /* ── Charts ── */
  --chart-1: oklch(0.55 0.18 35);    /* Burnt orange     */
  --chart-2: oklch(0.30 0.08 240);   /* Rich navy        */
  --chart-3: oklch(0.65 0.16 55);    /* Warm gold        */
  --chart-4: oklch(0.52 0.14 175);   /* Teal             */
  --chart-5: oklch(0.55 0.14 310);   /* Muted violet     */

  /* ── Sidebar tokens ── */
  --sidebar:                    rgba(248, 246, 238, 0.30);
  --sidebar-foreground:         oklch(0.20 0.06 240);
  --sidebar-primary:            oklch(0.55 0.18 35);
  --sidebar-primary-foreground: oklch(0.98 0.004 85);
  --sidebar-accent:             rgba(250, 248, 242, 0.42);
  --sidebar-accent-foreground:  oklch(0.25 0.06 240);
  --sidebar-border:             oklch(0.91 0.008 240);
  --sidebar-ring:               oklch(0.55 0.18 35);
}


/* ======================================================
   DARK MODE — True Black + Gold Leaf
   Maximum contrast. Near-true black, almost no chroma.
   Gold as the only warmth.
   Background  oklch(0.08 0.005 60)  #0E0C0A  Near-true black
   Ink         oklch(0.95 0.006 75)  #F5F2EC  Warm near-white
   Primary     oklch(0.75 0.18  82)  #D4A830  Gold leaf
   Muted       oklch(0.50 0.008 60)  #726E68  Near-neutral grey
   Border      oklch(0.16 0.010 60)  #221E1A  Barely-warm edge
   Bokeh: gold glow + very faint warm dark.
   ====================================================== */
.dark {
  /* ── Brand (Dark: Gold Leaf) ── */
  --sibling-primary:       oklch(0.75 0.18 82);    /* Gold leaf        */
  --sibling-primary-light: oklch(0.82 0.14 82);   /* Lighter gold     */
  --sibling-primary-dark:  oklch(0.62 0.18 82);   /* Deep gold        */
  --sibling-accent:        oklch(0.50 0.008 60); /* Near-neutral     */
  --sibling-accent-light:  oklch(0.58 0.010 60);
  --sibling-surface:       oklch(0.10 0.008 60);
  --sibling-surface-hover: oklch(0.14 0.010 60);

  /* ── Alien greens (same in dark) ── */
  --alien-glow-green:   #19F5A8;
  --alien-core-green:   #12D98E;
  --alien-accent-green: #0B8F63;

  /* ── Semantic (Dark) ── */
  --success:            oklch(0.68 0.18 145);
  --success-foreground: oklch(0.08 0.005 60);
  --warning:            oklch(0.78 0.18 72);
  --warning-foreground: oklch(0.08 0.005 60);
  --info:               oklch(0.72 0.14 82);
  --info-foreground:    oklch(0.08 0.005 60);

  /* ── Body Bokeh (dark): gold glow + faint warm dark ── */
  --bokeh-body-1: oklch(0.96 0.01 95 / 0.15);   /* gold glow        */
  --bokeh-body-2: oklch(0.12 0.015 60 / 0.35);   /* faint warm dark  */
  --bokeh-body-3: oklch(0.55 0.16 82  / 0.28);   /* soft gold        */

  /* ── Section Bokeh ── */
  --bokeh-primary:  oklch(0.96 0.01 95 / 0.15);
  --bokeh-accent:   oklch(0.14 0.012 60 / 0.40);
  --bokeh-tertiary: oklch(0.96 0.01 95 / 0.15);

  /* ── Glass (Dark): true black tint, gold edge ── */
  --glass:            rgba(14, 12, 10, 0.12);
  --glass-bg:         rgba(14, 12, 10, 0.12);
  --glass-bg-solid:   rgba(10, 8, 6, 0.96);
  --glass-border:     oklch(0.16 0.010 60);
  --glass-border-top: oklch(0.22 0.012 60);
  --glass-shadow:     0 4px 24px rgba(0, 0, 0, 0.5),
                      0 1px 6px  rgba(0, 0, 0, 0.35),
                      inset 0 1px 0 oklch(0.22 0.012 60 / 0.6);
  --glass-shadow-lg:  0 8px 48px rgba(0, 0, 0, 0.6),
                      0 2px 12px rgba(0, 0, 0, 0.4),
                      inset 0 1px 0 oklch(0.22 0.012 60 / 0.5);
  --glass-blur:       22px;
  --glass-saturate:   1.2;
  --glass-hover:      oklch(0.14 0.008 60 / 0.5);
  --glass-active:     oklch(0.75 0.18 82 / 0.18);

  /* ── Sidebar Glass (Dark) ── */
  --sidebar-glass-bg:               rgba(14, 12, 10, 0.75);
  --sidebar-glass-border:           oklch(0.16 0.010 60);
  --sidebar-secondary-glass-bg:     rgba(22, 22, 24, 0.78); /* neutral charcoal, no green wash */
  --sidebar-secondary-glass-border: oklch(0.75 0.18 82 / 0.25);
  --sidebar-secondary-header-border: oklch(0.75 0.18 82 / 0.35);
  --sidebar-icon-bg:                oklch(0.14 0.008 60 / 0.6);
  --sidebar-icon-active:            oklch(0.75 0.18 82 / 0.22);

  /* ── Navbar Glass (Dark) ── */
  --navbar-glass-bg:     rgba(14, 12, 10, 0.6);
  --navbar-glass-border: oklch(0.16 0.010 60);

  /* ── Tiers (Dark) ── */
  --tier-free:        oklch(0.52 0.008 60);
  --tier-pro:         oklch(0.75 0.18 82);
  --tier-business:    oklch(0.50 0.008 60);
  --tier-enterprise:  oklch(0.95 0.006 75);
  --tier-trial:       oklch(0.78 0.16 82);

  /* ── shadcn/ui Base Tokens (Dark: True Black + Gold) ── */
  --background:           oklch(0.38 0.005 30);   /* match body so main area is dark */
  --foreground:           oklch(0.95 0.006 75);   /* warm near-white ink */
  --card:                 rgba(179, 116, 53, 0);
  --card-foreground:      oklch(0.95 0.006 75);
  --popover:              rgba(10, 8, 6, 0.98);
  --popover-foreground:   oklch(0.95 0.006 75);
  --primary:              oklch(0.75 0.18 82);    /* gold leaf          */
  --primary-foreground:   oklch(0.08 0.005 60);  /* near-true black    */
  --secondary:            oklch(0.16 0.010 60 / 0.5);
  --secondary-foreground: oklch(0.95 0.006 75);
  --muted:                oklch(0.16 0.010 60 / 0.4);
  --muted-foreground:     oklch(0.72 0.01 85);   /* whitish muted ink  */
  --accent:               oklch(0.16 0.010 60 / 0.5);
  --accent-foreground:    oklch(0.95 0.006 75);
  --destructive:          oklch(0.704 0.191 22.216);
  --border:               oklch(0.16 0.010 60);
  --input:                oklch(0.16 0.010 60 / 0.8);
  --ring:                 oklch(0.75 0.18 82);

  /* ── Charts (Dark) ── */
  --chart-1: oklch(0.75 0.18 82);   /* Gold leaf   */
  --chart-2: oklch(0.50 0.008 60);  /* Muted       */
  --chart-3: oklch(0.68 0.14 82);   /* Soft gold   */
  --chart-4: oklch(0.55 0.12 175);
  --chart-5: oklch(0.60 0.12 310);

  /* ── Sidebar tokens (Dark) ── */
  --sidebar:                    rgba(14, 12, 10, 0.8);
  --sidebar-foreground:         oklch(0.95 0.006 75);
  --sidebar-primary:             oklch(0.75 0.18 82);
  --sidebar-primary-foreground:  oklch(0.08 0.005 60);
  --sidebar-accent:              oklch(0.16 0.010 60 / 0.5);
  --sidebar-accent-foreground:   oklch(0.95 0.006 75);
  --sidebar-border:              oklch(0.16 0.010 60);
  --sidebar-ring:                oklch(0.75 0.18 82);
}


/* ======================================================
   PAPER — Editorial white & ink (light monochrome)
   White is the central color. Text and accents are
   pure greys and near-black. No chroma anywhere.
   ====================================================== */
.monochrome:not(.dark) {
  --radius: 0.5rem;

  --sibling-primary:       oklch(0.18 0 0);   /* near-black ink */
  --sibling-primary-light: oklch(0.32 0 0);
  --sibling-primary-dark:  oklch(0.08 0 0);
  --sibling-accent:        oklch(0.40 0 0);
  --sibling-accent-light:  oklch(0.55 0 0);
  --sibling-surface:       #ffffff;
  --sibling-surface-hover: oklch(0.97 0 0);

  --alien-glow-green:   oklch(0.30 0 0 / 0.18);
  --alien-core-green:   oklch(0.22 0 0 / 0.30);
  --alien-accent-green: oklch(0.14 0 0 / 0.40);

  --success:            oklch(0.45 0 0);
  --success-foreground: #ffffff;
  --warning:            oklch(0.55 0 0);
  --warning-foreground: #ffffff;
  --info:               oklch(0.50 0 0);
  --info-foreground:    #ffffff;

  --bokeh-body-1:   transparent;
  --bokeh-body-2:   transparent;
  --bokeh-body-3:   transparent;
  --bokeh-primary:  transparent;
  --bokeh-accent:   transparent;
  --bokeh-tertiary: transparent;

  --glass:            #ffffff;
  --glass-bg:         #ffffff;
  --glass-bg-solid:   #ffffff;
  --glass-border:     rgba(0, 0, 0, 0.08);
  --glass-border-top: rgba(0, 0, 0, 0.06);
  --glass-shadow:     0 1px 2px rgba(0, 0, 0, 0.04),
                        0 1px 3px rgba(0, 0, 0, 0.03);
  --glass-shadow-lg:  0 6px 24px rgba(0, 0, 0, 0.06),
                        0 2px 6px rgba(0, 0, 0, 0.04);
  --glass-blur:       0px;
  --glass-saturate:   1;
  --glass-hover:      oklch(0.97 0 0);
  --glass-active:     oklch(0.92 0 0);

  --sidebar-glass-bg:               #ffffff;
  --sidebar-glass-border:           rgba(0, 0, 0, 0.07);
  --sidebar-secondary-glass-bg:     oklch(0.985 0 0);
  --sidebar-secondary-glass-border: rgba(0, 0, 0, 0.08);
  --sidebar-secondary-header-border: rgba(0, 0, 0, 0.14);
  --sidebar-icon-bg:                oklch(0.96 0 0);
  --sidebar-icon-active:            oklch(0.90 0 0);

  --navbar-glass-bg:     rgba(255, 255, 255, 0.96);
  --navbar-glass-border: rgba(0, 0, 0, 0.07);

  --tier-free:        oklch(0.55 0 0);
  --tier-pro:         oklch(0.18 0 0);
  --tier-business:    oklch(0.28 0 0);
  --tier-enterprise:  oklch(0.08 0 0);
  --tier-trial:       oklch(0.45 0 0);

  --background:           #ffffff;
  --foreground:           oklch(0.14 0 0);  /* near-black ink */
  --card:                 #ffffff;
  --card-foreground:      oklch(0.14 0 0);
  --popover:              #ffffff;
  --popover-foreground:   oklch(0.14 0 0);
  --primary:              oklch(0.14 0 0);  /* black on white CTA */
  --primary-foreground:   #ffffff;
  --secondary:            oklch(0.96 0 0);
  --secondary-foreground: oklch(0.14 0 0);
  --muted:                oklch(0.96 0 0);
  --muted-foreground:     oklch(0.48 0 0);  /* mid-grey */
  --accent:               oklch(0.94 0 0);
  --accent-foreground:    oklch(0.14 0 0);
  --destructive:          oklch(0.55 0.2 27);
  --border:               rgba(0, 0, 0, 0.09);
  --input:                #ffffff;
  --ring:                 oklch(0.22 0 0);

  --chart-1: oklch(0.14 0 0);
  --chart-2: oklch(0.35 0 0);
  --chart-3: oklch(0.55 0 0);
  --chart-4: oklch(0.72 0 0);
  --chart-5: oklch(0.86 0 0);

  --sidebar:                    #ffffff;
  --sidebar-foreground:         oklch(0.14 0 0);
  --sidebar-primary:            oklch(0.14 0 0);
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent:             oklch(0.96 0 0);
  --sidebar-accent-foreground:  oklch(0.14 0 0);
  --sidebar-border:             rgba(0, 0, 0, 0.08);
  --sidebar-ring:               oklch(0.22 0 0);
}


/* ======================================================
   MONOCHROME — Editorial black & white
   True achromatic neutrals, no gold or chroma accents.
   Near-black canvas, soft white ink, layered grey surfaces.
   ====================================================== */
.dark.monochrome,
.monochrome.dark {
  --sibling-primary:       oklch(0.94 0 0);
  --sibling-primary-light: oklch(0.98 0 0);
  --sibling-primary-dark:  oklch(0.78 0 0);
  --sibling-accent:        oklch(0.55 0 0);
  --sibling-accent-light:  oklch(0.70 0 0);
  --sibling-surface:       oklch(0.10 0 0);
  --sibling-surface-hover: oklch(0.14 0 0);

  --alien-glow-green:   oklch(0.88 0 0);
  --alien-core-green:   oklch(0.75 0 0);
  --alien-accent-green: oklch(0.55 0 0);

  --success:            oklch(0.78 0 0);
  --success-foreground: oklch(0.08 0 0);
  --warning:            oklch(0.72 0 0);
  --warning-foreground: oklch(0.08 0 0);
  --info:               oklch(0.68 0 0);
  --info-foreground:    oklch(0.08 0 0);

  --bokeh-body-1:   transparent;
  --bokeh-body-2:   transparent;
  --bokeh-body-3:   transparent;
  --bokeh-primary:  transparent;
  --bokeh-accent:   transparent;
  --bokeh-tertiary: transparent;

  --glass:            oklch(0.11 0 0 / 0.85);
  --glass-bg:         oklch(0.11 0 0 / 0.85);
  --glass-bg-solid:   oklch(0.09 0 0 / 0.98);
  --glass-border:     rgba(255, 255, 255, 0.10);
  --glass-border-top: rgba(255, 255, 255, 0.14);
  --glass-shadow:     0 4px 24px rgba(0, 0, 0, 0.45),
                        0 1px 6px rgba(0, 0, 0, 0.35),
                        inset 0 1px 0 rgba(255, 255, 255, 0.06);
  --glass-shadow-lg:  0 8px 48px rgba(0, 0, 0, 0.55),
                        0 2px 12px rgba(0, 0, 0, 0.4),
                        inset 0 1px 0 rgba(255, 255, 255, 0.05);
  --glass-blur:       20px;
  --glass-saturate:   1;
  --glass-hover:      oklch(0.15 0 0 / 0.72);
  --glass-active:     oklch(0.94 0 0 / 0.12);

  --sidebar-glass-bg:               oklch(0.09 0 0 / 0.88);
  --sidebar-glass-border:           rgba(255, 255, 255, 0.09);
  --sidebar-secondary-glass-bg:     oklch(0.12 0 0 / 0.9);
  --sidebar-secondary-glass-border: rgba(255, 255, 255, 0.08);
  --sidebar-secondary-header-border: rgba(255, 255, 255, 0.14);
  --sidebar-icon-bg:                oklch(0.14 0 0 / 0.65);
  --sidebar-icon-active:            oklch(0.94 0 0 / 0.14);

  --navbar-glass-bg:     oklch(0.08 0 0 / 0.92);
  --navbar-glass-border: rgba(255, 255, 255, 0.09);

  --tier-free:        oklch(0.55 0 0);
  --tier-pro:         oklch(0.88 0 0);
  --tier-business:    oklch(0.72 0 0);
  --tier-enterprise:  oklch(0.94 0 0);
  --tier-trial:       oklch(0.78 0 0);

  --background:           oklch(0.07 0 0);
  --foreground:           oklch(0.96 0 0);
  --card:                 oklch(0.11 0 0);
  --card-foreground:      oklch(0.96 0 0);
  --popover:              oklch(0.10 0 0);
  --popover-foreground:   oklch(0.96 0 0);
  --primary:              oklch(0.94 0 0);
  --primary-foreground:   oklch(0.06 0 0);
  --secondary:            oklch(0.16 0 0);
  --secondary-foreground: oklch(0.96 0 0);
  --muted:                oklch(0.16 0 0);
  --muted-foreground:     oklch(0.62 0 0);
  --accent:               oklch(0.18 0 0);
  --accent-foreground:    oklch(0.96 0 0);
  --destructive:          oklch(0.62 0.2 25);
  --border:               rgba(255, 255, 255, 0.09);
  --input:                oklch(0.14 0 0 / 0.85);
  --ring:                 oklch(0.88 0 0);

  --chart-1: oklch(0.92 0 0);
  --chart-2: oklch(0.65 0 0);
  --chart-3: oklch(0.45 0 0);
  --chart-4: oklch(0.78 0 0);
  --chart-5: oklch(0.32 0 0);

  --sidebar:                    oklch(0.085 0 0);
  --sidebar-foreground:         oklch(0.96 0 0);
  --sidebar-primary:            oklch(0.94 0 0);
  --sidebar-primary-foreground: oklch(0.06 0 0);
  --sidebar-accent:             oklch(0.16 0 0);
  --sidebar-accent-foreground:  oklch(0.96 0 0);
  --sidebar-border:             rgba(255, 255, 255, 0.09);
  --sidebar-ring:               oklch(0.88 0 0);
}


/* ======================================================
   MINIMAL MODE — Enhanced (Render.com Inspired)
   
   Philosophy: Near-white surfaces · Ink-black text · 
   Single cool-slate accent · Hairline borders · 
   Precise depth through shadow, not color.
   
   Light  → Pure white + warm-off-white surfaces
   Dark   → Deep graphite (not pure black) + same accent
   
   Accent: Slate-indigo (Render's "electric" blue-slate)
   Primary text: Near-black with a cool tint
   Muted:  Refined mid-grey, never warm
   ====================================================== */

   .minimal {
    --radius: 0.375rem;   /* Tighter radius — more precision, less bubble */
  
    /* ── Brand tokens ── */
    --sibling-primary:       oklch(0.46 0.18 262);    /* Slate-indigo          */
    --sibling-primary-light: oklch(0.58 0.16 262);    /* Lighter slate         */
    --sibling-primary-dark:  oklch(0.34 0.20 262);    /* Deep slate            */
    --sibling-accent:        #0a0a0a;
    --sibling-accent-light:  #1e1e1e;
    --sibling-surface:       #ffffff;
    --sibling-surface-hover: #f8f8f8;
  
    /* ── Kill alien greens ── */
    --alien-glow-green:   transparent;
    --alien-core-green:   transparent;
    --alien-accent-green: transparent;
  
    /* ── Semantic ── */
    --success:            oklch(0.50 0.16 145);
    --success-foreground: #ffffff;
    --warning:            oklch(0.62 0.16 72);
    --warning-foreground: #0a0a0a;
    --info:               oklch(0.46 0.18 262);
    --info-foreground:    #ffffff;
  
    /* ── Kill bokeh ── */
    --bokeh-body-1:   transparent;
    --bokeh-body-2:   transparent;
    --bokeh-body-3:   transparent;
    --bokeh-primary:  transparent;
    --bokeh-accent:   transparent;
    --bokeh-tertiary: transparent;
  
    /* ── Glass → Flat surfaces ──
       No blur, no glow. Pure white with hairline borders.
       Depth comes only from shadow.                      */
    --glass:            #ffffff;
    --glass-bg:         #ffffff;
    --glass-bg-solid:   #ffffff;
    --glass-border:     rgba(0, 0, 0, 0.08);
    --glass-border-top: rgba(0, 0, 0, 0.08);
    --glass-shadow:     0 1px 2px rgba(0, 0, 0, 0.04),
                        0 1px 3px rgba(0, 0, 0, 0.03);
    --glass-shadow-lg:  0 4px 6px -1px rgba(0, 0, 0, 0.07),
                        0 2px 4px -1px rgba(0, 0, 0, 0.04);
    --glass-blur:       0px;
    --glass-saturate:   1;
    --glass-hover:      #f9f9fb;
    --glass-active:     oklch(0.96 0.03 262);   /* Very faint slate tint on press */
  
    /* ── Sidebar glass (flat white) ── */
    --sidebar-glass-bg:                #ffffff;
    --sidebar-glass-border:            rgba(0, 0, 0, 0.07);
    --sidebar-secondary-glass-bg:      #f7f7f8;
    --sidebar-secondary-glass-border:  rgba(0, 0, 0, 0.08);
    --sidebar-secondary-header-border: oklch(0.46 0.18 262 / 0.18);
    --sidebar-icon-bg:                 #f3f3f5;
    --sidebar-icon-active:             oklch(0.94 0.05 262);
  
    /* ── Navbar (flat white) ── */
    --navbar-glass-bg:     rgba(255, 255, 255, 0.95);
    --navbar-glass-border: rgba(0, 0, 0, 0.07);
  
    /* ── Tiers ── */
    --tier-free:        #737373;
    --tier-pro:         oklch(0.46 0.18 262);
    --tier-business:    #171717;
    --tier-enterprise:  #0a0a0a;
    --tier-trial:       oklch(0.58 0.16 262);
  
    /* ── shadcn/ui Base Tokens ── */
    --background:           #ffffff;
    --foreground:           oklch(0.13 0.02 262);    /* Cool near-black ink     */
    --card:                 #ffffff;
    --card-foreground:      oklch(0.13 0.02 262);
    --popover:              #ffffff;
    --popover-foreground:   oklch(0.13 0.02 262);
    --primary:              oklch(0.46 0.18 262);    /* Slate-indigo            */
    --primary-foreground:   #ffffff;
    --secondary:            #f4f4f6;
    --secondary-foreground: oklch(0.13 0.02 262);
    --muted:                #f4f4f6;
    --muted-foreground:     oklch(0.50 0.02 262);    /* Cool mid-grey           */
    --accent:               #f4f4f6;
    --accent-foreground:    oklch(0.13 0.02 262);
    --destructive:          oklch(0.55 0.22 27);
    --border:               rgba(0, 0, 0, 0.08);
    --input:                #ffffff;
    --ring:                 oklch(0.46 0.18 262);
  
    /* ── Charts ── */
    --chart-1: oklch(0.46 0.18 262);    /* Slate-indigo       */
    --chart-2: #0a0a0a;
    --chart-3: #737373;
    --chart-4: oklch(0.62 0.15 262);    /* Lighter slate      */
    --chart-5: #d4d4d8;
  
    /* ── Sidebar tokens ── */
    --sidebar:                    #ffffff;
    --sidebar-foreground:         oklch(0.13 0.02 262);
    --sidebar-primary:            oklch(0.46 0.18 262);
    --sidebar-primary-foreground: #ffffff;
    --sidebar-accent:             #f4f4f6;
    --sidebar-accent-foreground:  oklch(0.13 0.02 262);
    --sidebar-border:             rgba(0, 0, 0, 0.07);
    --sidebar-ring:               oklch(0.46 0.18 262);
  }
  
  
  /* ======================================================
     MINIMAL DARK — Deep graphite + Slate-indigo accent
     
     Not pure black — #0e0f11 base, same as Render's dark.
     Surfaces are distinct graphite layers.
     Accent stays the same hue, just lightened for contrast.
     ====================================================== */
  
  .minimal.dark,
  .dark.minimal {
    --radius: 0.375rem;
  
    /* ── Brand tokens ── */
    --sibling-primary:       oklch(0.65 0.18 262);    /* Lighter slate for dark  */
    --sibling-primary-light: oklch(0.74 0.14 262);
    --sibling-primary-dark:  oklch(0.54 0.20 262);
    --sibling-accent:        oklch(0.92 0.01 262);    /* Near-white              */
    --sibling-accent-light:  oklch(0.80 0.02 262);
    --sibling-surface:       oklch(0.14 0.01 262);    /* Deep graphite surface   */
    --sibling-surface-hover: oklch(0.18 0.01 262);
  
    /* ── Kill alien greens ── */
    --alien-glow-green:   transparent;
    --alien-core-green:   transparent;
    --alien-accent-green: transparent;
  
    /* ── Semantic (Dark) ── */
    --success:            oklch(0.65 0.18 145);
    --success-foreground: oklch(0.10 0.01 262);
    --warning:            oklch(0.75 0.18 72);
    --warning-foreground: oklch(0.10 0.01 262);
    --info:               oklch(0.65 0.18 262);
    --info-foreground:    oklch(0.10 0.01 262);
  
    /* ── Kill bokeh ── */
    --bokeh-body-1:   transparent;
    --bokeh-body-2:   transparent;
    --bokeh-body-3:   transparent;
    --bokeh-primary:  transparent;
    --bokeh-accent:   transparent;
    --bokeh-tertiary: transparent;
  
    /* ── Glass → Flat dark surfaces ──
       Render dark: layered graphite, no glow.
       Borders are ultra-subtle light edges.    */
    --glass:            oklch(0.14 0.01 262);
    --glass-bg:         oklch(0.14 0.01 262);
    --glass-bg-solid:   oklch(0.12 0.01 262);
    --glass-border:     rgba(255, 255, 255, 0.07);
    --glass-border-top: rgba(255, 255, 255, 0.10);
    --glass-shadow:     0 1px 2px rgba(0, 0, 0, 0.3),
                        0 1px 3px rgba(0, 0, 0, 0.2);
    --glass-shadow-lg:  0 4px 6px -1px rgba(0, 0, 0, 0.4),
                        0 2px 4px -1px rgba(0, 0, 0, 0.25);
    --glass-blur:       0px;
    --glass-saturate:   1;
    --glass-hover:      oklch(0.18 0.01 262);
    --glass-active:     oklch(0.46 0.18 262 / 0.2);
  
    /* ── Sidebar glass (dark) ── */
    --sidebar-glass-bg:                oklch(0.12 0.01 262);
    --sidebar-glass-border:            rgba(255, 255, 255, 0.07);
    --sidebar-secondary-glass-bg:      oklch(0.15 0.01 262);
    --sidebar-secondary-glass-border:  rgba(255, 255, 255, 0.07);
    --sidebar-secondary-header-border: oklch(0.65 0.18 262 / 0.3);
    --sidebar-icon-bg:                 oklch(0.18 0.01 262);
    --sidebar-icon-active:             oklch(0.46 0.18 262 / 0.25);
  
    /* ── Navbar (dark) ── */
    --navbar-glass-bg:     oklch(0.12 0.01 262 / 0.95);
    --navbar-glass-border: rgba(255, 255, 255, 0.07);
  
    /* ── Tiers ── */
    --tier-free:        oklch(0.55 0.01 262);
    --tier-pro:         oklch(0.65 0.18 262);
    --tier-business:    oklch(0.80 0.01 262);
    --tier-enterprise:  oklch(0.92 0.01 262);
    --tier-trial:       oklch(0.74 0.14 262);
  
    /* ── shadcn/ui Base Tokens (Minimal Dark) ── */
    --background:           oklch(0.10 0.01 262);    /* #0e0f11 — Render base   */
    --foreground:           oklch(0.93 0.01 262);    /* Cool near-white         */
    --card:                 oklch(0.14 0.01 262);    /* Graphite card surface   */
    --card-foreground:      oklch(0.93 0.01 262);
    --popover:              oklch(0.14 0.01 262);
    --popover-foreground:   oklch(0.93 0.01 262);
    --primary:              oklch(0.65 0.18 262);    /* Bright slate-indigo     */
    --primary-foreground:   oklch(0.10 0.01 262);
    --secondary:            oklch(0.18 0.01 262);
    --secondary-foreground: oklch(0.93 0.01 262);
    --muted:                oklch(0.18 0.01 262);
    --muted-foreground:     oklch(0.58 0.02 262);    /* Muted cool-grey         */
    --accent:               oklch(0.18 0.01 262);
    --accent-foreground:    oklch(0.93 0.01 262);
    --destructive:          oklch(0.65 0.22 27);
    --border:               rgba(255, 255, 255, 0.07);
    --input:                oklch(0.16 0.01 262);
    --ring:                 oklch(0.65 0.18 262);
  
    /* ── Charts (Minimal Dark) ── */
    --chart-1: oklch(0.65 0.18 262);    /* Bright slate         */
    --chart-2: oklch(0.92 0.01 262);    /* Near-white           */
    --chart-3: oklch(0.55 0.02 262);    /* Mid-grey             */
    --chart-4: oklch(0.74 0.14 262);    /* Lighter slate        */
    --chart-5: oklch(0.30 0.01 262);    /* Dark graphite        */
  
    /* ── Sidebar tokens (Minimal Dark) ── */
    --sidebar:                    oklch(0.12 0.01 262);
    --sidebar-foreground:         oklch(0.93 0.01 262);
    --sidebar-primary:            oklch(0.65 0.18 262);
    --sidebar-primary-foreground: oklch(0.10 0.01 262);
    --sidebar-accent:             oklch(0.18 0.01 262);
    --sidebar-accent-foreground:  oklch(0.93 0.01 262);
    --sidebar-border:             rgba(255, 255, 255, 0.07);
    --sidebar-ring:               oklch(0.65 0.18 262);
  }
  
  
  /* ======================================================
     MINIMAL MODE — Component Overrides
     Applied only when .minimal is active.
     Reinforces the Render-style precision: no glass 
     effects bleed through, clean inputs, tight layout.
     ====================================================== */
  
  /* ── Page background: pure white, no mesh ── */
  .minimal body {
    background-color: #ffffff;
    background-image: none;
  }
  .minimal.dark body,
  .dark.minimal body {
    background-color: oklch(0.10 0.01 262);
    background-image: none;
  }
  
  /* ── Inputs: clean bordered, no backdrop-filter ── */
  .minimal input:not([type="color"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]),
  .minimal textarea,
  .minimal select {
    background-color: #ffffff !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    border: 1px solid rgba(0, 0, 0, 0.12) !important;
    color: oklch(0.13 0.02 262);
    border-radius: var(--radius-md);
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }
  .minimal input:focus,
  .minimal textarea:focus,
  .minimal select:focus {
    background-color: #ffffff !important;
    border-color: oklch(0.46 0.18 262) !important;
    box-shadow: 0 0 0 3px oklch(0.46 0.18 262 / 0.12) !important;
    outline: none;
  }
  
  .minimal.dark input:not([type="color"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]),
  .dark.minimal input:not([type="color"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]),
  .minimal.dark textarea,
  .dark.minimal textarea,
  .minimal.dark select,
  .dark.minimal select {
    background-color: oklch(0.16 0.01 262) !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    border: 1px solid rgba(255, 255, 255, 0.09) !important;
    color: oklch(0.93 0.01 262);
  }
  .minimal.dark input:focus,
  .dark.minimal input:focus,
  .minimal.dark textarea:focus,
  .dark.minimal textarea:focus {
    border-color: oklch(0.65 0.18 262) !important;
    box-shadow: 0 0 0 3px oklch(0.65 0.18 262 / 0.18) !important;
  }
  
  /* ── Glass cards → flat cards with hairline border + shadow ── */
  .minimal .glass-card,
  .minimal .glass-card-elevated,
  .minimal .glass {
    background: #ffffff;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-top-color: rgba(0, 0, 0, 0.08);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.04);
  }
  .minimal .glass-card:hover,
  .minimal .glass-card-elevated:hover {
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -1px rgba(0, 0, 0, 0.04);
    transform: translateY(-1px);
    border-color: rgba(0, 0, 0, 0.10);
  }
  
  .minimal.dark .glass-card,
  .dark.minimal .glass-card,
  .minimal.dark .glass-card-elevated,
  .dark.minimal .glass-card-elevated,
  .minimal.dark .glass,
  .dark.minimal .glass {
    background: oklch(0.14 0.01 262);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-top-color: rgba(255, 255, 255, 0.09);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2);
  }
  .minimal.dark .glass-card:hover,
  .dark.minimal .glass-card:hover {
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4);
    transform: translateY(-1px);
    border-color: rgba(255, 255, 255, 0.12);
  }
  
  /* ── Anime float cards → flat in minimal ── */
  .minimal .card-anime-float {
    background: #ffffff;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    border: 1px solid rgba(0, 0, 0, 0.08);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }
  .minimal .card-anime-float::before,
  .minimal .card-anime-float::after { display: none; }
  .minimal .card-anime-float:hover {
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
    transform: translateY(-1px);
    border-color: rgba(0, 0, 0, 0.12);
  }
  
  /* ── Navbar: crisp white, clean bottom border ── */
  .minimal .glass-navbar {
    background: rgba(255, 255, 255, 0.97);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    border-bottom: 1px solid rgba(0, 0, 0, 0.07);
    box-shadow: none;
  }
  .minimal.dark .glass-navbar,
  .dark.minimal .glass-navbar {
    background: oklch(0.10 0.01 262 / 0.97);
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    box-shadow: none;
  }
  
  /* ── Sidebar: flat white, hairline right border ── */
  .minimal .glass-sidebar {
    background: #ffffff;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    border-right: 1px solid rgba(0, 0, 0, 0.07);
    box-shadow: none;
  }
  .minimal.dark .glass-sidebar,
  .dark.minimal .glass-sidebar {
    background: oklch(0.12 0.01 262);
    border-right: 1px solid rgba(255, 255, 255, 0.07);
    box-shadow: none;
  }
  
  /* ── Secondary sidebar: flat in minimal (no bevel/sheen) ── */
  .minimal .glass-sidebar-secondary {
    background: #f7f7f8;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    border-right: 1px solid rgba(0, 0, 0, 0.07);
    border-radius: 0;
    box-shadow: none;
  }
  .minimal .glass-sidebar-secondary::before { display: none; }
  .minimal.dark .glass-sidebar-secondary,
  .dark.minimal .glass-sidebar-secondary {
    background: oklch(0.14 0.01 262);
    border-right: 1px solid rgba(255, 255, 255, 0.07);
    box-shadow: none;
  }
  .minimal.dark .glass-sidebar-secondary::before { display: none; }
  
  /* ── Buttons: precise, no gradients ── */
  .minimal button[data-variant="default"],
  .minimal [class*="btn-primary"],
  .minimal .btn-primary {
    background: oklch(0.46 0.18 262);
    color: #ffffff;
    border: 1px solid oklch(0.40 0.20 262);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
    transition: background 0.15s ease, box-shadow 0.15s ease;
  }
  .minimal button[data-variant="default"]:hover,
  .minimal [class*="btn-primary"]:hover {
    background: oklch(0.40 0.20 262);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.12);
  }
  
  /* ── Scrollbar: thin, minimal ── */
  .minimal ::-webkit-scrollbar { width: 6px; height: 6px; }
  .minimal ::-webkit-scrollbar-track { background: transparent; }
  .minimal ::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.15);
    border-radius: 99px;
  }
  .minimal ::-webkit-scrollbar-thumb:hover { background: rgba(0, 0, 0, 0.25); }
  .minimal.dark ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.12); }
  .minimal.dark ::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.20); }
  
  /* ── Selection: slate tint ── */
  .minimal ::selection {
    background: oklch(0.46 0.18 262 / 0.15);
    color: oklch(0.13 0.02 262);
  }
  .minimal.dark ::selection {
    background: oklch(0.65 0.18 262 / 0.25);
    color: oklch(0.93 0.01 262);
  }
  
  /* ── Focus ring: slate, clean ── */
  .minimal :focus-visible {
    outline: 2px solid oklch(0.46 0.18 262);
    outline-offset: 2px;
  }
  .minimal.dark :focus-visible {
    outline: 2px solid oklch(0.65 0.18 262);
  }

/* ================================
   BASE LAYER
   ================================ */

@layer base {
  html { height: 100%; }
  html {
    background: linear-gradient(170deg,
      oklch(0.94 0.010 70) 0%,   /* warm greige top */
      oklch(0.96 0.008 80) 100%  /* softer parchment bottom */
    ) fixed;
  }  /* Light: warm parchment canvas (no bokeh on page bg) */
  body {
    /* Base parchment — unchanged so your text contrast stays calibrated */
    background-color: oklch(0.98 0.010 85);

    /* Mesh sits on top of the flat colour, locked to viewport */
    background-image: var(--page-mesh);
    background-attachment: fixed;
    background-size: 100% 100%;

    min-height: 100dvh;
    color: var(--foreground);
  }

  /* Dark: near-black base + gold/green mesh */
  .dark body {
    background-color: oklch(0.08 0.005 60);
    background-image: var(--page-mesh);
    background-attachment: fixed;
    background-size: 100% 100%;
  }

  html.dark.monochrome,
  html.monochrome.dark {
    background: oklch(0.07 0 0);
    background-image: none;
  }

  .dark.monochrome body,
  .monochrome.dark body {
    background-color: oklch(0.07 0 0);
    background-image: none;
  }

  html.monochrome:not(.dark) {
    background: #ffffff;
    background-image: none;
  }

  .monochrome:not(.dark) body {
    background-color: #ffffff;
    background-image: none;
  }

  /* All layout shells transparent in light so body parchment shows; dark uses --background */
  html { background-color: transparent; }
  body > div, main, [role="main"] { background-color: var(--background); }

  h1, h2, h3, h4, h5, h6 { font-family: var(--font-heading); }

  /* ── Native inputs — parchment glass ── */
  input:not([type="color"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]),
  textarea,
  select {
    background-color: var(--glass-hover) !important;
    backdrop-filter: blur(8px) saturate(1.3);
    -webkit-backdrop-filter: blur(8px) saturate(1.3);
    border-color: var(--glass-border);
    color: var(--foreground);
    transition: background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  }

  input:not([type="color"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]):focus,
  textarea:focus,
  select:focus {
    background-color: rgba(250, 248, 242, 0.62) !important;
    border-color: var(--primary) !important;
    outline: none;
    box-shadow:
      0 0 0 3px color-mix(in oklch, var(--primary) 18%, transparent),
      inset 0 1px 0 rgba(255, 255, 255, 0.68);
  }

  .dark input:not([type="color"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]):focus,
  .dark textarea:focus,
  .dark select:focus {
    background-color: oklch(0.12 0.008 60 / 0.6) !important;
    box-shadow: 0 0 0 3px color-mix(in oklch, var(--primary) 25%, transparent),
                inset 0 1px 0 oklch(0.22 0.012 60 / 0.4);
  }

  .dark.monochrome input:not([type="color"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]):focus,
  .dark.monochrome textarea:focus,
  .dark.monochrome select:focus,
  .monochrome.dark input:not([type="color"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]):focus,
  .monochrome.dark textarea:focus,
  .monochrome.dark select:focus {
    background-color: oklch(0.12 0 0 / 0.65) !important;
    box-shadow: 0 0 0 3px color-mix(in oklch, var(--primary) 22%, transparent),
                inset 0 1px 0 rgba(255, 255, 255, 0.08);
  }

  .monochrome:not(.dark) input:not([type="color"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]),
  .monochrome:not(.dark) textarea,
  .monochrome:not(.dark) select {
    background-color: #ffffff !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    border: 1px solid rgba(0, 0, 0, 0.12) !important;
    color: oklch(0.14 0 0);
    border-radius: var(--radius-md);
  }
  .monochrome:not(.dark) input:not([type="color"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]):focus,
  .monochrome:not(.dark) textarea:focus,
  .monochrome:not(.dark) select:focus {
    background-color: #ffffff !important;
    border-color: oklch(0.22 0 0) !important;
    box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.08),
                inset 0 1px 0 rgba(255, 255, 255, 0.9);
  }
}


/* ================================
   GLASSMORPHISM UTILITY CLASSES
   ================================ */

.glass {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  border: 1px solid var(--glass-border);
  border-top-color: var(--glass-border-top);
  box-shadow: var(--glass-shadow);
}

.glass-solid {
  background: var(--glass-bg-solid);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  border: 1px solid var(--glass-border);
  border-top-color: var(--glass-border-top);
  box-shadow: var(--glass-shadow);
}

.glass-sidebar {
  background: var(--sidebar-glass-bg);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  border-right: 0.1px solid rgba(0, 0, 0, 0.468);
  /* box-shadow:
    2px 0 20px rgba(48, 61, 101, 0.06),
    2px 0 0 0 color-mix(in srgb, var(--alien-glow-green) 34%, transparent); */
}
:is(.dark) .glass-sidebar {
  border-right-color: color-mix(in srgb, var(--alien-glow-green) 22%, var(--sidebar-glass-border));
  box-shadow:
    2px 0 20px rgba(0, 0, 0, 0.4),
    2px 0 0 0 color-mix(in srgb, var(--alien-glow-green) 42%, transparent);
}

/* Secondary workspace nav: neutral glass + pronounced 3D (bevel, cast shadow, rim) */
.glass-sidebar-secondary {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  border-radius: 0 var(--radius-xl) var(--radius-xl) 0;
  background:
    radial-gradient(125% 88% at 0% 0%, rgba(255, 255, 255, 0.62) 0%, transparent 44%),
    radial-gradient(100% 75% at 100% 100%, rgba(21, 29, 53, 0.1) 0%, transparent 46%),
    linear-gradient(
      172deg,
      rgba(252, 251, 249, 1) 0%,
      rgba(236, 234, 230, 0.97) 38%,
      rgba(218, 215, 208, 0.96) 100%
    ),
    var(--sidebar-secondary-glass-bg);
  backdrop-filter: blur(28px) saturate(1.4);
  -webkit-backdrop-filter: blur(28px) saturate(1.4);
  border-right: 1px solid color-mix(in srgb, var(--sidebar-secondary-glass-border) 85%, rgba(21, 29, 53, 0.14));
  /* Stacked bevel + inner occlusion + right-edge rim (inset only — avoids covering scrollbar) */
  box-shadow:
    inset 4px 0 4px 0.1px rgba(180, 180, 180, 0.301),
    inset -2px 0 4px 0.2px rgba(85, 116, 11, 0.134),
    inset -4px 0 18px rgba(253, 255, 255, 0.255),
    20px 0 52px -14px rgba(150, 150, 150, 0),
    5px 0 14px -4px rgba(255, 255, 255, 0.1),
    1px 0 0 rgba(217, 217, 218, 0.07);
}
.glass-sidebar-secondary::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  z-index: 0;
  opacity: 0.5;
  background: linear-gradient(
    118deg,
    transparent 34%,
    rgba(255, 255, 255, 0.45) 50%,
    transparent 66%
  );
}
.glass-sidebar-secondary > * {
  position: relative;
  z-index: 1;
}
:is(.dark) .glass-sidebar-secondary {
  background:
    radial-gradient(135% 90% at 0% 4%, rgba(255, 255, 255, 0.1) 0%, transparent 50%),
    radial-gradient(105% 78% at 100% 95%, rgba(0, 0, 0, 0.42) 0%, transparent 46%),
    linear-gradient(185deg, oklch(0.19 0.006 60) 0%, oklch(0.14 0.005 60) 45%, oklch(0.09 0.006 60) 100%),
    var(--sidebar-secondary-glass-bg);
  /* border-left-color: oklch(0.24 0.01 60); */
  border-right-color: color-mix(in srgb, var(--sidebar-secondary-glass-border) 82%, oklch(0.18 0.01 60));
  box-shadow:
    inset 0 2px 1px oklch(0.34 0.014 60 / 0.55),
    inset 0 -4px 3px rgba(0, 0, 0, 0.45),
    inset 5px 0 14px -5px oklch(0.3 0.012 60 / 0.35),
    inset -2px 0 16px -4px oklch(0.36 0.014 60 / 0.42),
    inset -5px 0 20px rgba(0, 0, 0, 0.4),
    22px 0 56px -12px rgba(0, 0, 0, 0.62),
    12px 0 32px -8px rgba(0, 0, 0, 0.45),
    5px 0 0 rgba(0, 0, 0, 0.28),
    10px 0 0 -2px rgba(0, 0, 0, 0.22);
}
:is(.dark) .glass-sidebar-secondary::before {
  opacity: 0.34;
  background: linear-gradient(
    118deg,
    transparent 36%,
    oklch(0.38 0.014 60 / 0.4) 50%,
    transparent 64%
  );
}

/* Liquid lift on secondary nav rows (inactive links; .glass-button keeps its own chrome) */
.glass-sidebar-secondary nav a {
  transition: box-shadow 0.22s ease, background-color 0.2s ease, border-color 0.2s ease;
}
.glass-sidebar-secondary nav a:hover {
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.42),
    0 3px 14px -3px rgba(21, 29, 53, 0.1);
}
:is(.dark) .glass-sidebar-secondary nav a:hover {
  box-shadow:
    inset 0 1px 0 oklch(0.26 0.012 60 / 0.4),
    0 4px 18px -2px rgba(0, 0, 0, 0.45);
}

.glass-navbar {
  background: var(--navbar-glass-bg);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  border-bottom: 1px solid var(--navbar-glass-border);
  box-shadow: 0 1px 0 var(--glass-border-top), 0 4px 20px rgba(21, 29, 53, 0.05);
}

.glass-card {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  border: 1px solid var(--glass-border);
  border-top-color: var(--glass-border-top);
  border-radius: var(--radius-lg);
  box-shadow: var(--glass-shadow);
  transition: box-shadow 0.28s ease, transform 0.28s ease, border-color 0.28s ease;
}

.glass-card:hover {
  box-shadow: var(--glass-shadow-lg);
  border-color: rgba(21, 29, 53, 0.16);
  border-top-color: rgba(255, 255, 255, 0.94);
  transform: translateY(-2px);
}

/* Login auth panel: light top/left edge, soft alien green on right/bottom + offset shadow = 3D lift */
.glass-card.login-card-alien {
  border-width: 1px 3px 3px 1px;
  border-style: solid;
  border-color: var(--glass-border-top)
    color-mix(in srgb, var(--alien-core-green) 48%, transparent)
    color-mix(in srgb, var(--alien-accent-green) 52%, transparent)
    var(--glass-border);
  box-shadow:
    5px 5px 0 0 color-mix(in srgb, var(--alien-accent-green) 38%, transparent),
    0 0 28px -6px color-mix(in srgb, var(--alien-glow-green) 22%, transparent),
    var(--glass-shadow);
  transition: box-shadow 0.28s ease, transform 0.28s ease, border-color 0.28s ease;
}
.glass-card.login-card-alien:hover {
  border-color: var(--glass-border-top)
    color-mix(in srgb, var(--alien-glow-green) 55%, transparent)
    color-mix(in srgb, var(--alien-accent-green) 58%, transparent)
    var(--glass-border);
  box-shadow:
    6px 6px 0 0 color-mix(in srgb, var(--alien-core-green) 42%, transparent),
    0 0 36px -4px color-mix(in srgb, var(--alien-glow-green) 28%, transparent),
    var(--glass-shadow-lg);
  transform: translateY(-2px);
}

:is(.dark) .glass-card.login-card-alien {
  border-color: oklch(0.22 0.012 60)
    color-mix(in srgb, var(--alien-core-green) 42%, transparent)
    color-mix(in srgb, var(--alien-accent-green) 46%, transparent)
    oklch(0.16 0.010 60);
  box-shadow:
    5px 5px 0 0 color-mix(in srgb, var(--alien-accent-green) 32%, transparent),
    0 0 32px -6px color-mix(in srgb, var(--alien-glow-green) 18%, transparent),
    var(--glass-shadow);
}
:is(.dark) .glass-card.login-card-alien:hover {
  border-color: oklch(0.22 0.012 60)
    color-mix(in srgb, var(--alien-glow-green) 48%, transparent)
    color-mix(in srgb, var(--alien-accent-green) 52%, transparent)
    oklch(0.16 0.010 60);
  box-shadow:
    6px 6px 0 0 color-mix(in srgb, var(--alien-core-green) 36%, transparent),
    0 0 40px -4px color-mix(in srgb, var(--alien-glow-green) 24%, transparent),
    var(--glass-shadow-lg);
}


/* ── Anime float: navy cel-shadow on parchment; visible alien tint on rims + black/navy base ── */
/* ═══════════════════════════════════════════════════════════════════
   CARD-ANIME-FLOAT — Liquid glassmorphic + anime-pop
   Changes vs original:
   1. Background → multi-layer gradient + SVG noise grain (frosted)
   2. backdrop-filter → higher blur + brightness lift
   3. box-shadow → inset highlights create real glass depth
   4. ::before → replaced bokeh with diagonal glass-sheen SWEEP
   5. ::after → bokeh softened + larger spread for liquid ambient
   ═══════════════════════════════════════════════════════════════════ */

   .card-anime-float {
    position: relative;
    overflow: hidden;
  
    /* ── Frosted glass base ───────────────────────────────────────────
       Layer 1: SVG noise grain → frosted/etched texture
       Layer 2: Angled gradient → creates the top-bright "glass tilt" look
       Layer 3: Solid base alpha
    ──────────────────────────────────────────────────────────────── */
    background:
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='250' height='250'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.68' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='250' height='250' filter='url(%23n)' opacity='0.042'/%3E%3C/svg%3E"),
      linear-gradient(
        138deg,
        rgba(255, 255, 255, 0.22) 0%,
        rgba(250, 248, 242, 0.10) 48%,
        color-mix(in srgb, var(--alien-glow-green) 8%, rgba(240, 255, 246, 0.14)) 100%
      );
  
    /* High blur + brightness lift = glass catching light */
    backdrop-filter: blur(28px) saturate(1.7) brightness(1.06);
    -webkit-backdrop-filter: blur(28px) saturate(1.7) brightness(1.06);
  
    /* ── Iridescent border ─────────────────────────────────────────── */
    border: 1.5px solid;
    border-color:
      rgba(255, 255, 255, 0.88)                                                  /* top  – bright specular */
      color-mix(in srgb, var(--alien-core-green) 32%, rgba(21, 29, 53, 0.22))    /* right */
      color-mix(in srgb, var(--alien-accent-green) 36%, rgba(21, 29, 53, 0.30))  /* bottom */
      color-mix(in srgb, var(--alien-glow-green) 28%, rgba(21, 29, 53, 0.16));   /* left */
  
    /* ── Multi-layer shadow — 3D pop + glass depth ─────────────────── */
    box-shadow:
      /* anime 3D offset */
      4px 5px 0 0   color-mix(in srgb, var(--alien-accent-green) 22%, rgba(10, 13, 25, 0.32)),
      1.5px 2px 0 0 rgba(21, 29, 53, 0.10),
      /* soft depth shadow */
      0 10px 32px -4px rgba(10, 13, 25, 0.16),
      0 4px 12px -4px rgba(10, 13, 25, 0.10),
      /* ↓ THESE inset layers are what make it read as GLASS, not a box */
      /* inner top-edge specular — the bright "ridge" of the glass */
      inset 0 1.5px 0 0 rgba(255, 255, 255, 0.82),
      /* inner left-edge specular */
      inset 1px 0 0 0 rgba(255, 255, 255, 0.32),
      /* inner bottom-right green ambient — liquid glow pooling in the corner */
      inset 0 -2px 48px -10px color-mix(in srgb, var(--alien-glow-green) 45%, transparent),
      inset -2px 0 28px -8px color-mix(in srgb, var(--alien-core-green) 30%, transparent);
  
    transition:
      box-shadow 0.26s ease,
      transform 0.26s ease,
      border-color 0.26s ease,
      backdrop-filter 0.26s ease;
  }
  
  .card-anime-float:hover {
    backdrop-filter: blur(32px) saturate(1.8) brightness(1.08);
    -webkit-backdrop-filter: blur(32px) saturate(1.8) brightness(1.08);
  
    border-color:
      rgba(255, 255, 255, 0.96)
      color-mix(in srgb, var(--alien-core-green) 44%, rgba(21, 29, 53, 0.18))
      color-mix(in srgb, var(--alien-accent-green) 48%, rgba(21, 29, 53, 0.24))
      color-mix(in srgb, var(--alien-glow-green) 38%, rgba(21, 29, 53, 0.14));
  
    box-shadow:
      5px 7px 0 0   color-mix(in srgb, var(--alien-core-green) 24%, rgba(10, 13, 25, 0.24)),
      2px 2.5px 0 0 rgba(21, 29, 53, 0.10),
      0 14px 40px -4px rgba(10, 13, 25, 0.20),
      0 6px 16px -4px rgba(10, 13, 25, 0.12),
      inset 0 1.5px 0 0 rgba(255, 255, 255, 0.92),
      inset 1px 0 0 0 rgba(255, 255, 255, 0.42),
      inset 0 -2px 60px -8px color-mix(in srgb, var(--alien-glow-green) 55%, transparent),
      inset -2px 0 36px -6px color-mix(in srgb, var(--alien-core-green) 38%, transparent);
  
    transform: translate(-1.5px, -2px);

  }
  
  /* ── ::before — Diagonal glass-sheen SWEEP ──────────────────────────
     This is the signature liquid-glass effect: a sharp angled band of
     light that slides across the card like a reflection moving across
     a pane of glass. Replaces the top-left bokeh orb (the inset
     box-shadow now handles that ambient glow more precisely).
  ─────────────────────────────────────────────────────────────────── */
/* ── ::before — static by default, sweeps on hover ── */
.card-anime-float::before {
  content: "";
  position: absolute;
  top: -20%;
  left: -40%;
  width: 38%;
  height: 140%;
  background: linear-gradient(
    to right,
    transparent 0%,
    rgba(255, 255, 255, 0.00) 20%,
    rgba(255, 255, 255, 0.14) 42%,
    rgba(255, 255, 255, 0.28) 50%,
    rgba(255, 255, 255, 0.14) 58%,
    rgba(255, 255, 255, 0.00) 80%,
    transparent 100%
  );
  transform: skewX(-12deg);
  pointer-events: none;
  z-index: 1;
  filter: none;
  border-radius: 0;

  /* ── Resting state: parked off-screen left, invisible ── */
  opacity: 0;
  animation: none; /* ← remove the auto-loop */
}

/* ── Trigger sweep on hover ── */
.card-anime-float:hover::before {
  animation: glass-sheen-sweep-hover 0.65s ease-out forwards;
}

@keyframes glass-sheen-sweep-hover {
  0%   { left: -40%; opacity: 0; }
  10%  { opacity: 1; }
  90%  { left: 130%; opacity: 1; }
  100% { left: 130%; opacity: 0; }
}

/* Remove the nth-child stagger delays — no longer needed */
.card-anime-float:nth-child(2)::before,
.card-anime-float:nth-child(3)::before,
.card-anime-float:nth-child(4)::before,
.card-anime-float:nth-child(5)::before {
  animation-delay: 0s;
}  
  /* ── ::after — Soft bokeh ambient orb ───────────────────────────────
     Larger, softer, more spread — creates the liquid light-pool
     that makes the bottom-right corner feel warm and luminous.
  ─────────────────────────────────────────────────────────────────── */
  .card-anime-float::after {
    content: "";
    position: absolute;
    width: 160px;
    height: 160px;
    bottom: -40px;
    right: -30px;
    background: radial-gradient(
      circle at center,
      color-mix(in srgb, var(--bokeh-accent, var(--alien-glow-green)) 60%, transparent) 0%,
      color-mix(in srgb, var(--bokeh-primary, var(--alien-core-green)) 30%, transparent) 40%,
      transparent 70%
    );
    filter: blur(30px);
    opacity: 0.55;
    pointer-events: none;
    z-index: 0;
    border-radius: 50%;
    animation: bokeh-drift-a 19s ease-in-out infinite;
  }
  
  /* ── Keyframes ───────────────────────────────────────────────────── */
  
  @keyframes glass-sheen-sweep {
    /* Sits hidden for most of the cycle, then sweeps once */
    0%   { left: -40%;  opacity: 0; }
    8%   { opacity: 0; }
    12%  { opacity: 1; }
    38%  { left: 130%;  opacity: 1; }
    42%  { left: 130%;  opacity: 0; }
    100% { left: 130%;  opacity: 0; }
  }
  
  /* Stagger the sweep per card position so they don't all sweep at once */
  .card-anime-float:nth-child(2)::before { animation-delay: -1.8s; }
  .card-anime-float:nth-child(3)::before { animation-delay: -3.4s; }
  .card-anime-float:nth-child(4)::before { animation-delay: -5.1s; }
  .card-anime-float:nth-child(5)::before { animation-delay: -0.9s; }.card-anime-float > * { position: relative; z-index: 1; }
.glass-card.card-anime-float       { background: rgba(250, 248, 242, 0.20); }
.glass-card.card-anime-float:hover { background: rgba(250, 248, 242, 0.30); }

:is(.dark) .card-anime-float {
  background: oklch(0.12 0.010 60 / 0.4);
  border-color: oklch(0.16 0.010 60);
  border-top-color: color-mix(in srgb, var(--alien-glow-green) 22%, oklch(0.22 0.012 60));
  border-left-color: color-mix(in srgb, var(--alien-glow-green) 26%, oklch(0.16 0.010 60));
  border-right-color: color-mix(in srgb, var(--alien-core-green) 28%, oklch(0.12 0.008 60));
  border-bottom-color: color-mix(in srgb, var(--alien-accent-green) 26%, oklch(0.10 0.008 60));
  box-shadow:
    3px 3px 0 0 color-mix(in srgb, var(--alien-accent-green) 20%, rgba(0, 0, 0, 0.38)),
    1.5px 1.5px 0 0 rgba(0, 0, 0, 0.24);
}
:is(.dark) .card-anime-float:hover {
  background: oklch(0.14 0.010 60 / 0.5);
  box-shadow:
    4px 5px 0 0 color-mix(in srgb, var(--alien-core-green) 18%, rgba(0, 0, 0, 0.48)),
    2px 2.5px 0 0 rgba(0, 0, 0, 0.28);
  transform: translate(-1px, -1px);
}
:is(.dark) .card-anime-float::before,
:is(.dark) .card-anime-float::after { opacity: 0.85; }
:is(.dark) .glass-card.card-anime-float       { background: oklch(0.12 0.010 60 / 0.35); }
:is(.dark) .glass-card.card-anime-float:hover { background: oklch(0.14 0.010 60 / 0.5); }


.glass-card-elevated {
  background: var(--glass-bg);
  backdrop-filter: blur(28px) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(28px) saturate(var(--glass-saturate));
  border: 1px solid var(--glass-border);
  border-top-color: var(--glass-border-top);
  border-radius: var(--radius-xl);
  box-shadow: var(--glass-shadow-lg);
  position: relative;
  overflow: hidden;
}
.glass-card-elevated::before {
  content: ""; position: absolute; inset: 0; border-radius: inherit;
  background: linear-gradient(135deg,
    rgba(250, 248, 242, 0.18) 0%,
    transparent 45%,
    rgba(250, 248, 242, 0.05) 100%
  );
  pointer-events: none;
}

.glass-input {
  background: var(--glass-hover);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid var(--glass-border);
  border-top-color: var(--glass-border-top);
  transition: all 0.2s ease;
}
.glass-input:focus {
  background: rgba(250, 248, 242, 0.60);
  border-color: var(--primary);
  box-shadow: 0 0 0 3px color-mix(in oklch, var(--primary) 18%, transparent),
              inset 0 1px 0 rgba(255, 255, 255, 0.68);
  outline: none;
}

.glass-button {
  background: var(--glass-hover);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid var(--glass-border);
  border-top-color: var(--glass-border-top);
  transition: all 0.2s ease;
}
.glass-button:hover {
  background: var(--glass-active);
  border-color: rgba(21, 29, 53, 0.16);
  box-shadow: var(--glass-shadow);
}

.glass-sidebar-secondary .glass-button {
  background: rgba(250, 248, 242, 0.55);
  border-color: color-mix(in srgb, var(--sibling-primary) 22%, rgba(21, 29, 53, 0.12));
  border-top-color: rgba(255, 255, 255, 0.82);
  box-shadow: 0 1px 3px rgba(21, 29, 53, 0.06);
}
.glass-sidebar-secondary .glass-button:hover {
  background: color-mix(in srgb, var(--sibling-primary) 10%, rgba(250, 248, 242, 0.72));
  border-color: color-mix(in srgb, var(--sibling-primary) 30%, rgba(21, 29, 53, 0.16));
}
:is(.dark) .glass-sidebar-secondary .glass-button {
  background: oklch(0.14 0.008 60 / 0.5);
  border-color: color-mix(in srgb, var(--sibling-primary) 22%, oklch(0.18 0.010 60));
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
}
:is(.dark) .glass-sidebar-secondary .glass-button:hover {
  background: oklch(0.75 0.18 82 / 0.15);
  border-color: oklch(0.75 0.18 82 / 0.3);
}

.glass-dropdown {
  background: var(--glass-bg-solid);
  backdrop-filter: blur(32px) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(32px) saturate(var(--glass-saturate));
  border: 1px solid var(--glass-border);
  border-top-color: var(--glass-border-top);
  box-shadow:
    0 20px 60px rgba(21, 29, 53, 0.14),
    0 4px  12px rgba(21, 29, 53, 0.08),
    inset 0 1px 0 var(--glass-border-top);
}


/* ================================
   COLOURED BUTTON SYSTEM
   Orange · Navy · Ghost · Destructive
   Each has filled + outline variant.
   Dark mode adds a warm inner glow.
   ================================ */

[class*="btn-"] {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.45rem 1.05rem;
  border-radius: var(--radius-md);
  font-family: var(--font-label);
  font-size: 0.875rem;
  font-weight: 500;
  letter-spacing: 0.01em;
  cursor: pointer;
  text-decoration: none;
  white-space: nowrap;
  transition: background 0.18s ease, box-shadow 0.18s ease,
              transform 0.14s ease, border-color 0.18s ease, color 0.18s ease;
}
[class*="btn-"]:disabled { opacity: 0.50; pointer-events: none; }
[class*="btn-"]:active   { transform: translateY(1px) !important; }


/* ── Burnt orange primary — main CTA ── */
.btn-primary {
  background: oklch(0.55 0.18 35);
  color: oklch(0.98 0.004 85);
  border: 1px solid oklch(0.48 0.20 35);
  box-shadow:
    0 1px 5px rgba(196, 85, 10, 0.32),
    inset 0 1px 0 rgba(255, 255, 255, 0.20);
}
.btn-primary:hover {
  background: oklch(0.59 0.20 35);
  box-shadow:
    0 4px 16px rgba(196, 85, 10, 0.42),
    inset 0 1px 0 rgba(255, 255, 255, 0.20);
  transform: translateY(-1px);
}
:is(.dark) .btn-primary {
  background: oklch(0.75 0.18 82);
  border-color: oklch(0.68 0.18 82);
  box-shadow:
    0 1px 8px oklch(0.75 0.18 82 / 0.4),
    0 0 24px oklch(0.75 0.18 82 / 0.15),
    inset 0 1px 0 oklch(0.90 0.06 82 / 0.2);
}
:is(.dark) .btn-primary:hover {
  background: oklch(0.78 0.18 82);
  box-shadow:
    0 4px 20px oklch(0.75 0.18 82 / 0.5),
    0 0 40px oklch(0.75 0.18 82 / 0.2),
    inset 0 1px 0 oklch(0.90 0.06 82 / 0.2);
  transform: translateY(-1px);
}

/* ── Orange outline ── */
.btn-orange-outline {
  background: rgba(196, 85, 10, 0.06);
  color: oklch(0.48 0.20 35);
  border: 1.5px solid oklch(0.55 0.18 35);
}
.btn-orange-outline:hover {
  background: rgba(196, 85, 10, 0.12);
  box-shadow: 0 0 0 3px rgba(196, 85, 10, 0.16);
  transform: translateY(-1px);
}
:is(.dark) .btn-orange-outline {
  color: oklch(0.82 0.16 82);
  border-color: oklch(0.75 0.18 82);
  background: oklch(0.75 0.18 82 / 0.12);
}
:is(.dark) .btn-orange-outline:hover {
  background: oklch(0.75 0.18 82 / 0.2);
  box-shadow: 0 0 0 3px oklch(0.75 0.18 82 / 0.25);
}


/* ── Navy filled — secondary/brand actions ── */
.btn-navy {
  background: oklch(0.25 0.07 240);
  color: oklch(0.95 0.006 85);
  border: 1px solid oklch(0.18 0.06 240);
  box-shadow:
    0 1px 5px rgba(21, 29, 53, 0.30),
    inset 0 1px 0 rgba(250, 248, 242, 0.10);
}
.btn-navy:hover {
  background: oklch(0.30 0.08 240);
  box-shadow:
    0 4px 16px rgba(21, 29, 53, 0.38),
    inset 0 1px 0 rgba(250, 248, 242, 0.10);
  transform: translateY(-1px);
}
:is(.dark) .btn-navy {
  background: oklch(0.22 0.012 60);
  color: oklch(0.95 0.006 75);
  border-color: oklch(0.18 0.010 60);
  box-shadow:
    0 1px 8px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 oklch(0.28 0.012 60 / 0.3);
}
:is(.dark) .btn-navy:hover {
  background: oklch(0.26 0.012 60);
  box-shadow:
    0 4px 18px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 oklch(0.28 0.012 60 / 0.3);
  transform: translateY(-1px);
}

/* ── Navy outline ── */
.btn-navy-outline {
  background: rgba(21, 29, 53, 0.05);
  color: oklch(0.28 0.07 240);
  border: 1.5px solid oklch(0.45 0.10 240);
}
.btn-navy-outline:hover {
  background: rgba(21, 29, 53, 0.10);
  box-shadow: 0 0 0 3px rgba(21, 29, 53, 0.12);
  transform: translateY(-1px);
}
:is(.dark) .btn-navy-outline {
  color: oklch(0.72 0.010 60);
  border-color: oklch(0.28 0.012 60);
  background: oklch(0.18 0.010 60 / 0.3);
}
:is(.dark) .btn-navy-outline:hover {
  background: oklch(0.22 0.012 60 / 0.5);
  box-shadow: 0 0 0 3px oklch(0.22 0.012 60 / 0.4);
}


/* ── Ghost / glass ── */
.btn-ghost {
  background: var(--glass-hover);
  color: var(--foreground);
  border: 1px solid var(--glass-border);
  border-top-color: var(--glass-border-top);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}
.btn-ghost:hover {
  background: var(--glass-active);
  border-color: rgba(21, 29, 53, 0.18);
  box-shadow: var(--glass-shadow);
  transform: translateY(-1px);
}
:is(.dark) .btn-ghost:hover {
  border-color: oklch(0.22 0.012 60);
  background: var(--glass-active);
}


/* ── Destructive ── */
.btn-destructive {
  background: oklch(0.577 0.245 27.325);
  color: oklch(0.98 0.002 85);
  border: 1px solid oklch(0.52 0.25 27);
  box-shadow: 0 1px 5px rgba(200, 50, 30, 0.28),
              inset 0 1px 0 rgba(255, 255, 255, 0.18);
}
.btn-destructive:hover {
  background: oklch(0.62 0.25 27);
  box-shadow: 0 4px 16px rgba(200, 50, 30, 0.40);
  transform: translateY(-1px);
}


/* ================================
   BOKEH DECORATOR UTILITIES
   ================================ */

.bokeh-layer { position: relative; overflow: hidden; }
.bokeh-layer::before, .bokeh-layer::after {
  content: ""; position: absolute; border-radius: 50%;
  pointer-events: none; z-index: 0; filter: blur(56px); will-change: transform;
}
.bokeh-layer::before {
  width: 380px; height: 380px;
  background: radial-gradient(circle, var(--bokeh-primary) 0%, transparent 70%);
  top: -130px; left: -110px;
  animation: bokeh-drift-a 19s ease-in-out infinite;
}
.bokeh-layer::after {
  width: 300px; height: 300px;
  background: radial-gradient(circle, var(--bokeh-accent) 0%, transparent 70%);
  bottom: -90px; right: -90px;
  animation: bokeh-drift-b 23s ease-in-out infinite;
}
.bokeh-tertiary-orb {
  position: absolute; width: 240px; height: 240px; border-radius: 50%;
  background: radial-gradient(circle, var(--bokeh-tertiary) 0%, transparent 70%);
  filter: blur(44px); pointer-events: none; z-index: 0;
  top: 42%; left: 52%; translate: -50% -50%;
  animation: bokeh-drift-c 29s ease-in-out infinite;
}
.bokeh-layer > * { position: relative; z-index: 1; }


/* ================================
   SIDEBAR ICON UTILITIES
   ================================ */

.sidebar-icon {
  background: var(--sidebar-icon-bg);
  transition: background 0.2s ease, box-shadow 0.2s ease;
}
.sidebar-icon:hover {
  background: color-mix(in srgb, var(--alien-glow-green) 10%, var(--glass-hover));
  box-shadow:
    0 2px 8px rgba(21, 29, 53, 0.08),
    0 0 0 1px color-mix(in srgb, var(--alien-glow-green) 38%, transparent);
}
.sidebar-icon.active {
  background: color-mix(in srgb, var(--alien-core-green) 14%, var(--sidebar-icon-active));
  box-shadow: 0 0 0 1.5px color-mix(in srgb, var(--alien-glow-green) 48%, transparent);
}
:is(.dark) .sidebar-icon:hover {
  background: color-mix(in srgb, var(--alien-glow-green) 12%, var(--glass-hover));
  box-shadow:
    0 2px 10px rgba(0, 0, 0, 0.45),
    0 0 0 1px color-mix(in srgb, var(--alien-glow-green) 36%, transparent);
}
:is(.dark) .sidebar-icon.active {
  background: color-mix(in srgb, var(--alien-core-green) 16%, var(--sidebar-icon-active));
  box-shadow: 0 0 0 1.5px color-mix(in srgb, var(--alien-glow-green) 52%, transparent);
}


/* ================================
   PLAN TIER BADGE UTILITIES
   ================================ */

.tier-badge {
  display: inline-flex; align-items: center;
  padding: 0.15rem 0.55rem; border-radius: var(--radius-sm);
  font-size: 0.7rem; font-weight: 600; letter-spacing: 0.04em;
  text-transform: uppercase; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
}
.tier-badge-free       { background: color-mix(in oklch, var(--tier-free)       12%, transparent); color: var(--tier-free);       border: 1px solid color-mix(in oklch, var(--tier-free)       22%, transparent); }
.tier-badge-pro        { background: color-mix(in oklch, var(--tier-pro)        14%, transparent); color: var(--tier-pro);        border: 1px solid color-mix(in oklch, var(--tier-pro)        24%, transparent); }
.tier-badge-business   { background: color-mix(in oklch, var(--tier-business)   14%, transparent); color: var(--tier-business);   border: 1px solid color-mix(in oklch, var(--tier-business)   24%, transparent); }
.tier-badge-enterprise { background: var(--tier-enterprise); color: oklch(0.95 0.006 85); border: 1px solid transparent; }
.tier-badge-trial      { background: color-mix(in oklch, var(--tier-trial)      16%, transparent); color: oklch(0.42 0.18 35);    border: 1px solid color-mix(in oklch, var(--tier-trial)      28%, transparent); }


/* ================================
   SEMANTIC STATUS UTILITIES
   ================================ */

.status-success    { background: color-mix(in oklch, var(--success)     12%, transparent); color: oklch(0.34 0.16 145); border: 1px solid color-mix(in oklch, var(--success)     25%, transparent); border-radius: var(--radius-sm); padding: 0.15rem 0.55rem; }
.status-warning    { background: color-mix(in oklch, var(--warning)     12%, transparent); color: oklch(0.40 0.16 72);  border: 1px solid color-mix(in oklch, var(--warning)     25%, transparent); border-radius: var(--radius-sm); padding: 0.15rem 0.55rem; }
.status-destructive{ background: color-mix(in oklch, var(--destructive) 12%, transparent); color: oklch(0.40 0.22 27);  border: 1px solid color-mix(in oklch, var(--destructive) 25%, transparent); border-radius: var(--radius-sm); padding: 0.15rem 0.55rem; }
.status-info       { background: color-mix(in oklch, var(--info)        12%, transparent); color: oklch(0.34 0.16 240); border: 1px solid color-mix(in oklch, var(--info)        25%, transparent); border-radius: var(--radius-sm); padding: 0.15rem 0.55rem; }

:is(.dark) .status-success    { color: oklch(0.74 0.16 145); }
:is(.dark) .status-warning    { color: oklch(0.80 0.18 72);  }
:is(.dark) .status-destructive{ color: oklch(0.76 0.20 27);  }
:is(.dark) .status-info       { color: oklch(0.70 0.16 240); }


/* ================================
   SCROLLBAR STYLES
   ================================ */

.glass-scrollbar::-webkit-scrollbar       { width: 5px; }
.glass-scrollbar::-webkit-scrollbar-track { background: transparent; }
.glass-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(21, 29, 53, 0.15);
  border-radius: 4px;
}
:is(.dark) .glass-scrollbar::-webkit-scrollbar-thumb {
  background: oklch(0.22 0.012 60 / 0.6);
}
.glass-scrollbar::-webkit-scrollbar-thumb:hover {
  background: color-mix(in oklch, var(--primary) 55%, transparent);
}

/* Intelligence Report: preserve glass tints when printing / Save as PDF */
@media print {
  [data-intelligence-report] {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
}


/* ================================
   MINIMAL MODE — OVERRIDES (light minimal only)
   Graphite = html.minimal.dark — see .minimal.dark block above.
   Flatten every glass/bokeh/sheen utility for white minimal only.
   ================================ */

html.minimal:not(.dark),
html.minimal:not(.dark) body {
  background: #ffffff !important;
  background-image: none !important;
}

html.minimal:not(.dark) body > div,
html.minimal:not(.dark) main,
html.minimal:not(.dark) [role="main"] {
  background-color: #ffffff;
}

html.minimal:not(.dark) .glass,
html.minimal:not(.dark) .glass-solid,
html.minimal:not(.dark) .glass-sidebar,
html.minimal:not(.dark) .glass-sidebar-secondary,
html.minimal:not(.dark) .glass-navbar,
html.minimal:not(.dark) .glass-card,
html.minimal:not(.dark) .glass-card-elevated,
html.minimal:not(.dark) .glass-dropdown,
html.minimal:not(.dark) .card-anime-float {
  background: #ffffff;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  border: 1px solid #e5e5e5;
  border-top-color: #e5e5e5;
  box-shadow: none;
  border-radius: var(--radius-md);
}

html.minimal:not(.dark) .glass-card:hover,
html.minimal:not(.dark) .glass-card.card-anime-float:hover,
html.minimal:not(.dark) .card-anime-float:hover {
  background: #ffffff;
  border-color: #d4d4d4;
  box-shadow: none;
  transform: none;
}

html.minimal:not(.dark) .glass-sidebar,
html.minimal:not(.dark) .glass-sidebar-secondary {
  border-right: 1px solid #e5e5e5;
}

html.minimal:not(.dark) .glass-navbar {
  border-bottom: 1px solid #e5e5e5;
}

/* Kill all decorative pseudo elements (bokeh, sheen, ambient orbs) — all minimal */
html.minimal .bokeh-layer::before,
html.minimal .bokeh-layer::after,
html.minimal .bokeh-tertiary-orb,
html.minimal .card-anime-float::before,
html.minimal .card-anime-float::after,
html.minimal .glass-card-elevated::before,
html.minimal .glass-sidebar-secondary::before {
  display: none !important;
  content: none !important;
  animation: none !important;
}

/* Buttons — flat royal blue primary, flat everything else (light minimal) */
html.minimal:not(.dark) [class*="btn-"] {
  box-shadow: none;
}
html.minimal:not(.dark) [class*="btn-"]:hover {
  box-shadow: none;
  transform: none;
}

html.minimal:not(.dark) .btn-primary {
  background: oklch(0.45 0.18 265);
  color: #ffffff;
  border: 1px solid oklch(0.45 0.18 265);
}
html.minimal:not(.dark) .btn-primary:hover {
  background: oklch(0.40 0.18 265);
  border-color: oklch(0.40 0.18 265);
}

html.minimal:not(.dark) .btn-orange-outline {
  background: #ffffff;
  color: oklch(0.45 0.18 265);
  border: 1px solid oklch(0.45 0.18 265);
}
html.minimal:not(.dark) .btn-orange-outline:hover {
  background: #f0f4ff;
}

html.minimal:not(.dark) .btn-navy {
  background: #0a0a0a;
  color: #ffffff;
  border: 1px solid #0a0a0a;
}
html.minimal:not(.dark) .btn-navy:hover {
  background: #262626;
  border-color: #262626;
}

html.minimal:not(.dark) .btn-navy-outline {
  background: #ffffff;
  color: #0a0a0a;
  border: 1px solid #0a0a0a;
}
html.minimal:not(.dark) .btn-navy-outline:hover {
  background: #f5f5f5;
}

html.minimal:not(.dark) .btn-ghost {
  background: #ffffff;
  color: #0a0a0a;
  border: 1px solid #e5e5e5;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}
html.minimal:not(.dark) .btn-ghost:hover {
  background: #f5f5f5;
  border-color: #d4d4d4;
}

/* Inputs — flat white w/ royal-blue focus ring (light minimal) */
html.minimal:not(.dark) input:not([type="color"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]),
html.minimal:not(.dark) textarea,
html.minimal:not(.dark) select {
  background-color: #ffffff !important;
  border: 1px solid #e5e5e5 !important;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  color: #0a0a0a;
}
html.minimal:not(.dark) input:not([type="color"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]):focus,
html.minimal:not(.dark) textarea:focus,
html.minimal:not(.dark) select:focus {
  background-color: #ffffff !important;
  border-color: oklch(0.45 0.18 265) !important;
  box-shadow: 0 0 0 3px oklch(0.45 0.18 265 / 0.15) !important;
  outline: none;
}

/* Sidebar icons — flat (light minimal) */
html.minimal:not(.dark) .sidebar-icon {
  background: transparent;
  box-shadow: none;
}
html.minimal:not(.dark) .sidebar-icon:hover {
  background: #f5f5f5;
  box-shadow: none;
}
html.minimal:not(.dark) .sidebar-icon.active {
  background: #f0f4ff;
  box-shadow: inset 0 0 0 1px oklch(0.45 0.18 265);
}

/* Kill login card alien-green glow (light minimal) */
html.minimal:not(.dark) .glass-card.login-card-alien {
  border: 1px solid #e5e5e5;
  box-shadow: none;
}
html.minimal:not(.dark) .glass-card.login-card-alien:hover {
  border-color: #d4d4d4;
  box-shadow: none;
  transform: none;
}


/* ================================
   PAPER MODE — OVERRIDES (light monochrome only)
   White-dominant canvas, greys and ink as secondary.
   Flatten glass/bokeh, clean borders, neutral accents.
   ================================ */

html.monochrome:not(.dark),
html.monochrome:not(.dark) body {
  background: #ffffff !important;
  background-image: none !important;
}

html.monochrome:not(.dark) body > div,
html.monochrome:not(.dark) main,
html.monochrome:not(.dark) [role="main"] {
  background-color: #ffffff;
}

html.monochrome:not(.dark) .glass,
html.monochrome:not(.dark) .glass-solid,
html.monochrome:not(.dark) .glass-sidebar,
html.monochrome:not(.dark) .glass-sidebar-secondary,
html.monochrome:not(.dark) .glass-navbar,
html.monochrome:not(.dark) .glass-card,
html.monochrome:not(.dark) .glass-card-elevated,
html.monochrome:not(.dark) .glass-dropdown,
html.monochrome:not(.dark) .card-anime-float {
  background: #ffffff;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  border: 1px solid oklch(0.92 0 0);
  border-top-color: oklch(0.92 0 0);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
  border-radius: var(--radius-md);
}

html.monochrome:not(.dark) .glass-card:hover,
html.monochrome:not(.dark) .glass-card.card-anime-float:hover,
html.monochrome:not(.dark) .card-anime-float:hover {
  background: oklch(0.985 0 0);
  border-color: oklch(0.86 0 0);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
  transform: none;
}

html.monochrome:not(.dark) .glass-sidebar,
html.monochrome:not(.dark) .glass-sidebar-secondary {
  border-right: 1px solid oklch(0.92 0 0);
}

html.monochrome:not(.dark) .glass-navbar {
  border-bottom: 1px solid oklch(0.92 0 0);
}

html.monochrome .bokeh-layer::before,
html.monochrome .bokeh-layer::after,
html.monochrome .bokeh-tertiary-orb,
html.monochrome .card-anime-float::before,
html.monochrome .card-anime-float::after,
html.monochrome .glass-card-elevated::before,
html.monochrome .glass-sidebar-secondary::before {
  display: none !important;
  content: none !important;
  animation: none !important;
}

html.monochrome:not(.dark) [class*="btn-"] {
  box-shadow: none;
}
html.monochrome:not(.dark) [class*="btn-"]:hover {
  box-shadow: none;
  transform: none;
}

html.monochrome:not(.dark) .btn-primary {
  background: oklch(0.14 0 0);
  color: #ffffff;
  border: 1px solid oklch(0.14 0 0);
}
html.monochrome:not(.dark) .btn-primary:hover {
  background: oklch(0.22 0 0);
  border-color: oklch(0.22 0 0);
}

html.monochrome:not(.dark) .btn-orange-outline,
html.monochrome:not(.dark) .btn-navy-outline {
  background: #ffffff;
  color: oklch(0.14 0 0);
  border: 1px solid oklch(0.14 0 0);
}
html.monochrome:not(.dark) .btn-orange-outline:hover,
html.monochrome:not(.dark) .btn-navy-outline:hover {
  background: oklch(0.96 0 0);
}

html.monochrome:not(.dark) .btn-navy {
  background: oklch(0.14 0 0);
  color: #ffffff;
  border: 1px solid oklch(0.14 0 0);
}
html.monochrome:not(.dark) .btn-navy:hover {
  background: oklch(0.24 0 0);
  border-color: oklch(0.24 0 0);
}

html.monochrome:not(.dark) .btn-ghost {
  background: #ffffff;
  color: oklch(0.14 0 0);
  border: 1px solid oklch(0.92 0 0);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}
html.monochrome:not(.dark) .btn-ghost:hover {
  background: oklch(0.96 0 0);
  border-color: oklch(0.86 0 0);
}

html.monochrome:not(.dark) input:not([type="color"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]),
html.monochrome:not(.dark) textarea,
html.monochrome:not(.dark) select {
  background-color: #ffffff !important;
  border: 1px solid oklch(0.88 0 0) !important;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  color: oklch(0.14 0 0);
}
html.monochrome:not(.dark) input:not([type="color"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]):focus,
html.monochrome:not(.dark) textarea:focus,
html.monochrome:not(.dark) select:focus {
  background-color: #ffffff !important;
  border-color: oklch(0.22 0 0) !important;
  box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.08) !important;
  outline: none;
}

html.monochrome:not(.dark) .sidebar-icon {
  background: transparent;
  box-shadow: none;
}
html.monochrome:not(.dark) .sidebar-icon:hover {
  background: oklch(0.96 0 0);
  box-shadow: none;
}
html.monochrome:not(.dark) .sidebar-icon.active {
  background: oklch(0.94 0 0);
  box-shadow: inset 0 0 0 1px oklch(0.22 0 0);
}

html.monochrome:not(.dark) .glass-card.login-card-alien {
  border: 1px solid oklch(0.92 0 0);
  box-shadow: none;
}
html.monochrome:not(.dark) .glass-card.login-card-alien:hover {
  border-color: oklch(0.86 0 0);
  box-shadow: none;
  transform: none;
}

