/**
 * The emails sign-in sends: confirming an address, resetting a password,
 * approving an email change. They go out through Cloudflare Email Service
 * (the EMAIL binding, from EMAIL_FROM, an address on the onboarded domain). With
 * EMAIL_MODE=outbox (local development and tests) they are kept in memory
 * instead, where the tests read the links back.
 */
import type { Env } from '../types.ts';

export type Email = { to: string; subject: string; text: string; html: string; link: string };

/** Emails kept by EMAIL_MODE=outbox, newest last. */
export const outbox: Email[] = [];

const escape = (text: string) => text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function message(to: string, subject: string, intro: string, action: string, link: string, outro: string): Email {
  const text = `${intro}\n\n${action}:\n${link}\n\n${outro}\n\nCoptic Vine`;
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f3ee;font-family:Georgia,'Times New Roman',serif;color:#2b2622">
<div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px">
<p style="margin:0 0 18px;font-size:20px;color:#2e5e3a">Coptic Vine</p>
<p style="margin:0 0 22px;font-size:16px;line-height:1.5">${escape(intro)}</p>
<p style="margin:0 0 22px"><a href="${escape(link)}" style="display:inline-block;background:#2e5e3a;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:16px">${escape(action)}</a></p>
<p style="margin:0;font-size:13px;line-height:1.5;color:#6b625b">${escape(outro)}<br><br>If the button doesn't work, open this link:<br><span style="word-break:break-all">${escape(link)}</span></p>
</div></body></html>`;
  return { to, subject, text, html, link };
}

export const emails = {
  confirmAddress: (to: string, link: string) => message(to, 'Confirm your email for Coptic Vine',
    'Welcome to Coptic Vine. Confirm this email address to finish setting up your account.', 'Confirm email', link,
    "If you didn't create a Coptic Vine account, you can ignore this email."),
  resetPassword: (to: string, link: string) => message(to, 'Reset your Coptic Vine password',
    'Someone asked to reset the password of your Coptic Vine account. The link works for one hour.', 'Choose a new password', link,
    "If it wasn't you, ignore this email: your password stays as it is."),
  approveEmailChange: (to: string, newEmail: string, link: string) => message(to, 'Approve your new email for Coptic Vine',
    `Your Coptic Vine account asked to change its email from this address to ${newEmail}. Approve it to continue.`, 'Approve the change', link,
    "If you didn't ask for this, ignore this email and your email stays the same."),
};

export async function sendEmail(env: Env, email: Email): Promise<void> {
  if (env.EMAIL_MODE === 'outbox') {
    outbox.push(email);
    return;
  }
  if (!env.EMAIL) throw new Error('No EMAIL binding: set EMAIL_MODE=outbox for local runs');
  await env.EMAIL.send({ from: { email: env.EMAIL_FROM, name: 'Coptic Vine' }, to: email.to, subject: email.subject, text: email.text, html: email.html });
}
