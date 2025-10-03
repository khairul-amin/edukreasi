// file: api/token.js
import fetch from "node-fetch";

export default async function handler(req, res) {
  try {
    const url =
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vR6xi5S1zBVBkgL1XyS2v0khJtLr3xMMFmoIHwkFH2lDvxBlNcvfdeQbHcFI-zJgEVREhMB2rN1bwkJ/pub?gid=0&single=true&output=csv";

    const response = await fetch(url, { cache: "no-store" });
    const csv = await response.text();

    const rows = csv.split("\n").map((r) => r.split(","));
    const token = rows[1][4] || "Tidak ada token"; // ambil Sheet1!E2

    res.status(200).json({ token: token.trim() });
  } catch (err) {
    res.status(500).json({ error: "Gagal ambil token" });
  }
}
