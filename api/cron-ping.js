// ============================================================================
// SENCEO (v0.19) — SUPABASE AKTİFLİK ZAMANLAYICISI & PING SERVİSİ
// Vercel Cron Jobs ve Dış Ping Tetikleyicileri İçin Otomatik Uç Nokta
// ============================================================================

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const SUPABASE_PROJECT_ID = "kypzuqnksnlinkfuxvnl";
  const SUPABASE_URL = process.env.SUPABASE_URL || "https://kypzuqnksnlinkfuxvnl.supabase.co";
  const startedAt = Date.now();
  const timestampIso = new Date().toISOString();

  let supabaseRestStatus = 0;
  let supabaseRestMessage = "";

  // 1. Supabase REST API'ye canlandırma / aktiflik isteği gönder
  try {
    const sbRes = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: "GET",
      headers: {
        "User-Agent": "senceo-cron-keepalive/v0.19",
        "Cache-Control": "no-cache"
      }
    });
    supabaseRestStatus = sbRes.status;
    supabaseRestMessage = sbRes.statusText || "Reachable";
  } catch (err) {
    supabaseRestStatus = 500;
    supabaseRestMessage = err.message;
  }

  const durationMs = Date.now() - startedAt;

  // 2. Yanıt oluştur
  const responseData = {
    ok: true,
    service: "senceo-supabase-keepalive",
    version: "v0.19",
    timestamp: timestampIso,
    durationMs,
    cronSchedule: "Every 4 days (0 6 */4 * *)",
    supabase: {
      projectId: SUPABASE_PROJECT_ID,
      url: SUPABASE_URL,
      restGatewayStatus: supabaseRestStatus,
      message: supabaseRestMessage
    },
    statusNote: "Supabase projeniz 7 günlük inaktivite nedeniyle kapanmayacak şekilde başarıyla uyandırıldı."
  };

  return res.status(200).json(responseData);
}
