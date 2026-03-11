const fs = require("fs");

// ---------- 設定 ----------
const SYMBOLS_FILE = process.env.SYMBOLS_FILE ?? "data/symbols/symbolsX.json";
const OUTPUT_DIR   = process.env.OUTPUT_DIR   ?? "data/ohlc";

const BATCH_SIZE   = Number(process.env.BATCH_SIZE ?? 10);
const SLEEP_MS     = Number(process.env.SLEEP_SEC ?? 2000);

const INTERVALS = {
	monthly: "m"
};

// ---------- util ----------
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- CSV取得 ----------
async function fetchCSV(url){

	const res = await fetch(url);

	if(!res.ok){
		throw new Error(`HTTP ${res.status}`);
	}

	return await res.text();
}

// ---------- CSV解析 ----------
function parseCSV(text){

	const lines = text.trim().split("\n");
	lines.shift();

	return lines.map(line => {

		const c = line.split(",");

		return {
			time: c[0],
			open: Number(c[1]),
			high: Number(c[2]),
			low: Number(c[3]),
			close: Number(c[4]),
			volume: Number(c[5])
		};

	});
}

// ---------- 指標計算（高速移動平均） ----------
function addIndicators(data){

	const N = 36;

	let sumClose = 0;
	let sumValue = 0;

	for(let i=0;i<data.length;i++){

		const close = data[i].close;
		const value = close * data[i].volume;

		sumClose += close;
		sumValue += value;

		if(i >= N){
			sumClose -= data[i-N].close;
			sumValue -= data[i-N].close * data[i-N].volume;
		}

		if(i < N-1){

			data[i].ma36 = null;
			data[i].dev36 = null;
			data[i].tav36 = null;

			continue;
		}

		const ma = sumClose / N;
		const tav = sumValue / N;
		const dev = (close - ma) / ma * 100;

		data[i].ma36  = Number(ma.toFixed(1));
		data[i].dev36 = Number(dev.toFixed(1));
		data[i].tav36 = Number(tav.toFixed(1));

		data[i].open   = Number(data[i].open.toFixed(1));
		data[i].high   = Number(data[i].high.toFixed(1));
		data[i].low    = Number(data[i].low.toFixed(1));
		data[i].close  = Number(data[i].close.toFixed(1));
		data[i].volume = Number(data[i].volume.toFixed(1));
	}
}

// ---------- symbol処理 ----------
async function processSymbol(task){

	const {symbol,code,interval_dir,interval_code} = task;

	const url = `https://stooq.pl/q/d/l/?s=${symbol}&i=${interval_code}`;

	try{

		console.log("Fetching",symbol);

		const csv = await fetchCSV(url);
		const rows = parseCSV(csv);

		addIndicators(rows);

		fs.writeFileSync(
			`${interval_dir}/${code}.json`,
			JSON.stringify(rows,null,2)
		);

		console.log("Saved",code);

	}catch(e){

		console.log("Error",symbol,e.message);

	}
}

// ---------- main ----------
(async()=>{

	console.log("SYMBOLS_FILE ->",SYMBOLS_FILE);

	const config = JSON.parse(
		fs.readFileSync(SYMBOLS_FILE,"utf8")
	);

	for(const market of config.markets){

		const market_code = market.market;
		const suffix = market.suffix ?? "";

		console.log(`=== Market ${market_code}`);

		for(const [interval_name,interval_code] of Object.entries(INTERVALS)){

			const interval_dir =
				`${OUTPUT_DIR}/${market_code}/${interval_name}`;

			fs.mkdirSync(interval_dir,{recursive:true});

			// ---------- symbol配列作成 ----------
			const tasks = [];

			for(const sector of market.sectors){

				for(const sym of sector.symbols){

					const code = sym.code;
					const symbol =
						sym.stooq ?? `${code}${suffix}`;

					tasks.push({
						symbol,
						code,
						interval_dir,
						interval_code
					});
				}
			}

			console.log(`Total symbols: ${tasks.length}`);

			// ---------- バッチ処理 ----------
			for(let i=0;i<tasks.length;i+=BATCH_SIZE){

				const batch =
					tasks.slice(i,i+BATCH_SIZE);

				await Promise.all(
					batch.map(processSymbol)
				);

				console.log(
					`Progress ${Math.min(i+BATCH_SIZE,tasks.length)}/${tasks.length}`
				);

				if(i + BATCH_SIZE < tasks.length){
					await sleep(SLEEP_MS);
				}
			}
		}
	}

	console.log("All done");

})();