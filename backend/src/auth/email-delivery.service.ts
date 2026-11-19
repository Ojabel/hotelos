import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

export interface InvitationMail {
  to: string;
  subject: string;
  text: string;
  html: string;
  createdAt: string;
}

export interface DeliveryResult {
  status: 'DELIVERED' | 'NOT_SENT' | 'FAILED';
  error?: 'local_capture_only' | 'provider_unavailable' | 'provider_delivery_failed';
}

export interface EmailDeliveryProvider {
  sendInvitation(to: string, token: string, expiresAt: Date): Promise<DeliveryResult>;
}

@Injectable()
export class EmailDeliveryService implements EmailDeliveryProvider {
  private readonly mode: string;
  private readonly from: string;
  private readonly baseUrl: string;
  private readonly outbox: InvitationMail[] = [];
  private readonly transport?: Transporter;

  constructor(config: ConfigService) {
    this.mode = config.get<string>('app.emailDeliveryMode') ?? 'disabled';
    this.from = config.get<string>('app.emailFrom') ?? 'HotelOS <no-reply@hotelos.local>';
    this.baseUrl = config.getOrThrow<string>('app.applicationBaseUrl').replace(/\/$/, '');
    if (this.mode === 'smtp') {
      this.transport = nodemailer.createTransport({
        host: config.getOrThrow<string>('app.smtpHost'),
        port: config.get<number>('app.smtpPort') ?? 587,
        secure: config.get<boolean>('app.smtpSecure') ?? false,
        auth: { user: config.getOrThrow<string>('app.smtpUser'), pass: config.getOrThrow<string>('app.smtpPassword') },
      });
    }
  }

  invitationLink(token: string) {
    return `${this.baseUrl}/accept-invitation?token=${encodeURIComponent(token)}`;
  }

  async sendInvitation(to: string, token: string, expiresAt: Date): Promise<DeliveryResult> {
    const url = this.invitationLink(token);
    const expiry = expiresAt.toISOString();
    const message: InvitationMail = {
      to,
      subject: 'Your HotelOS staff invitation',
      text: `You have been invited to join HotelOS. Accept your invitation before ${expiry}: ${url}\n\nIf you were not expecting this invitation, you can ignore this message. Set your password securely through Firebase after opening the invitation.`,
      html: `<p>You have been invited to join HotelOS.</p><p><a href="${url}">Review and accept your invitation</a></p><p>This invitation expires at ${expiry}. Set your password securely through Firebase after opening the invitation.</p><p>If you were not expecting this invitation, ignore this message.</p>`,
      createdAt: new Date().toISOString(),
    };
    if (this.mode === 'local') {
      this.outbox.unshift(message);
      this.outbox.splice(100);
      return { status: 'NOT_SENT', error: 'local_capture_only' };
    }
    if (!this.transport) return { status: 'NOT_SENT', error: 'provider_unavailable' };
    try {
      await this.transport.sendMail({ from: this.from, ...message });
      return { status: 'DELIVERED' };
    } catch {
      return { status: 'FAILED', error: 'provider_delivery_failed' };
    }
  }

  listLocalOutbox() {
    if (this.mode !== 'local') throw new ServiceUnavailableException('Local mail capture is not enabled.');
    return this.outbox;
  }
}
