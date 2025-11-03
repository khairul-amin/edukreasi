import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  "https://esmkveggutxzklavspnn.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
);

function hashNPSN(npsn) {
  return crypto.createHash("sha256").update(npsn).digest("hex").slice(0, 12);
}

export default async function handler(req, res) {
  try {
    const { k } = req.query;
    if (!k) return res.status(400).json({ error: "Parameter k tidak ditemukan" });

    const { data, error } = await supabase
      .from("user_profiles")
      .select("npsn, link_spreadsheet");

    if (error) throw error;

    const match = data.find(u => hashNPSN(u.npsn.trim()) === k);
    if (!match) return res.status(404).json({ error: "Sekolah tidak ditemukan" });

    const response = await fetch(match.link_spreadsheet, { cache: "no-store" });
    const csv = await response.text();
    const rows = csv.split("\n").map(r => r.split(","));
    const token = rows[1]?.[4] || "Tidak ada token";

    res.status(200).json({ token: token.trim() });
  } catch (err) {
    console.error("API Error:", err);
    res.status(500).json({ error: "Gagal ambil token" });
  }
}
