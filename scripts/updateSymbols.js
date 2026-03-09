const fs = require("fs");
const XLSX = require("xlsx");

const JPX_URL =
"https://www.jpx.co.jp/markets/statistics-equities/misc/tvdivq0000001vg2-att/data_j.xls";

async function sleep(ms){
  return new Promise(r=>setTimeout(r,ms));
}

async function getShares(symbol){

  const url = `https://finance.yahoo.co.jp/quote/${symbol}`;

  const res = await fetch(url,{
    headers:{ "User-Agent":"Mozilla/5.0" }
  });

  const html = await res.text();

  const match = html.match(/発行済株式数[\s\S]*?([0-9,]+)<\/span>\s*<span[^>]*>株/);

  if(!match) return null;

  return Number(match[1].replace(/,/g,""));
}

async function run(){

  console.log("download JPX list...");

  const res = await fetch(JPX_URL);
  const buffer = Buffer.from(await res.arrayBuffer());

  const wb = XLSX.read(buffer);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);

  const stocks = {};

  for(const r of rows){

    const code = String(r["コード"]);

    if(!/^[0-9]{4}$/.test(code)) continue;

    const symbol = `${code}.T`;

    console.log("fetch:",symbol);

    const shares = await getShares(symbol);

    stocks[code] = {
      name: r["銘柄名"],
      market: r["市場・商品区分"],
      shares
    };

    await sleep(500);
  }

  fs.writeFileSync(
    "symbols_master.json",
    JSON.stringify(stocks,null,2)
  );

  console.log("done:",Object.keys(stocks).length);
}

run();