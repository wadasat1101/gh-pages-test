const fs = require("fs");
const XLSX = require("xlsx");

const JPX_URL =
"https://www.jpx.co.jp/markets/statistics-equities/misc/tvdivq0000001vg2-att/data_j.xls";

const CHUNK_SIZE = 500;

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

	const list = [];

	for(const r of rows){

		const code = String(r["コード"]);

		if(!/^[0-9]{4}$/.test(code)) continue;

		const sectorCode = String(r["33業種コード"]);
		const sectorName = r["33業種区分"];

		if(sectorCode === "-" || !sectorCode) continue;

		const segment = marketToSegment(r["市場・商品区分"]);
		if(segment === null) continue;

		list.push({
			code,
			name:r["銘柄名"],
			sectorCode,
			sectorName,
			segment
		});
	}

	console.log("symbols:",list.length);

	// ===== sector構造作成 =====

	const sectorMap = new Map();

	for(const r of list){

		if(!sectorMap.has(r.sectorCode)){
			sectorMap.set(r.sectorCode,{
				code:r.sectorCode,
				name:r.sectorName,
				symbols:[]
			});
		}

		sectorMap.get(r.sectorCode).symbols.push({
			code:r.code,
			name:r.name,
			segment:r.segment
		});
	}

	// ===== 全体JSON作成 =====

	const allSectors = [...sectorMap.values()];

	const allResult = {
		source:"stooq",
		markets:[
			{
				market:"JP",
				name:"日本株",
				suffix:".jp",
				sectors:allSectors
			}
		]
	};

	fs.writeFileSync(
		`data/symbols/symbols_all.json`,
		JSON.stringify(allResult,null,2)
	);

	console.log("write: symbols_all.json");

	// ===== 500件分割 =====

	let fileIndex = 1;
	let symbolCount = 0;

	let currentSectors = [];
	let currentSector = null;

	for(const sector of sectorMap.values()){

		for(const sym of sector.symbols){

			if(!currentSector || currentSector.code !== sector.code){

				currentSector = {
					code:sector.code,
					name:sector.name,
					symbols:[]
				};

				currentSectors.push(currentSector);
			}

			currentSector.symbols.push(sym);

			symbolCount++;

			if(symbolCount >= CHUNK_SIZE){

				const result = {
					source:"stooq",
					markets:[
						{
							market:"JP",
							name:"日本株",
							suffix:".jp",
							sectors:currentSectors
						}
					]
				};

				const filename=`data/symbols/symbols${fileIndex}.json`;

				fs.writeFileSync(
					filename,
					JSON.stringify(result,null,2)
				);

				console.log("write:",filename);

				fileIndex++;
				symbolCount=0;
				currentSectors=[];
				currentSector=null;
			}
		}
	}

	if(symbolCount>0){

		const result={
			source:"stooq",
			markets:[
				{
					market:"JP",
					name:"日本株",
					suffix:".jp",
					sectors:currentSectors
				}
			]
		};

		const filename=`data/symbols/symbols${fileIndex}.json`;

		fs.writeFileSync(
			filename,
			JSON.stringify(result,null,2)
		);

		console.log("write:",filename);
	}

	console.log("done");
}

run();