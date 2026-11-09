// @ts-nocheck
import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6";
import QRCode from "npm:qrcode@1";
import { jsPDF } from "npm:jspdf@2";
import { Buffer } from "node:buffer";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const FACILITY = "Barangay Salvador Health Center";
const ADDRESS = "Barangay Salvador, Santiago City, Isabela";

async function buildPdf(req: any, items: any[]) {
  const ref = String(req.id).slice(0, 8).toUpperCase();
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal"); doc.setFontSize(11);
  doc.text("Republic of the Philippines", w / 2, 40, { align: "center" });
  doc.text("Department of Health", w / 2, 54, { align: "center" });
  doc.setFont("helvetica", "bold"); doc.setFontSize(15);
  doc.text(FACILITY.toUpperCase(), w / 2, 72, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(11);
  doc.text(ADDRESS, w / 2, 87, { align: "center" });
  doc.setLineWidth(2); doc.line(40, 104, w - 40, 104);

  doc.setFont("helvetica", "bold"); doc.setFontSize(17);
  doc.text("MEDICINE REQUEST SLIP", w / 2, 136, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(11);
  doc.text("Present this slip at the health center.", w / 2, 154, { align: "center" });

  let y = 186;
  const row = (k: string, v: string) => {
    doc.setFont("helvetica", "bold"); doc.text(k, 40, y);
    doc.setFont("helvetica", "normal"); doc.text(String(v || "—"), 150, y);
    y += 20;
  };
  row("Reference no.", ref);
  row("Resident", req.requester_name);
  row("Purok", req.requester_purok);
  row("Requested on", new Date(req.created_at).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", year: "numeric", month: "long", day: "numeric" }));
  if (req.note) row("Note", req.note);
  row("Replied on", new Date(req.notified_at ?? Date.now()).toLocaleString("en-PH", { timeZone: "Asia/Manila" }));

  y += 10;
  doc.setFillColor(225, 225, 225); doc.rect(40, y, w - 80, 24, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text("Medicine", 48, y + 16); doc.text("Status", w - 200, y + 16);
  y += 24;
  doc.setLineWidth(0.5);
  for (const it of items) {
    doc.setFont("helvetica", "normal");
    doc.text(String(it.name), 48, y + 17);
    doc.setFont("helvetica", "bold");
    doc.text(it.result === "available" ? "AVAILABLE" : "NOT AVAILABLE", w - 200, y + 17);
    doc.line(40, y + 26, w - 40, y + 26);
    y += 26;
  }

  const qr = await QRCode.toDataURL(`CareConnect medicine request ${ref}`, { margin: 1, width: 160 });
  doc.addImage(qr, "PNG", w - 40 - 90, y + 24, 90, 90);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text("Only medicines marked AVAILABLE can be claimed.", 40, y + 44);
  doc.text("Bring a valid ID. Quantity is given by the midwife.", 40, y + 58);
  const h = doc.internal.pageSize.getHeight();
  doc.text(`Generated ${new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" })} via CareConnect`, 40, h - 24);

  const b64 = Buffer.from(doc.output("arraybuffer")).toString("base64");
  const safe = String(req.requester_name || "resident").replace(/[^A-Za-z0-9]+/g, "_");
  return { ref, b64, filename: `medicine_request_${safe}_${ref}.pdf` };
}

Deno.serve(async (r) => {
  if (r.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: r.headers.get("Authorization") ?? "" } } });
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: u } = await asUser.auth.getUser();
    if (!u?.user) return json({ error: "Please log in again." }, 401);

    const { request_id, results, download } = await r.json();
    const { data: req, error: e1 } = await admin.from("medicine_requests").select("*").eq("id", request_id).single();
    if (e1 || !req) return json({ error: "Request not found." }, 404);

    if (download) {
      if (req.profile_id !== u.user.id) {
        const { data: isStaff } = await asUser.rpc("is_staff");
        if (!isStaff) return json({ error: "Not allowed." }, 403);
      }
      if (!["notified", "unavailable"].includes(req.status)) return json({ error: "There is no reply yet for this request." }, 400);
      const p = await buildPdf(req, req.items ?? []);
      return json({ ok: true, reference: p.ref, filename: p.filename, pdf_base64: p.b64 });
    }

    const { data: staff } = await asUser.rpc("is_staff");
    if (!staff) return json({ error: "Only staff can answer requests." }, 403);
    if (!Array.isArray(results) || results.length === 0 || results.some((x: any) => !["available", "unavailable"].includes(x.result))) {
      return json({ error: "Choose Available or Not available for every medicine." }, 400);
    }
    const available = results.filter((x: any) => x.result === "available").length;
    const unavailable = results.length - available;
    const notifiedAt = new Date().toISOString();
    const status = available > 0 ? "notified" : "unavailable";

    const { data: prof } = await admin.from("profiles").select("email").eq("id", req.profile_id).single();
    const to = prof?.email;
    if (!to) return json({ error: "The resident has no email address." }, 400);

    const slip = await buildPdf({ ...req, notified_at: notifiedAt }, results);

    const user = Deno.env.get("GMAIL_USER"), pass = Deno.env.get("GMAIL_APP_PASSWORD");
    if (!user || !pass) return json({ error: "Gmail is not set up (GMAIL_USER / GMAIL_APP_PASSWORD)." }, 500);
    const tx = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass } });
    const lines = results.map((x: any) => `<li><b>${x.name}</b> — ${x.result === "available" ? '<span style="color:#198754">AVAILABLE</span>' : '<span style="color:#dc3545">NOT AVAILABLE</span>'}</li>`).join("");
    await tx.sendMail({
      from: `"${FACILITY}" <${user}>`, to,
      subject: `Medicine request reply — ${FACILITY}`,
      html: `<p>Hello ${req.requester_name},</p>
<p>Here is the reply to your medicine request:</p><ul>${lines}</ul>
<p>${available > 0 ? "Your request slip is attached to this email. <b>Download it and show it at the health center</b> to claim the available medicine." : "The medicine you requested is not available right now. A copy of the reply is attached."}</p>
<p>Reference no.: <b>${slip.ref}</b></p><p>— ${FACILITY}</p>`,
      attachments: [{ filename: slip.filename, content: Buffer.from(slip.b64, "base64"), contentType: "application/pdf" }],
    });

    const { error: e2 } = await admin.from("medicine_requests")
      .update({ items: results, status, notified_at: notifiedAt }).eq("id", request_id);
    if (e2) return json({ error: e2.message }, 500);

    return json({ ok: true, available, unavailable, sent_to: to, reference: slip.ref, filename: slip.filename, pdf_base64: slip.b64 });
  } catch (e) {
    return json({ error: String(e?.message ?? e) }, 500);
  }
});