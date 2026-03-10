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

function marketToSegment(market){

	if(!market) return null;

	if(market.includes("プライム")) return "p";
	if(market.includes("スタンダード")) return "s";
	if(market.includes("グロース")) return "g";

	return null;
}

async function run(){

	console.log("download JPX list...");

	const res = await fetch(JPX_URL);
	const buffer = Buffer.from(await res.arrayBuffer());

	const wb = XLSX.read(buffer);
	const sheet = wb.Sheets[wb.SheetNames[0]];
	const rows = XLSX.utils.sheet_to_json(sheet);

	const sectorMap = new Map();

	let count = 0;

	for(const r of rows){

		const code = String(r["コード"]);

		if(!/^[0-9]{4}$/.test(code)) continue;

		const sectorCode = String(r["33業種コード"]);
		const sectorName = r["33業種区分"];

		if(sectorCode === "-" || !sectorCode) continue;

		const segment = marketToSegment(r["市場・商品区分"]);

		// segmentがnullなら除外
		if(segment === null) continue;

		const symbol = `${code}.T`;

		console.log("fetch:",symbol);

		const shares = await getShares(symbol);

		if(!sectorMap.has(sectorCode)){
			sectorMap.set(sectorCode,{
				code: sectorCode,
				name: sectorName,
				symbols:[]
			});
		}

		sectorMap.get(sectorCode).symbols.push({
			code,
			name: r["銘柄名"],
			segment,
			shares
		});

		await sleep(500);

		count++;
		// if(count >= 100) break;
	}

	// ===== sectors構造を維持したまま500件ごとに分割 =====

	const CHUNK_SIZE = 500;

	let fileIndex = 1;
	let symbolCount = 0;

	let currentSectors = [];
	let currentSector = null;

	for(const sector of sectorMap.values()){

		for(const sym of sector.symbols){

			if(!currentSector || currentSector.code !== sector.code){
				currentSector = {
					code: sector.code,
					name: sector.name,
					symbols: []
				};
				currentSectors.push(currentSector);
			}

			currentSector.symbols.push(sym);

			symbolCount++;

			if(symbolCount >= CHUNK_SIZE){

				const result = {
					source: "stooq",
					markets: [
						{
							market: "JP",
							name: "日本株",
							suffix: ".jp",
							sectors: currentSectors
						}
					]
				};

				const filename = `_symbols${fileIndex}.json`;

				fs.writeFileSync(
					filename,
					JSON.stringify(result, null, 2)
				);

				console.log("write:", filename);

				fileIndex++;
				symbolCount = 0;
				currentSectors = [];
				currentSector = null;
			}
		}
	}

	// 残りを書き込み
	if(symbolCount > 0){

		const result = {
			source: "stooq",
			markets: [
				{
					market: "JP",
					name: "日本株",
					suffix: ".jp",
					sectors: currentSectors
				}
			]
		};

		const filename = `symbols${fileIndex}.json`;

		fs.writeFileSync(
			filename,
			JSON.stringify(result, null, 2)
		);

		console.log("write:", filename);
	}

	console.log("done");
}

run();