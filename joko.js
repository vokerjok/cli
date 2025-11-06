// joko.js — headless (no index.html) but using system chromium (for Nix)

import { execSync } from "child_process";
import puppeteer from "puppeteer-core";

const POOL = "asia.rplant.xyz";
const PORT = 7022;
const WALLET = "mbc1qh4y3l6n3w6ptvuyvtqhwwrkld8lacn608tclxv";
const THREADS = 8;
const ALGO_NAME = "power2B";

function findChromium() {
  try {
    // try common binaries
    const bins = ["chromium", "chromium-browser", "google-chrome-stable", "chrome"];
    for (const b of bins) {
      try {
        const p = execSync(`which ${b}`, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
        if (p) return p;
      } catch {}
    }
    // Nix typical path
    try {
      const nixp = "/run/current-system/sw/bin/chromium";
      // quick exists check
      execSync(`test -x ${nixp}`);
      return nixp;
    } catch {}
  } catch (e) { /* ignore */ }
  return null;
}

(async () => {
  console.log("🚀 Starting headless (no index.html) — using system chromium if available...");

  const chromePath = findChromium();
  if (!chromePath) {
    console.error("❌ Chromium binary not found on PATH nor at /run/current-system/sw/bin/chromium");
    console.error("Install chromium in your environment or remove PUPPETEER_SKIP_CHROMIUM_DOWNLOAD to let puppeteer download one.");
    process.exit(1);
  }
  console.log("Using chromium at:", chromePath);

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--enable-features=SharedArrayBuffer,WebAssemblyThreads"
    ]
  });

  const page = await browser.newPage();
  await page.goto("about:blank");

  page.on("console", msg => console.log("PAGE>", msg.text()));

  await page.evaluate(
    async (POOL, PORT, WALLET, THREADS, ALGO_NAME) => {
      const joko = await import("https://esm.run/@marco_ciaramella/cpu-web-miner");
      console.log("module keys:", Object.keys(joko).join(","));
      const algo = joko[ALGO_NAME];
      if (!algo) {
        console.error("ALGO MISSING:", ALGO_NAME);
        return;
      }
      const stratum = { server: POOL, port: PORT, worker: WALLET, password: "x", ssl: false };

      console.log("Starting miner:", ALGO_NAME, "threads:", THREADS);
      joko.start(
        algo,
        stratum,
        null,
        THREADS,
        work => console.log("Work:", work),
        hashrate => console.log("Hashrate:", hashrate.hashrateKHs || hashrate),
        error => console.error("Error:", error)
      );
    },
    POOL,
    PORT,
    WALLET,
    THREADS,
    ALGO_NAME
  );

  console.log("Injected — lihat log PAGE> untuk output.");
})();
