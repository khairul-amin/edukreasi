import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  "https://esmkveggutxzklavspnn.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzbWt2ZWdndXR4emtsYXZzcG5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzODIyNTQsImV4cCI6MjA3NTk1ODI1NH0.18vlPWg1S_6ocoCWKaCh_KU41TbipXyQNS2r5GKRQ44" // anon key
);

function hashNPSN(npsn) {
  return crypto.createHash("sha256").update(npsn).digest("hex").slice(0, 12);
}

export default async function handler(req, res) {
  try {
    const { k } = req.query;
    if (!k) return res.status(400).json({ error: "Kode hash tidak ada" });

    const { data, error } = await supabase
      .from("user_profiles")
      .select("npsn, link_spreadsheet");

    if (error) throw error;

    const match = data.find(u => hashNPSN(u.npsn.trim()) === k);
    if (!match) return res.status(404).json({ error: "Sekolah tidak ditemukan" });

    // 🔧 Perbaikan: otomatis ubah link pubhtml jadi CSV
    let sheetUrl = match.link_spreadsheet.trim();
    if (sheetUrl.includes("pubhtml")) {
      sheetUrl = sheetUrl.replace("pubhtml", "pub?output=csv");
    }

    // 🔄 Ambil CSV dari spreadsheet publik
    const response = await fetch(sheetUrl, { cache: "no-store" });
    const csv = await response.text();

    // 🔍 Ambil nilai token dari CSV
    const rows = csv.split("\n").map(r => r.split(","));
    const token = rows[1]?.[4] || "Tidak ada token";

    res.status(200).json({ token: token.trim() });
  } catch (err) {
    console.error("API Error:", err);
    res.status(500).json({ error: "Gagal ambil token" });
  }
}
