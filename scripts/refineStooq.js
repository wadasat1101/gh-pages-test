const fs = require("fs");
const path = require("path");

// ===== 設定 =====
const INPUT_DIR = "E:/gh-pages-test/data/stooq/data/daily/jp/tse stocks";
const OUTPUT_DIR = "E:/gh-pages-test/data/ohlc/jp/monthly";

// ===== 小数1桁丸め =====
function round1(v) {
  return Math.round(v * 10) / 10;
}

// ===== 再帰で.txt取得 =====
function getAllTxtFiles(dir) {
  let results = [];

  for (const file of fs.readdirSync(dir)) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) {
      results = results.concat(getAllTxtFiles(full));
    } else if (file.endsWith(".txt")) {
      results.push(full);
    }
  }

  return results;
}

// ===== 日足 → 月足 =====
function convertToMonthly(csvText) {
  if (!csvText.trim()) return [];

  const lines = csvText.trim().split("\n");
  const dataLines = lines.slice(1);

  const map = {};

  dataLines.forEach(line => {
    const c = line.split(",");

    const date = c[2];
    const open = parseFloat(c[4]);
    const high = parseFloat(c[5]);
    const low = parseFloat(c[6]);
    const close = parseFloat(c[7]);
    const vol = parseInt(c[8]);

    const y = date.slice(0, 4);
    const m = date.slice(4, 6);
    const key = `${y}-${m}`;

    if (!map[key]) {
      map[key] = {
        time: `${y}-${m}-01`,
        open,
        high,
        low,
        close,
        volume: vol
      };
    } else {
      const d = map[key];
      d.high = Math.max(d.high, high);
      d.low = Math.min(d.low, low);
      d.close = close;
      d.volume += vol;
    }
  });

  return Object.values(map).sort((a, b) =>
    a.time.localeCompare(b.time)
  );
}

// ===== 指標追加 =====
function addIndicators(data) {
  const closes = [];
  const tradingValues = [];

  data.forEach((d, i) => {
    closes.push(d.close);
    tradingValues.push(d.close * d.volume);

    if (i < 35) {
      d.ma36 = null;
      d.dev36 = null;
      d.tav36 = null;
      return;
    }

    const closeSlice = closes.slice(i - 35, i + 1);
    const tvSlice = tradingValues.slice(i - 35, i + 1);

    const ma = closeSlice.reduce((a, b) => a + b, 0) / 36;
    const tav = tvSlice.reduce((a, b) => a + b, 0) / 36;
    const dev = ((d.close - ma) / ma) * 100;

    d.ma36 = round1(ma);
    d.dev36 = round1(dev);
    d.tav36 = round1(tav);
  });

  return data;
}

// ===== メイン =====
function main() {
  const files = getAllTxtFiles(INPUT_DIR);

  console.log(`対象: ${files.length}ファイル`);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  files.forEach(file => {
    const name = path.basename(file);
    const code = name.split(".")[0];
    const out = path.join(OUTPUT_DIR, `${code}.json`);

    try {
      const csv = fs.readFileSync(file, "utf8");

      let monthly = convertToMonthly(csv);
      monthly = addIndicators(monthly);

      fs.writeFileSync(out, JSON.stringify(monthly, null, 2));

      console.log(`OK: ${code}`);
    } catch (e) {
      console.error(`ERROR: ${file}`);

      fs.writeFileSync(out, "[]");
    }
  });
}

main();