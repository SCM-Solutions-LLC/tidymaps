# Turning on the affiliate program

TidyMap already routes every outbound retailer link through
`js/affiliates.js`. Nothing else in the app needs to change — filling in the
IDs below is what switches the program on.

## What happens when it's on

- Product links in a plan's shopping list and the "search these retailers"
  fallback links get your tracking ID appended (Amazon) or get wrapped in the
  network's deep-link URL (Target, Walmart, The Container Store).
- The FTC disclosure appears automatically: next to the shopping list on every
  plan, and in the "Optional purchases" block on the homepage.
- The links are marked `rel="sponsored nofollow"`, which search engines require
  for paid placements and several programs ask for in their terms.

All three behaviors are driven off `affiliatesConfigured()`, so an unconfigured
site shows plain links and no disclosure — which is the correct state until a
program actually accepts you.

## Step by step

1. **Apply to the programs.** Each is free and takes a day or two to a few
   weeks to approve.

   | Retailer | Program | Where |
   | --- | --- | --- |
   | Amazon | Amazon Associates | affiliate-program.amazon.com |
   | Target | Target Partners (runs on Impact) | partners.target.com |
   | Walmart | Walmart Creator / Impact | one of walmart.com/creators or impact.com |
   | The Container Store | via CJ or Impact | check their affiliate page for the current network |
   | IKEA | no US program today | links stay plain; nothing to do |

   Amazon needs a live site with real content before it will approve you, and
   it requires a qualifying sale within 180 days of approval or the account is
   closed. Apply once the homepage is up, not before.

2. **Paste the IDs into `js/affiliates.js`.**

   ```js
   export const AFFILIATES = {
     'Amazon':              { param: 'tag', value: 'tidymap-20' },
     'Target':              { wrap: 'https://goto.target.com/c/123456/81938/2092?u={url}' },
     'Walmart':             { wrap: '' },
     'The Container Store': { wrap: '' },
     'IKEA':                {},
   };
   ```

   - Amazon gives you a **tracking tag** (`something-20`). It goes in `value`.
   - Impact and CJ give you a **deep link template**. Paste it whole into
     `wrap`, with `{url}` marking where the destination URL goes. The code
     URL-encodes the destination for you.
   - Leave an entry empty and that retailer keeps plain, unpaid links.

3. **Deploy and check one link.** Open a plan with purchases turned on, click a
   product, and confirm the destination URL carries your tag or network ID. The
   disclosure text should now be visible above the shopping list.

## Rules worth not breaking

- **Disclose before the click.** Handled automatically, but if you add product
  links anywhere new — an email, a social post, a blog page — the disclosure has
  to be there too, and near the link rather than buried in a footer.
- **Don't let commissions pick the products.** The catalog is hand-checked and
  the plan chooses by fit. Keeping that true is both the honest position and
  the one the homepage now states out loud under "Product links".
- **Prices go stale.** Amazon in particular forbids displaying a scraped price
  as current. `scripts/check-product-links.mjs` re-checks the catalog; the plan
  shows a "checked on" date next to any price.
- **Email is special.** Amazon prohibits affiliate links in email entirely. If
  the newsletter ever recommends products, link to a page on the site instead.
