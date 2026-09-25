# Warkop Kita — Digital Menu & WhatsApp Ordering

A simple, no-backend web app for a warkop / kedai kopi. Customers scan a QR code on the table,
browse the menu, add items to a cart, and send a neatly formatted order to the owner's WhatsApp.

## Features

- Menu with category tabs (Kopi, Non-Kopi, Makanan, Camilan) and search
- "Favorit" / "Baru" tags and "Habis" (sold out) state
- Cart with quantity stepper, saved in the browser
- Dine-in / take-away, name, table number, notes
- Table number prefilled from the QR link: `index.html?meja=4`
- Order sent via `wa.me` link — no server, no app download
- Live open/closed status from opening hours
- Location, hours and Google Maps embed
- Responsive: bottom-sheet cart and floating cart bar on mobile

## Design

Palette:

| Name | Hex | Used for |
|---|---|---|
| Persian Blue | `#013FD0` | Primary buttons, headings accent, stats & CTA bands |
| Amber Flame | `#FFB423` | Highlights, badges, "Favorit" tag, secondary CTA |
| Azure Mist | `#F0FAFB` | Soft section backgrounds |

Font: Poppins. Layout follows a modern SaaS landing style: big editorial hero,
status pill, stats strip, card grid, numbered steps and a bold CTA band.

## Customise

- **Store info** (name, WhatsApp number, address, hours, Instagram): `js/config.js`
- **Menu** (items, prices, categories, sold out): `js/menu.js`
- **Colours / styling**: tokens at the top of `css/style.css`

## Run

Open `index.html` directly in a browser — no build step. To publish, push to GitHub Pages,
Netlify or any static host, then print a QR code per table pointing to
`https://your-site/?meja=<table number>`.

## Structure

```
index.html      Page markup
css/style.css   Styles and design tokens
js/config.js    Store settings
js/menu.js      Menu data
js/app.js       Menu rendering, cart, checkout
```
