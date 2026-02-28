const MA_CONFIG = [{
		period: 12,
		color: "#e91e63"
	},
	{
		period: 24,
		color: "#03a9f4"
	},
	{
		period: 36,
		color: "#ff9800"
	}
];

const $ = id => document.getElementById(id);
const isValid = v => v !== "-" && v !== undefined && v !== null;
const formatDev = d => ({
	text: (d >= 0 ? "+" : "") + d.toFixed(1) + "%",
	color: d >= 0 ? "#4caf50" : "#ef5350"
});

const UI = {
	symbolName: $("symbolNameLabel"),
	segmentName: $("segmentNameLabel"),
	date: $("dateLabel"),
	open: $("openLabel"),
	high: $("highLabel"),
	low: $("lowLabel"),
	close: $("closeLabel"),
	volume: $("volumeLabel"),
	tooltip: $("tooltip"),
	legend: $("maLegend"),
	market: $("marketSelect"),
	sector: $("sectorSelect"),
	symbol: $("symbolSelect"),
	result: $("result"),
	maVals: [],
	maDevs: []
};

const SEGMENTS = new Map([
	["p", "東証プライム"],
	["s", "東証スタンダード"],
	["g", "東証グロース"]
]);

const SYMBOLS = new Map();

MA_CONFIG.forEach((m, i) => {
	UI.legend.insertAdjacentHTML(
		"beforeend",
		`<span style="color:${m.color}">■MA(${m.period})</span>:<span id="ma${i+1}Val">-</span>(<span id="ma${i+1}Dev">-</span>) `
	);
	UI.maVals.push($(`ma${i+1}Val`));
	UI.maDevs.push($(`ma${i+1}Dev`));
});

const STATE = {
	config: null,
	market: null,
	sector: null,
	symbolCode: null,
	symbolName: null,
	segmentCode: null,
	segmentName: null,
	interval: "monthly",
	rawData: null,
	tradeLines: [],
	signals: {
		buy:[],
		sell:[]
	}
};

const chart = LightweightCharts.createChart($("chart"), {
	layout: {
		background: {
			color: "#111"
		},
		textColor: "#ddd"
	},
	grid: {
		vertLines: {
			color: "#222"
		},
		horzLines: {
			color: "#222"
		}
	},
	rightPriceScale: {
		scaleMargins: {
			top: .1,
			bottom: .3
		}
	},
	timeScale: {
		timeVisible: true
	},
	crosshair: {
		mode: LightweightCharts.CrosshairMode.Normal
	}
});

let candleSeries = chart.addSeries(LightweightCharts.CandlestickSeries, {
	upColor: "#4caf50",
	downColor: "#ef5350",
	borderUpColor: "#4caf50",
	borderDownColor: "#ef5350",
	wickUpColor: "#4caf50",
	wickDownColor: "#ef5350"
});

const volumeSeries = chart.addSeries(LightweightCharts.HistogramSeries, {
	priceFormat: {
		type: "volume"
	},
	priceScaleId: ""
});
volumeSeries.priceScale().applyOptions({
	scaleMargins: {
		top: .75,
		bottom: 0
	}
});

const maSeries = MA_CONFIG.map(cfg => chart.addSeries(
	LightweightCharts.LineSeries, {
		color: cfg.color,
		lineWidth: 1,
		lastValueVisible: false,
		priceLineVisible: false
	}));

const buildMALine = (data, p) =>
	data.filter(d => isValid(d["ma" + p]))
	.map(d => ({
		time: d.time,
		value: d["ma" + p]
	}));

function clearSim() {
	STATE.tradeLines.forEach(l => candleSeries.removePriceLine(l));
	STATE.tradeLines.length = 0;
}

function updateHeader(row) {
	UI.date.textContent = row.time;
	UI.open.textContent = row.open;
	UI.high.textContent = row.high;
	UI.low.textContent = row.low;
	UI.close.textContent = row.close;
	UI.volume.textContent = row.volume.toLocaleString();

	MA_CONFIG.forEach((cfg, i) => {
		const v = row["ma" + cfg.period];
		const d = row["dev" + cfg.period];
		if (isValid(v) && isValid(d)) {
			const f = formatDev(d);
			UI.maVals[i].textContent = v;
			UI.maDevs[i].textContent = f.text;
			UI.maDevs[i].style.color = f.color;
		} else {
			UI.maVals[i].textContent = "-";
			UI.maDevs[i].textContent = "-";
		}
	});
}

chart.subscribeCrosshairMove(param => {
	if (!param?.time || !param?.point) {
		UI.tooltip.style.display = "none";
		return;
	}
	const row = STATE.rawData.find(d => d.time === param.time);
	if (!row) return;

	updateHeader(row);

	let html = `<div><strong>${row.time}</strong></div>
<div>始値:${row.open}</div>
<div>高値:${row.high}</div>
<div>安値:${row.low}</div>
<div>終値:${row.close}</div>
<div>出来高:${row.volume.toLocaleString()}</div>`;

	MA_CONFIG.forEach(cfg => {
		const v = row["ma" + cfg.period];
		const d = row["dev" + cfg.period];
		if (isValid(v) && isValid(d)) {
			const f = formatDev(d);
			html += `<div>MA${cfg.period}:${v}
(<span style="color:${f.color}">${f.text}</span>)</div>`;
		}
	});

	UI.tooltip.innerHTML = html;
	const rect = $("chart").getBoundingClientRect();
	UI.tooltip.style.left = rect.left + param.point.x + 15 + "px";
	UI.tooltip.style.top = rect.top + param.point.y + 15 + "px";
	UI.tooltip.style.display = "block";
});

async function loadChart() {
	if (!STATE.symbolCode) return;

	clearSim();
	UI.result.innerHTML = "";

	try {
		const data = await (await fetch(
			`./data/${STATE.market}/${STATE.interval}/${STATE.symbolCode}.json`
		)).json();		
		
		STATE.rawData = data;

		candleSeries.setData(data);
		volumeSeries.setData(data.map(d => ({
			time: d.time,
			value: d.volume || 0,
			color: d.close >= d.open ? "#4caf50aa" : "#ef5350aa"
		})));

		MA_CONFIG.forEach((cfg, i) =>
			maSeries[i].setData(buildMALine(data, cfg.period)));

		if (data.length > 150) {
			chart.timeScale().setVisibleRange({
				from: data.at(-150).time,
				to: data.at(-1).time
			});
		}
		
		
		const m = STATE.config.markets.find(x => x.market === STATE.market);
		const s = m.sectors.find(x => x.code === STATE.sector);
		const sy = s.symbols.find(x => x.code === STATE.symbolCode);
		
		UI.symbolName.textContent = sy.name;
		UI.segmentName.textContent = SEGMENTS.get(sy.segment);
		
		STATE.symbolCode = sy.code;
		STATE.symbolName = sy.name

		updateHeader(data.at(-1));
		
	} catch (error) {
		console.error("Fetch error:", error);
		return null;
	}


}

$("runSim").onclick = () => {
	clearSim();

	const buyDev = parseFloat($("buyDev").value);
	const sellDev = parseFloat($("sellDev").value);
	const amount = parseFloat($("buyAmount").value);

	let qty = 0,
		cost = 0;
	let realized = 0;
	let logs = [];

	for (const row of STATE.rawData) {
		const dev = row.dev36;
		if (!isValid(dev)) continue;

		const price = row.close;

		if (dev <= buyDev) {
			const buyQty = Math.floor(amount / price);
			if (buyQty > 0) {
				qty += buyQty;
				cost += buyQty * price;

				logs.push(`<div class="log buy">
BUY ${row.time} @${price} x${buyQty}
乖離:${dev.toFixed(1)}% 保有:${qty}
</div>`);

				STATE.tradeLines.push(
					candleSeries.createPriceLine({
						price,
						color: "#4caf50",
						lineWidth: 1,
						lineStyle: 2,
						axisLabelVisible: true,
						title: "BUY"
					}));
			}
		} else if (qty > 0 && dev >= sellDev) {
			const avg = cost / qty;
			const pnl = (price - avg) * qty;
			realized += pnl;

			logs.push(`<div class="log sell">
SELL ${row.time} @${price}
株数:${qty} 損益:${pnl.toFixed(0)}
乖離:${dev.toFixed(1)}%
</div>`);

			STATE.tradeLines.push(
				candleSeries.createPriceLine({
					price,
					color: "#ff9800",
					lineWidth: 1,
					lineStyle: 2,
					axisLabelVisible: true,
					title: "SELL"
				}));

			qty = 0;
			cost = 0;
		}
	}

	let unrealized = 0;
	if (qty > 0) {
		const last = STATE.rawData.at(-1).close;
		unrealized = (last - (cost / qty)) * qty;
	}

	const total = realized + unrealized;

	UI.result.innerHTML =
		`<b>実現損益: ${realized.toFixed(0)} 円</b><br>
<b>評価損益: ${unrealized.toFixed(0)} 円</b><br>
<b>総損益: ${total.toFixed(0)} 円</b>
<hr>` + logs.join("");
};

$("clearSim").onclick = () => {
	clearSim();
	UI.result.innerHTML =``;
};

function populateMarkets() {
	UI.market.innerHTML = "";
	STATE.config.markets.forEach(m =>
		UI.market.appendChild(new Option(m.name, m.market)));
	STATE.market = STATE.config.markets[0].market;
	populateSectors();
}

function populateSectors(preserve=false) {

	const m = STATE.config.markets.find(x => x.market === STATE.market);

	UI.sector.innerHTML = "";

	m.sectors.forEach(s =>
		UI.sector.appendChild(new Option(s.name, s.code))
	);

	if(!preserve || !m.sectors.some(s=>s.code===STATE.sector)){
		STATE.sector = m.sectors[0].code;
	}

	UI.sector.value = STATE.sector;

	populateSymbols(preserve);
}

function populateSymbols(preserve=false) {

	const m = STATE.config.markets.find(x => x.market === STATE.market);
	const s = m.sectors.find(x => x.code === STATE.sector);

	UI.symbol.innerHTML = "";

	s.symbols.forEach(sym =>
		UI.symbol.appendChild(
			new Option(`${sym.code} ${sym.name}`, sym.code)
		)
	);

	if(!preserve || !s.symbols.some(sym=>sym.code===STATE.symbolCode)){
		STATE.symbolCode = s.symbols[0].code;
	}

	UI.symbol.value = STATE.symbolCode;
	loadChart();
}

function renderSignalLists() {

	const buyDiv = $("buyList");
	const sellDiv = $("sellList");

	buyDiv.innerHTML = "";
	sellDiv.innerHTML = "";

	const makeRow = s => {
		
		const el = document.createElement("div");

		el.style.cursor="pointer";
		el.style.fontSize="12px";
		el.style.padding="2px";
		
		const symbolName = SYMBOLS.get(s.symbol) != null ? SYMBOLS.get(s.symbol).name : "";
		const segmentName = SYMBOLS.get(s.symbol) != null ? SEGMENTS.get(SYMBOLS.get(s.symbol).segment) : "";
		el.textContent =
			`${s.symbol} ${symbolName} ${segmentName} (${s.timeframe}) ${s.dev36.toFixed(1)}%`;

		el.onclick = () => {

			STATE.market = s.market;
			STATE.interval = s.timeframe;
			STATE.symbolCode = s.symbol;

			// sector逆引き
			const marketObj = STATE.config.markets.find(m=>m.market===s.market);

			for(const sec of marketObj.sectors){
				if(sec.symbols.some(sym=>sym.code===s.symbol)){
					STATE.sector = sec.code;
					break;
				}
			}

			// UI同期
			UI.market.value = STATE.market;

			populateSectors(true);   // ← preserveモード

			// interval同期
			document.querySelectorAll("button[data-interval]")
				.forEach(b=>{
					b.classList.toggle(
						"active",
						b.dataset.interval === s.timeframe
					)
				});
		};
		return el;
	};

	STATE.signals.buy.forEach(s =>
		buyDiv.appendChild(makeRow(s)));

	STATE.signals.sell.forEach(s =>
		sellDiv.appendChild(makeRow(s)));
}

UI.market.onchange = e => {
	STATE.market = e.target.value;
	populateSectors();
};
UI.sector.onchange = e => {
	STATE.sector = e.target.value;
	populateSymbols();
};
UI.symbol.onchange = e => {
	STATE.symbolCode = e.target.value;
	loadChart();
};

document.querySelectorAll("button[data-interval]")
	.forEach(btn => {
		btn.onclick = () => {
			document.querySelectorAll("button[data-interval]")
				.forEach(b => b.classList.remove("active"));
			btn.classList.add("active");
			STATE.interval = btn.dataset.interval;
			loadChart();
		};
	});

Promise.all([
	fetch("./symbols0.json").then(r => r.json()),
	fetch("./symbols1.json").then(r => r.json()),
	fetch("./symbols2.json").then(r => r.json()),
	fetch("./symbols3.json").then(r => r.json()),
	fetch("./symbols4.json").then(r => r.json()),
	fetch("./symbols5.json").then(r => r.json()),
	fetch("./symbols6.json").then(r => r.json()),
	fetch("./symbols7.json").then(r => r.json()),
	fetch("./symbols8.json").then(r => r.json()),
])
.then((configs) => {
	// configs は [cfg1, cfg2, cfg3] の配列
	const mergedMarketsMap = new Map();

	configs.forEach(cfg => {
		cfg.markets.forEach(m => {
			if (mergedMarketsMap.has(m.market)) {
				const existing = mergedMarketsMap.get(m.market);

				// sectorsをコードでマージ
				const sectorMap = new Map();
				existing.sectors.forEach(s => sectorMap.set(s.code, {...s}));
				m.sectors.forEach(s => {
					if (sectorMap.has(s.code)) {
						// symbols をマージ（code で重複排除）
						const existingSymbols = sectorMap.get(s.code).symbols || [];
						const symbolMap = new Map();
						existingSymbols.forEach(sym => symbolMap.set(sym.code, sym));
						s.symbols.forEach(sym => symbolMap.set(sym.code, sym));
						sectorMap.get(s.code).symbols = Array.from(symbolMap.values());
					} else {
						sectorMap.set(s.code, {...s});
					}
					
					s.symbols.forEach(sym => {
						SYMBOLS.set(sym.code, {
							name: sym.name,
							segment: sym.segment
						});
					});
				});
				existing.sectors = Array.from(sectorMap.values());
			} else {
				mergedMarketsMap.set(m.market, {...m});
			}
		});
	});

	STATE.config = { markets: Array.from(mergedMarketsMap.values()) };
	populateMarkets();  // 1回だけ呼ぶ
})
.catch(err => console.error("JSON読み込みエラー:", err));

async function loadSignals() {

	try {
		const [buy, sell] = await Promise.all([
			fetch("./signals/buySignals.json").then(r=>r.json()),
			fetch("./signals/sellSignals.json").then(r=>r.json())
		]);

		STATE.signals.buy = buy;
		STATE.signals.sell = sell;

		renderSignalLists();

	} catch(e) {
		console.log("signal load failed", e);
	}
}

document.querySelectorAll(".tab-btn").forEach(btn=>{
	btn.onclick = () => {

		document.querySelectorAll(".tab-btn")
			.forEach(b=>b.classList.remove("active"));

		document.querySelectorAll(".tab-content")
			.forEach(c=>c.classList.remove("active"));

		btn.classList.add("active");
		$(btn.dataset.tab).classList.add("active");
	};
});

loadSignals();