import { ConfigService } from '@nestjs/config';
import { EmailDeliveryService } from '../src/auth/email-delivery.service';

function configuration(mode: string) {
  return {
    get: (key: string) => key === 'app.emailDeliveryMode' ? mode : undefined,
    getOrThrow: (key: string) => {
      if (key === 'app.applicationBaseUrl') return 'https://hotel.example.test';
      throw new Error(`Unexpected configuration key: ${key}`);
    },
  } as ConfigService;
}

describe('EmailDeliveryService', () => {
  it('captures local invitation mail without reporting delivery', async () => {
    const service = new EmailDeliveryService(configuration('local'));

    const result = await service.sendInvitation('staff@example.test', 'secret-token', new Date('2026-11-20T12:00:00.000Z'));

    expect(result).toEqual({ status: 'NOT_SENT', error: 'local_capture_only' });
    expect(service.listLocalOutbox()).toHaveLength(1);
    expect(service.listLocalOutbox()[0].to).toBe('staff@example.test');
    expect(service.listLocalOutbox()[0].text).toContain('secret-token');
  });

  it('does not report delivery when no provider is configured', async () => {
    const service = new EmailDeliveryService(configuration('disabled'));

    await expect(service.sendInvitation('staff@example.test', 'secret-token', new Date()))
      .resolves.toEqual({ status: 'NOT_SENT', error: 'provider_unavailable' });
  });
});
