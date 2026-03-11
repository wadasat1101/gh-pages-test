const fs = require("fs");
const path = require("path");

// ---- 設定（YAMLのenvを利用）
const SYMBOLS_FILE = parseFloat(process.env.SYMBOLS_FILE ?? "data/symbols/symbolsX.json");
const OUTPUT_DIR = parseFloat(process.env.OUTPUT_DIR ?? "data/ohlc");
const SLEEP_SEC = parseFloat(process.env.SLEEP_SEC ?? 2000);

const INTERVALS = {
	monthly: "m"
};

function sleep(ms) {
	return new Promise(r => setTimeout(r, ms));
}

async function fetchCSV(url) {
	const res = await fetch(url);
	return await res.text();
}

function parseCSV(text) {
	const lines = text.trim().split("\n");
	const header = lines.shift().split(",");

	return lines.map(line => {
		const cols = line.split(",");
		return {
			Data: cols[0],
			Otwarcie: cols[1],
			Najwyzszy: cols[2],
			Najnizszy: cols[3],
			Zamkniecie: cols[4],
			Wolumen: cols[5]
		};
	});
}

(async () => {

	const config = JSON.parse(fs.readFileSync(SYMBOLS_FILE,"utf8"));

	for (const market of config.markets) {

		const market_code = market.market;
		const suffix = market.suffix || "";

		console.log(`=== Market ${market_code}`);

		for (const [interval_name, interval_code] of Object.entries(INTERVALS)) {

			const interval_dir = `${OUTPUT_DIR}/${market_code}/${interval_name}`;
			fs.mkdirSync(interval_dir,{recursive:true});

			for (const sector of market.sectors) {

				const sector_name = sector.name;

				for (const symbol_info of sector.symbols) {

					const code = symbol_info.code;
					const symbol =
						symbol_info.stooq || `${code}${suffix}`;

					const url = `https://stooq.pl/q/d/l/?s=${symbol}&i=${interval_code}`;

					console.log(`Fetching ${symbol}`);

					try{

						const csv = await fetchCSV(url);
						const rows = parseCSV(csv);

						const records = [];

						for(const row of rows){

							if(!row.Data) continue;

							records.push({
								time: row.Data,
								open: Number(row.Otwarcie),
								high: Number(row.Najwyzszy),
								low: Number(row.Najnizszy),
								close: Number(row.Zamkniecie),
								volume: Number(row.Wolumen)
							});

						}

						fs.writeFileSync(
							`${interval_dir}/${code}.json`,
							JSON.stringify(records,null,2)
						);

						console.log(`Saved ${code}.json`);

					}catch(e){
						console.log("Error",e);
					}

					await sleep(SLEEP_SEC);

				}
			}
		}
	}

})();