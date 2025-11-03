import { createClient } from "@supabase/supabase-js";

// 🔹 Konfigurasi Supabase
const supabase = createClient(
  "https://esmkveggutxzklavspnn.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzbWt2ZWdndXR4emtsYXZzcG5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzODIyNTQsImV4cCI6MjA3NTk1ODI1NH0.18vlPWg1S_6ocoCWKaCh_KU41TbipXyQNS2r5GKRQ44"
);

export default async function handler(req, res) {
  try {
    const { k } = req.query;
    if (!k) return res.status(400).json({ error: "Parameter k (NPSN) wajib diisi" });

    console.log("NPSN diterima:", k);

    const { data: sekolah, error } = await supabase
      .from("user_profiles")
      .select("link_spreadsheet, asal_sekolah")
      .ilike("npsn", `%${k.trim()}%`)
      .maybeSingle();

    console.log("Hasil query:", sekolah, error);

    if (error) throw error;
    if (!sekolah) return res.status(404).json({ error: "Sekolah tidak ditemukan" });

    const sheetUrl = sekolah.link_spreadsheet;
    if (!sheetUrl) return res.status(400).json({ error: "Link spreadsheet tidak ditemukan" });

    const csvUrl = sheetUrl.replace("/pubhtml", "/pub?output=csv");

    const response = await fetch(csvUrl, { cache: "no-store" });
    if (!response.ok) throw new Error("Gagal fetch data dari Google Sheets");

    const csv = await response.text();
    const rows = csv.split("\n").map((r) => r.split(","));
    const token = rows?.[1]?.[4]?.trim();

    if (!token) return res.status(404).json({ error: "Token tidak ditemukan di sheet" });

    res.status(200).json({
      sekolah: sekolah.asal_sekolah,
      token,
    });
  } catch (err) {
    console.error("API Error:", err);
    res.status(500).json({ error: "Gagal ambil token dari server" });
  }
}

