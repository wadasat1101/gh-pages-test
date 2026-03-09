const symbol = "7203.T";

async function getShares() {

  const url = `https://finance.yahoo.co.jp/quote/${symbol}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  const html = await res.text();

  const match = html.match(/発行済株式数.*?([0-9,]+)株/);

  if (match) {
    const shares = match[1].replace(/,/g, "");
    console.log("symbol:", symbol);
    console.log("sharesOutstanding:", shares);
  } else {
    console.log("shares not found");
  }
}

getShares();