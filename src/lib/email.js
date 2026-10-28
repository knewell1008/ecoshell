import {resolveSecret} from './supabase.js';

// Outgoing email through Resend (https://resend.com/docs/api-reference/emails/send-email).
// Needs the RESEND_API_KEY secret; EMAIL_FROM and ENQUIRY_EMAIL_TO are plain variables in wrangler.jsonc.
// Until the sending domain is verified in Resend, EMAIL_FROM must be onboarding@resend.dev and mail
// only reaches the address the Resend account was created with.

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]);

export async function sendEmail(env, {to, subject, html, text, replyTo}) {
  const key = await resolveSecret(env.RESEND_API_KEY);
  if (!key || !to) return {skipped: true};
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {authorization: `Bearer ${key}`, 'content-type': 'application/json'},
    body: JSON.stringify({
      from: env.EMAIL_FROM || 'Ecoshell website <onboarding@resend.dev>',
      to: String(to).split(',').map((s) => s.trim()).filter(Boolean),
      subject,
      html,
      text,
      ...(replyTo ? {reply_to: replyTo} : {})
    })
  });
  if (!res.ok) throw new Error(`Resend returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

// The team's notice of a new website inquiry. Replying goes straight to the person who asked.
export function enquiryEmail(enquiry, {reference, adminUrl}) {
  const name = [enquiry.first_name, enquiry.last_name].filter(Boolean).join(' ');
  const rows = [
    ['Name', name], ['Company', enquiry.company], ['Email', enquiry.email], ['Country', enquiry.country],
    ['Form', enquiry.application], ['Reference', reference]
  ].filter(([, v]) => v);
  const kind = String(enquiry.application || '').split(' | ')[0] || 'Website inquiry';
  return {
    subject: `${kind}: ${enquiry.company}${name ? ` (${name})` : ''}`,
    replyTo: enquiry.email,
    text: rows.map(([k, v]) => `${k}: ${v}`).join('\n') + `\n\n${enquiry.message}\n\nOpen in admin: ${adminUrl}`,
    html: `<div style="font-family:Arial,sans-serif;font-size:15px;color:#10201A">` +
      `<p style="margin:0 0 12px"><strong>New inquiry from the Ecoshell website</strong></p>` +
      `<table style="border-collapse:collapse">${rows.map(([k, v]) => `<tr><td style="padding:3px 16px 3px 0;color:#5E6D64">${esc(k)}</td><td style="padding:3px 0">${esc(v)}</td></tr>`).join('')}</table>` +
      `<p style="margin:16px 0 4px;color:#5E6D64">Message</p><p style="margin:0;white-space:pre-wrap">${esc(enquiry.message)}</p>` +
      `<p style="margin:20px 0 0"><a href="${esc(adminUrl)}">Open in admin</a> · Reply to this email to answer ${esc(name || enquiry.email)}.</p></div>`
  };
}
