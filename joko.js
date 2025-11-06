// headless-noindex.js — coba tanpa index.html (inject ke about:blank)
import puppeteer from "puppeteer";

const POOL = "asia.rplant.xyz";
const PORT = 7022;
const WALLET = "mbc1qh4y3l6n3w6ptvuyvtqhwwrkld8lacn608tclxv";
const THREADS = 1;      // kalau SharedArrayBuffer bermasalah, pakai 1
const ALGO_NAME = "power2B"; // pastikan kapitalisasi sesuai (power2B)

(async () => {
  console.log("🚀 Start headless (no index.html) — mencoba inject module...");

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      // aktifkan fitur threading (masih mungkin perlu COOP/COEP)
      "--enable-features=SharedArrayBuffer,WebAssemblyThreads"
    ]
  });

  const page = await browser.newPage();
  await page.goto("about:blank");

  // tampilkan console page ke terminal
  page.on("console", msg => console.log("PAGE>", msg.text()));

  // inject + start
  await page.evaluate(
    async (POOL, PORT, WALLET, THREADS, ALGO_NAME) => {
      const joko = await import("https://esm.run/@marco_ciaramella/cpu-web-miner");
      console.log("module keys:", Object.keys(joko).join(","));

      // periksa apakah algo ada
      const algo = joko[ALGO_NAME];
      if (!algo) {
        console.error("ALGO MISSING:", ALGO_NAME);
        return;
      }

      const stratum = {
        server: POOL,
        port: PORT,
        worker: WALLET,
        password: "x",
        ssl: false
      };

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
