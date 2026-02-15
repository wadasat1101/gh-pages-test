// ===============================
// Trade Signal Builder
// ===============================

const fs = require("fs");
const path = require("path");

// ---- 設定（YAMLのenvを利用）
const BUY_DEV = parseFloat(process.env.BUY_DEV ?? -30);
const SELL_DEV = parseFloat(process.env.SELL_DEV ?? 30);

// 読み込む interval
const INTERVAL = "daily";   // 必要なら変更可

const DATA_ROOT = path.join(__dirname, "..", "data");
const OUT_DIR = path.join(__dirname, "..", "signals");

// 出力フォルダ作成
if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR);
}

// ===============================
// ユーティリティ
// ===============================

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);

    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat && stat.isDirectory()) {
            results = results.concat(walk(filePath));
        } else if (file.endsWith(".json")) {
            results.push(filePath);
        }
    });

    return results;
}

// ===============================
// メイン処理
// ===============================

const targetDir = [];

// data/*/daily/ を集める
fs.readdirSync(DATA_ROOT).forEach(market => {
    const p = path.join(DATA_ROOT, market, INTERVAL);
    if (fs.existsSync(p)) targetDir.push(p);
});

let buySignals = [];
let sellSignals = [];

targetDir.forEach(dir => {

    const files = walk(dir);

    files.forEach(file => {
        try {
            const raw = fs.readFileSync(file, "utf8");
            const data = JSON.parse(raw);

            if (!data.length) return;

            const last = data[data.length - 1];
            const dev = last.dev36;

            if (dev === undefined || dev === null) return;

            const symbol = path.basename(file, ".json");
            const market = file.split(path.sep)[file.split(path.sep).length - 3];

            const entry = {
                symbol,
                market,
                date: last.time,
                close: last.close,
                dev36: dev
            };

            if (dev <= BUY_DEV) {
                buySignals.push(entry);
            }

            if (dev >= SELL_DEV) {
                sellSignals.push(entry);
            }

        } catch (e) {
            console.log("skip:", file);
        }
    });
});

// ===============================
// ソート（重要度順）
// ===============================

buySignals.sort((a,b)=> a.dev36 - b.dev36); // 深く乖離順
sellSignals.sort((a,b)=> b.dev36 - a.dev36);

// ===============================
// 出力
// ===============================

fs.writeFileSync(
    path.join(OUT_DIR, "buySignals.json"),
    JSON.stringify(buySignals, null, 2)
);

fs.writeFileSync(
    path.join(OUT_DIR, "sellSignals.json"),
    JSON.stringify(sellSignals, null, 2)
);

console.log("========== DONE ==========");
console.log("BUY :", buySignals.length);
console.log("SELL:", sellSignals.length);
