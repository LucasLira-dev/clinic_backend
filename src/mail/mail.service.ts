import { Injectable, Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';

if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  throw new Error(
    'EMAIL_USER and EMAIL_PASS must be set in environment variables',
  );
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly fromAddress: string = process.env.EMAIL_USER!;

  constructor() {}

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  async sendEmail(to: string, subject: string, text: string) {
    try {
      const html = `
        <div style="font-family: Arial, sans-serif; background: #f7f7f7; padding: 32px;">
          <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); padding: 32px;">
            <h2 style="color: #2d7ff9; margin-bottom: 16px;">ClinicFlow</h2>
            <div style="color: #222; font-size: 16px; line-height: 1.6;">
               ${this.escapeHtml(text).replace(/\n/g, '<br>')}
            </div>
            <hr style="margin: 32px 0; border: none; border-top: 1px solid #eee;">
            <div style="font-size: 13px; color: #888;">Esta é uma mensagem automática. Por favor, não responda este e-mail.</div>
          </div>
        </div>
      `;
      await this.transporter.sendMail({
        from: `"ClinicFlow" <${this.fromAddress}>`,
        to,
        subject,
        text,
        html,
      });
    } catch (error) {
      this.logger.error('Error sending email', error);
      throw new Error('Failed to send email');
    }
  }
}
