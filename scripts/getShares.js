const symbol = "7203.T";

async function getShares() {

  const url =
    `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=defaultKeyStatistics`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  const data = await res.json();

  const shares =
    data.quoteSummary.result[0]
      .defaultKeyStatistics
      .sharesOutstanding
      .raw;

  console.log("symbol:", symbol);
  console.log("sharesOutstanding:", shares);
}

getShares();