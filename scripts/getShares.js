const symbol = "7203.T";

async function getShares() {

  const url =
    `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  const json = await res.json();

  console.log(JSON.stringify(json, null, 2));

  const shares =
    json.quoteResponse.result[0].sharesOutstanding;

  console.log("symbol:", symbol);
  console.log("sharesOutstanding:", shares);
}

getShares();