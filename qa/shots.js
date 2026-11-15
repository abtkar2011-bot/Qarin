// فحص ٢: صفحات متجر ePanda وسياسة الشحن عند سوق البن
const fs = require('fs'), path = require('path');
const OUT = process.env.OUT || 'shots-out'; fs.mkdirSync(OUT, { recursive: true });
const UA = 'Mozilla/5.0 (compatible; QarinBot/1.0; +https://abtkar2011-bot.github.io/Qarin/)';
const urls = ['https://www.epandaom.com/en/shop?ppg=200', 'https://www.epandaom.com/en/shop/page/2?ppg=200', 'https://www.epandaom.com/en/shop/category/lmthn-34?ppg=200', 'https://www.epandaom.com/en/terms', 'https://www.epandaom.com/en/website/info',
  'https://souqalbon.com/wp-json/wp/v2/pages?per_page=50&_fields=link,title', 'https://souqalbon.com/wp-json/wc/store/v1/products?per_page=100&page=4'];
(async () => {
  const log = [];
  for (const u of urls) {
    let line;
    try {
      const r = await fetch(u, { headers: { 'user-agent': UA, 'accept-language': 'en,ar' } });
      const t = await r.text();
      const f = u.replace(/^https:\/\/(www\.)?/, '').replace(/[^a-z0-9.]+/gi, '_').slice(0, 80);
      fs.writeFileSync(path.join(OUT, f + '.txt'), t.slice(0, 4000000));
      line = `${r.status} ${u} len=${t.length} carts=${(t.match(/oe_product_cart/g) || []).length} prices=${(t.match(/oe_currency_value/g) || []).length}`;
    } catch (e) { line = `ERR ${u} ${e.message}`; }
    log.push(line); console.log(line);
  }
  fs.writeFileSync(path.join(OUT, 'log.txt'), log.join('\n'));
})();
