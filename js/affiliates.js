/* ============================================================
   Affiliate link configuration.

   TidyMap can earn a commission when someone buys through a product
   link. To turn this on, join each retailer's program and paste your
   IDs below. Shoppers pay the same price either way.

   - Amazon:  Amazon Associates (affiliate-program.amazon.com).
              Set value to your tracking tag, e.g. 'tidymap-20'.
   - Target:  Target Partners, runs on impact.com. You get a deep-link
              template; paste it as wrap with {url} where the product
              URL goes, e.g. 'https://goto.target.com/c/123456/81938/2092?u={url}'
   - Walmart: Walmart Creator / impact.com. Same wrap pattern.
   - The Container Store: via CJ or impact. Same wrap pattern.
   - IKEA:    no US affiliate program today, so links stay plain.

   Once any entry is filled in, the site automatically shows the
   required FTC disclosure next to product links.
   ============================================================ */
export const AFFILIATES = {
  'Amazon':              { param: 'tag', value: '' },
  'Target':              { wrap: '' },
  'Walmart':             { wrap: '' },
  'The Container Store': { wrap: '' },
  'IKEA':                {},
};

export function withAffiliate(url, retailer){
  const cfg = AFFILIATES[retailer];
  if(!cfg || !url) return url;
  try{
    if(cfg.param && cfg.value){
      const u = new URL(url);
      u.searchParams.set(cfg.param, cfg.value);
      return u.toString();
    }
    if(cfg.wrap) return cfg.wrap.replace('{url}', encodeURIComponent(url));
  }catch(e){ /* malformed url: fall through to the plain link */ }
  return url;
}

export function affiliatesConfigured(){
  return Object.values(AFFILIATES).some(c => (c.param && c.value) || c.wrap);
}

export const AFFILIATE_DISCLOSURE =
  'TidyMap may earn a commission on qualifying purchases made through these links. Prices stay the same for you.';
