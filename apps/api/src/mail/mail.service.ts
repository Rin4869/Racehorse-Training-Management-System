import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/**
 * Sends transactional email via SMTP (Gmail + App Password in this project).
 * When SMTP credentials are absent (e.g. local dev / CI) it logs the message
 * and the action link instead of sending, so flows stay testable.
 */
@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger('Mail');
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    if (!user || !pass) {
      this.logger.warn(
        'SMTP_USER/SMTP_PASS not set — emails will be logged only',
      );
      return;
    }
    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST'),
      port: this.config.get<number>('SMTP_PORT'),
      secure: this.config.get<number>('SMTP_PORT') === 465,
      auth: { user, pass },
    });
  }

  private webUrl(path: string): string {
    const base =
      this.config.get<string>('APP_WEB_URL') ?? 'http://localhost:5173';
    return `${base.replace(/\/$/, '')}${path}`;
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.transporter) {
      this.logger.log(
        `[email:not-sent] to=${to} subject="${subject}"\n${html}`,
      );
      return;
    }
    const from =
      this.config.get<string>('MAIL_FROM') ??
      this.config.get<string>('SMTP_USER');
    await this.transporter.sendMail({ from, to, subject, html });
    this.logger.log(`Sent "${subject}" to ${to}`);
  }

  async sendVerifyEmail(
    to: string,
    name: string,
    token: string,
  ): Promise<void> {
    const link = this.webUrl(`/verify-email?token=${token}`);
    await this.send(
      to,
      'Verify your Racehorse Club account',
      `<p>Hi ${name},</p>
       <p>Confirm your email to finish registration:</p>
       <p><a href="${link}">${link}</a></p>
       <p>This link expires in 24 hours. After verification a manager will approve your account.</p>`,
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
