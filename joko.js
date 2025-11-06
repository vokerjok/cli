// joko.js — Headless Chromium Miner (Power2B) with auto worker JOKO-[RANDOM]
import { execSync } from "child_process";
import puppeteer from "puppeteer-core";

const POOL = "asia.rplant.xyz";
const PORT = 7022;
const WALLET_BASE = "mbc1qh4y3l6n3w6ptvuyvtqhwwrkld8lacn608tclxv";
const THREADS = 8;
const ALGO_NAME = "power2B";

// 🔧 Generate random JOKO-[xxxx]
function randomWorker() {
  const chars = Math.random().toString(36).substring(2, 6);
  return `${WALLET_BASE}.JOKO-${chars}`;
}

// 🔍 Find Chromium binary in system
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

// 🚀 Start Headless Miner
async function startMiner(retry = false) {
  console.log(retry ? "\n🔁 Restarting miner..." : "🚀 Starting headless miner (puppeteer-core)...");

  const chromePath = findChromium();
  if (!chromePath) {
    console.error("❌ Chromium not found! Install it or unset PUPPETEER_SKIP_CHROMIUM_DOWNLOAD.");
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
      "--enable-features=SharedArrayBuffer,WebAssemblyThreads,CrossOriginIsolation"
    ]
  });

  const page = await browser.newPage();
  await page.goto("about:blank");

  // 🧠 Handle console output from browser context
  page.on("console", async (msg) => {
    const text = msg.text();

    if (text.includes("Work:")) {
      const data = text.match(/"extraNonce1":"(\w+)".*"jobId":"(\w+)"/);
      if (data) console.log(`✅ Work => Job:${data[2]} Nonce:${data[1]}`);
      else console.log(`✅ Work => ${text.slice(0, 80)}...`);
      return;
    }

    if (text.includes("Hashrate")) {
      const hr = parseFloat(text.match(/([\d.]+)/)?.[1] || "0");
      console.log(`⚙️  Hashrate: ${hr.toFixed(3)} KH/s`);
      return;
    }

    if (text.includes("already mining")) {
      console.log("⚠️ Pool says: already mining. Waiting 30s then retry...");
      await browser.close();
      setTimeout(() => startMiner(true), 30000);
      return;
    }

    console.log("PAGE>", text);
  });

  process.on("SIGINT", async () => {
    console.log("\n🛑 Miner stopped manually, closing browser...");
    await browser.close();
    process.exit(0);
  });

  // 🧩 Inject miner into browser page
  await page.evaluate(
    async (POOL, PORT, WALLET, THREADS, ALGO_NAME) => {
      const joko = await import("https://esm.run/@marco_ciaramella/cpu-web-miner");

      console.log("module keys:", Object.keys(joko).join(","));
      const algo = joko[ALGO_NAME];
      if (!algo) {
        console.error("❌ Algo not found:", ALGO_NAME);
        return;
      }

      const stratum = { server: POOL, port: PORT, worker: WALLET, password: "x", ssl: false };
      console.log(`⛏️  Starting miner with algo ${ALGO_NAME}, threads: ${THREADS}, worker: ${WALLET}`);

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
    randomWorker(), // 🧩 worker unik tiap start
    THREADS,
    ALGO_NAME
  );

  console.log("Injected — lihat log PAGE> untuk aktivitas mining...");
}

startMiner();
