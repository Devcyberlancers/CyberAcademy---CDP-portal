import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly transporter: Transporter | null;

  constructor(private readonly config: ConfigService) {
    const smtp = this.config.get<Record<string, unknown>>('smtp') ?? {};
    this.transporter =
      smtp.host && smtp.user && smtp.password
        ? nodemailer.createTransport({
            host: String(smtp.host),
            port: Number(smtp.port ?? 587),
            secure: Number(smtp.port) === 465,
            requireTLS: Boolean(smtp.tls),
            auth: { user: String(smtp.user), pass: String(smtp.password).replace(/ /g, '') },
          })
        : null;
  }

  private sender() {
    const smtp = this.config.get<Record<string, unknown>>('smtp') ?? {};
    return {
      name: String(smtp.fromName ?? 'Cyber Academy'),
      address: 'info@cyberlancers.in',
    };
  }


  private template(title: string, content: string) {
    return `<!doctype html><html><body style="margin:0;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;color:#07142f"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border-radius:18px;border:1px solid #e3e8f2;overflow:hidden"><tr><td style="background:#102a8b;color:#fff;padding:24px 28px"><h1 style="margin:0;font-size:24px">${title}</h1></td></tr><tr><td style="padding:28px;font-size:15px;line-height:24px">${content}</td></tr><tr><td style="padding:18px 28px;background:#f8fafc;color:#64748b;font-size:12px">This email was sent by Cyber Academy.</td></tr></table></td></tr></table></body></html>`;
  }

  private escape(value: string) {
    return value.replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[character] ?? character);
  }

  async send(to: string, subject: string, text: string, htmlContent: string) {
    if (!this.transporter) throw new ServiceUnavailableException('SMTP is not configured.');
    try {
      await this.transporter.sendMail({
        from: this.sender(),
        to: to.trim().toLowerCase(),
        subject,
        text,
        html: this.template(subject, htmlContent),
      });
    } catch (error) {
      throw new ServiceUnavailableException(`Email could not be sent: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  sendVerification(to: string, otp: string) {
    return this.send(
      to,
      'Verify your Cyber Academy email',
      `Your Cyber Academy verification code is ${otp}. It expires in 10 minutes.`,
      `<p>Your verification code is:</p><p style="font-size:30px;font-weight:700;letter-spacing:8px">${otp}</p><p>It expires in 10 minutes.</p>`,
    );
  }

  sendWelcome(to: string, name: string) {
    const safeName = this.escape(name);
    return this.send(
      to,
      'Cyber Academy registration received',
      `Hello ${name}, your registration was received and is awaiting Admin approval.`,
      `<p>Hello <strong>${safeName}</strong>,</p><p>Your registration was received and is awaiting Admin approval and portal credentials.</p>`,
    );
  }

  sendPasswordReset(to: string, resetLink: string) {
    const safeLink = /^https?:\/\//i.test(resetLink) ? this.escape(resetLink) : '#';
    return this.send(
      to,
      'Change your Cyber Academy password',
      `Change your password using this secure link: ${resetLink}`,
      `<p>Use the following secure link to change your password:</p><p><a href="${safeLink}">Change Password</a></p><p>This link expires in 15 minutes and can be used only once.</p>`,
    );
  }

  sendStudentCredentials(to: string, name: string, portalLink: string, username: string, password: string) {
    const safeName = this.escape(name);
    const safeUsername = this.escape(username);
    const safePassword = this.escape(password);
    const safeLink = /^https?:\/\//i.test(portalLink) ? this.escape(portalLink) : '#';
    return this.send(
      to,
      'Your Cyber Academy portal login',
      `Hello ${name}, portal: ${portalLink}, username: ${username}, temporary password: ${password}`,
      `<p>Hello <strong>${safeName}</strong>,</p><p>Your Cyber Academy account is ready.</p>
       <p><strong>Username:</strong> ${safeUsername}<br><strong>Temporary password:</strong> ${safePassword}</p>
       <p><a href="${safeLink}">Open Student Portal</a></p><p>Please change your password after signing in.</p>`,
    );
  }

  sendStudentMessage(to: string, name: string, message: string) {
    const safeName = this.escape(name);
    const safeMessage = this.escape(message);
    return this.send(
      to,
      'Message from Cyber Academy',
      `Hello ${name}, ${message}`,
      `<p>Hello <strong>${safeName}</strong>,</p><p>${safeMessage.replace(/\n/g, '<br>')}</p>`,
    );
  }
}
