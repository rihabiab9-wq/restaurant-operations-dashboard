# Restaurant Operations

An interactive, fictional restaurant operations prototype prepared collaboratively with AI assistance for Rihab Laaouaj's portfolio. Rihab is reviewing and learning the implementation before describing it as her own independent software work.

## The workflow

The manager selects a branch, checks items below their reorder level, records a physical count or waste, builds a multi-line supplier order, and receives only the goods accepted in a delivery. A short delivery remains open until the balance arrives or the order is closed. Every stock change has a movement record. A transfer creates an outgoing entry in one branch and an incoming entry in another. The activity view exports CSV.

The Insights view shows **received purchase spend**, **recorded waste value**, and **estimated on-hand inventory value**. It deliberately does not call these figures profit or food-cost percentage. Those need comparable sales and physical inventory periods, and likely recipe/POS integration.

## Try it

1. In Camden, review the low-stock list and the pending multi-item order.
2. Open that order, accept only part of the chicken, and note the discrepancy. It stays partially received.
3. Record the remainder later, or close the outstanding quantity.
4. Count an item, log waste, and transfer a matching item to Brixton.
5. Inspect the movement history and category spend, then export the history.
6. Use **About → Reset my demo data** to begin again. Each browser has a separate fictional workspace saved in D1.

## Technical notes

- Next-compatible routes through Vinext, React, TypeScript, Cloudflare D1, and CSS.
- The initial schema is in `drizzle/0000_nasty_shocker.sql`; the additional schema is appended in `drizzle/0001_lush_black_knight.sql`. Applied migrations are immutable.
- Backend input is validated and SQL uses prepared parameters. Operations use D1 batches where coordinated writes are needed. Negative quantities, duplicate items and order lines, excess receipts, and duplicate/closed receipts are rejected.
- The demo cookie identifies a fictional workspace; it is not a user account or suitable for sensitive business records.
- To build: `npm ci`, `npx tsc --noEmit`, `npm run build`. Hosted deployment requires the Sites D1 binding `DB` and schema migrations.

## Product boundaries

This is not production software or a food safety management system. It has no login, staff permissions, invoices, tax, POS sales, recipe depletion, expiry/lot traceability, temperature records, or verified allergen controls. It uses one unit per item and fictional prices. Stock value uses the latest recorded unit cost as a simple estimate; it is not a weighted-average inventory valuation.

## Research used for the product model

- [Food Standards Agency, Safer food, better business for caterers](https://www.food.gov.uk/business-guidance/safer-food-better-business-for-caterers): delivery and stock control concerns, rotation, and separate food safety responsibilities.
- [BCcampus Open Education, Purchasing](https://opentextbc.ca/basickitchenandfoodservicemanagement/chapter/purchasing/): buying quantities against expected use and deliveries.
- [BCcampus Open Education, Monthly Food Costs](https://opentextbc.ca/basickitchenandfoodservicemanagement/chapter/monthly-food-costs/): opening inventory + purchases − closing inventory, explaining why this prototype does not claim a food-cost percentage.
- [Toast, Generate Purchase Orders & Receive Inventory](https://support.toasttab.com/en/article/Toast-Retail-Generate-Purchase-Orders-Receive-Inventory): separate ordered and received states, including partial receiving.
- [Toast, Tracking and Managing Waste](https://support.toasttab.com/en/article/Toast-Inventory-Tracking-and-Managing-Waste-Canada-Ireland-and-UK): waste as a distinct stock event.
