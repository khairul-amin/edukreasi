import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// 🔹 Konfigurasi Supabase
const supabase = createClient(
  "https://esmkveggutxzklavspnn.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzbWt2ZWdndXR4emtsYXZzcG5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzODIyNTQsImV4cCI6MjA3NTk1ODI1NH0.18vlPWg1S_6ocoCWKaCh_KU41TbipXyQNS2r5GKRQ44"
);

export default async function handler(req, res) {
  try {
    const { h } = req.query;
    if (!h) return res.status(400).json({ error: "Parameter h (hash) wajib diisi" });

    console.log("[info] Hash diterima:", h);

    // 🔹 Ambil semua NPSN dari database
    const { data: daftar, error } = await supabase
      .from("user_profiles")
      .select("npsn, asal_sekolah, link_spreadsheet");

    if (error) throw error;

    // 🔹 Cari data yang hash-nya cocok
    const sekolah = daftar.find((item) => {
      const hashed = crypto.createHash("sha256").update(item.npsn.trim()).digest("hex").slice(0, 12);
      return hashed === h.trim();
    });

    console.log("[info] Sekolah ditemukan:", sekolah?.asal_sekolah);

    if (!sekolah) return res.status(404).json({ error: "Sekolah tidak ditemukan" });
    if (!sekolah.link_spreadsheet) return res.status(400).json({ error: "Link spreadsheet tidak ditemukan" });

    // 🔹 Ambil token dari Google Sheets
    const csvUrl = sekolah.link_spreadsheet.replace("/pubhtml", "/pub?output=csv");
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
