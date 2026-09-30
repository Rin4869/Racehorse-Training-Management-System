import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

const DEFAULT_FROM = 'Racehorse Club <onboarding@resend.dev>';

/**
 * Sends transactional email via the Resend HTTP API (not raw SMTP — some
 * PaaS free tiers, e.g. Render, block/timeout outbound SMTP connections
 * even with correct credentials; HTTPS on 443 is never blocked). When
 * RESEND_API_KEY is absent (e.g. local dev / CI) it logs the message
 * instead of sending, so flows stay testable.
 */
@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger('Mail');
  private resend: Resend | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      this.logger.warn('RESEND_API_KEY not set — emails will be logged only');
      return;
    }
    this.resend = new Resend(apiKey);
  }

  private webUrl(path: string): string {
    const base =
      this.config.get<string>('APP_WEB_URL') ?? 'http://localhost:5173';
    return `${base.replace(/\/$/, '')}${path}`;
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.resend) {
      this.logger.log(
        `[email:not-sent] to=${to} subject="${subject}"\n${html}`,
      );
      return;
    }
    const from = this.config.get<string>('MAIL_FROM') ?? DEFAULT_FROM;
    const { error } = await this.resend.emails.send({
      from,
      to,
      subject,
      html,
    });
    if (error) {
      throw new Error(`Resend send failed: ${error.message}`);
    }
    this.logger.log(`Sent "${subject}" to ${to}`);
  }

  async sendVerifyOtp(to: string, name: string, code: string): Promise<void> {
    await this.send(
      to,
      'Verify your Racehorse Club account',
      `<p>Hi ${name},</p>
       <p>Enter this code on the website to confirm your email:</p>
       <p style="font-size:28px;font-weight:bold;letter-spacing:4px">${code}</p>
       <p>This code expires in 10 minutes. After verification a manager will approve your account.</p>`,
    );
  }

  async sendResetPassword(
    to: string,
    name: string,
    token: string,
  ): Promise<void> {
    const link = this.webUrl(`/reset-password?token=${token}`);
    await this.send(
      to,
      'Reset your Racehorse Club password',
      `<p>Hi ${name},</p>
       <p>Use this link to set a new password:</p>
       <p><a href="${link}">${link}</a></p>
       <p>This link expires in 1 hour. Ignore this email if you did not request it.</p>`,
    );
  }
}
