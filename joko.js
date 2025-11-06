// joko.js — Headless Chromium CPU Miner (Stable Power2B with clean output)
import { execSync } from "child_process";
import puppeteer from "puppeteer-core";

const POOL = "asia.rplant.xyz";
const PORT = 7022;
const WALLET = `mbc1qh4y3l6n3w6ptvuyvtqhwwrkld8lacn608tclxv_${Date.now().toString().slice(-4)}`;
const THREADS = 8;
const ALGO_NAME = "power2B";

function findChromium() {
  const bins = ["chromium", "chromium-browser", "google-chrome-stable", "chrome"];
  for (const b of bins) {
    try {
      const path = execSync(`which ${b}`, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
      if (path) return path;
    } catch {}
  }
  try {
    const nixPath = "/run/current-system/sw/bin/chromium";
    execSync(`test -x ${nixPath}`);
    return nixPath;
  } catch {
    return null;
  }
}

async function startMiner(retry = false) {
  console.log(
    retry ? "\n🔁 Restarting miner..." : "🚀 Starting headless miner (puppeteer-core)..."
  );

  const chromePath = findChromium();
  if (!chromePath) {
    console.error("❌ Chromium not found. Install it or unset PUPPETEER_SKIP_CHROMIUM_DOWNLOAD.");
    process.exit(1);
  }
  console.log("🧩 Using Chromium:", chromePath);

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--enable-features=SharedArrayBuffer,WebAssemblyThreads,CrossOriginIsolation",
    ],
  });

  const page = await browser.newPage();
  await page.goto("about:blank");

  // Stream log dari context Chrome
  page.on("console", async (msg) => {
    const text = msg.text();

    // Format log Work
    if (text.includes("Work:")) {
      const data = text.match(/"extraNonce1":"(\w+)".*"jobId":"(\w+)"/);
      if (data) {
        console.log(`✅ Work => Job:${data[2]} Nonce:${data[1]}`);
      } else {
        console.log(`✅ Work => ${text.slice(0, 60)}...`);
      }
      return;
    }

    // Format Hashrate
    if (text.includes("Hashrate")) {
      const hr = parseFloat(text.match(/([\d.]+)/)?.[1] || "0");
      console.log(`⚙️  Hashrate: ${hr.toFixed(3)} KH/s`);
      return;
    }

    // Error deteksi
    if (text.includes("already mining")) {
      console.log("⚠️  Pool says: already mining. Waiting 30s and restarting...");
      await browser.close();
      setTimeout(() => startMiner(true), 30000);
      return;
    }

    console.log("PAGE>", text);
  });

  process.on("SIGINT", async () => {
    console.log("\n🛑 Stopping miner, closing browser...");
    await browser.close();
    process.exit(0);
  });

  // Jalankan miner di context Chromium
  await page.evaluate(
    async (POOL, PORT, WALLET, THREADS, ALGO_NAME) => {
      const joko = await import("https://esm.run/@marco_ciaramella/cpu-web-miner");

      // Worker unik per sesi
      const workerSuffix = Math.random().toString(36).slice(-4);
      const fullWorker = `${WALLET}.${workerSuffix}`;

      console.log("module keys:", Object.keys(joko).join(","));
      const algo = joko[ALGO_NAME];
      if (!algo) {
        console.error("❌ Algo not found:", ALGO_NAME);
        return;
      }

      const stratum = {
        server: POOL,
        port: PORT,
        worker: fullWorker,
        password: "x",
        ssl: false,
      };

      console.log(`⛏️  Starting miner with ${ALGO_NAME} (${THREADS} threads), worker: ${workerSuffix}`);

      joko.start(
        algo,
        stratum,
        null,
        THREADS,
        (work) => console.log("Work:", JSON.stringify(work)),
        (hashrate) => console.log("Hashrate:", hashrate.hashrateKHs || 0),
        (error) => console.error("Error:", JSON.stringify(error))
      );
    },
    POOL,
    PORT,
    WALLET,
    THREADS,
    ALGO_NAME
  );

  console.log("Injected — lihat log PAGE> untuk aktivitas mining...");
}

startMiner();
