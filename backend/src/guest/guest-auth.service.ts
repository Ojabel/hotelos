import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import type { AuthenticatedIdentity, AuthorizationContext } from '../auth/auth.types';

@Injectable()
export class GuestAuthService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  private organizationId() {
    const id = this.config.get<string>('app.tenantOrganizationId');
    if (!id) throw new ForbiddenException('Guest access is not configured.');
    return id;
  }

  private async assertGuestIdentity(identity: AuthenticatedIdentity) {
    const org = this.organizationId();
    if (this.config.get<string>('app.authMode') !== 'firebase') throw new ForbiddenException('Guest portal access requires Firebase Authentication.');
    if (!identity.emailVerified || !identity.email || !['password', 'google.com'].includes(identity.authenticationProvider ?? '')) {
      throw new ForbiddenException('A verified Firebase guest account is required.');
    }
    const membership = await this.prisma.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId: org, userId: identity.identityId } }, select: { id: true } });
    if (membership) throw new ForbiddenException('Staff identities cannot be used for guest portal access.');
    const existing = await this.prisma.guestIdentityLink.findFirst({ where: { organizationId: org, identityId: identity.identityId }, include: { guest: true, hotel: { select: { id: true, name: true, code: true } } } });
    return existing;
  }

  async assertGuestRequest(identity: AuthenticatedIdentity) {
    if (!(await this.assertGuestIdentity(identity))) throw new NotFoundException('Guest profile is not linked. Complete guest account setup first.');
  }

  async resolve(identity: AuthenticatedIdentity, fullName: string, correlationId: string) {
    const org = this.organizationId();
    if (this.config.get<string>('app.authMode') !== 'firebase') throw new ForbiddenException('Guest account setup requires Firebase Authentication.');
    if (!identity.emailVerified || !identity.email || !['password', 'google.com'].includes(identity.authenticationProvider ?? '')) {
      throw new ForbiddenException('Verify your email address before accessing guest services.');
    }
    if (await this.prisma.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId: org, userId: identity.identityId } }, select: { id: true } })) {
      throw new ForbiddenException('Staff identities cannot be used for guest registration.');
    }
    const existingLink = await this.prisma.guestIdentityLink.findFirst({ where: { organizationId: org, identityId: identity.identityId } });
    if (existingLink) return this.me(identity);
    const matches = await this.prisma.hotelGuest.findMany({ where: { organizationId: org, email: { equals: identity.email, mode: 'insensitive' } }, select: { id: true }, take: 2 });
    if (matches.length) {
      await this.prisma.auditEvent.create({ data: { organizationId: org, actorUserId: identity.identityId, correlationId, action: 'guest.identity.link_required', resource: 'guest-identity-link', outcome: 'DENIED', metadata: { candidateCount: matches.length > 1 ? 'multiple' : 'one' } } });
      throw new ConflictException('An existing guest record needs staff-assisted identity verification before it can be linked. No guest data was changed.');
    }
    const hotels = await this.prisma.hotel.findMany({ where: { organizationId: org, status: 'ACTIVE' }, select: { id: true, name: true, code: true }, orderBy: { name: 'asc' }, take: 2 });
    const selectedHotel = hotels.length === 1 ? hotels[0] : undefined;
    if (!selectedHotel) throw new ConflictException('Guest profile setup must be completed through a hotel stay or with hotel support.');
    const safeName = fullName.trim();
    if (safeName.length < 2 || safeName.length > 200) throw new BadRequestException('A valid guest name is required.');
    try {
      await this.prisma.$transaction(async (tx) => {
        const guest = await tx.hotelGuest.create({ data: { organizationId: org, hotelId: selectedHotel.id, fullName: safeName, email: identity.email } });
        await tx.guestIdentityLink.create({ data: { organizationId: org, hotelId: selectedHotel.id, guestId: guest.id, identityId: identity.identityId, linkMethod: 'SELF_REGISTERED' } });
        await tx.auditEvent.create({ data: { organizationId: org, hotelId: selectedHotel.id, actorUserId: identity.identityId, correlationId: 'guest-auth', action: 'guest.identity.created', resource: 'guest-identity-link', resourceId: guest.id, metadata: { method: identity.authenticationProvider } } });
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') throw new ConflictException('This account or guest profile is already linked. Contact hotel support if you need help.');
      throw error;
    }
    return this.me(identity);
  }

  async me(identity: AuthenticatedIdentity) {
    const link = await this.assertGuestIdentity(identity);
    if (!link) throw new NotFoundException('Guest profile is not linked. Complete guest account setup first.');
    return { id: link.guest.id, fullName: link.guest.fullName, email: link.guest.email, phone: link.guest.phone, preferences: link.guest.preferences, hotel: link.hotel };
  }

  async reservations(identity: AuthenticatedIdentity) {
    const links = await this.links(identity);
    return this.prisma.hotelReservation.findMany({ where: { OR: links.map(({ organizationId, hotelId, guestId }) => ({ organizationId, hotelId, guestId })) }, select: { id: true, hotelId: true, guestId: true, reference: true, status: true, checkIn: true, checkOut: true, adults: true, children: true, room: { select: { number: true } }, category: { select: { name: true } } }, orderBy: { checkIn: 'desc' } });
  }

  async reservation(identity: AuthenticatedIdentity, reservationId: string) {
    const links = await this.links(identity);
    const reservation = await this.prisma.hotelReservation.findFirst({ where: { id: reservationId, OR: links.map(({ organizationId, hotelId, guestId }) => ({ organizationId, hotelId, guestId })) }, select: { id: true, hotelId: true, reference: true, status: true, checkIn: true, checkOut: true, adults: true, children: true, room: { select: { number: true } }, category: { select: { name: true } } } });
    if (!reservation) throw new NotFoundException('Reservation not found.');
    return reservation;
  }

  async cancel(identity: AuthenticatedIdentity, reservationId: string) {
    const links = await this.links(identity);
    const existing = await this.prisma.hotelReservation.findFirst({ where: { id: reservationId, OR: links.map(({ organizationId, hotelId, guestId }) => ({ organizationId, hotelId, guestId })) }, select: { id: true, status: true, checkIn: true, organizationId: true, hotelId: true, guestId: true } });
    if (!existing) throw new NotFoundException('Reservation not found.');
    if (existing.status !== 'PENDING' && existing.status !== 'CONFIRMED') throw new ConflictException('This reservation can no longer be cancelled online.');
    if (existing.checkIn <= new Date(new Date().toISOString().slice(0, 10))) throw new ConflictException('Reservations starting today or earlier must be changed by the hotel.');
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.hotelReservation.updateMany({ where: { id: existing.id, organizationId: existing.organizationId, hotelId: existing.hotelId, guestId: existing.guestId, status: existing.status }, data: { status: 'CANCELLED' } });
      if (updated.count !== 1) throw new ConflictException('This reservation changed and must be refreshed before cancellation.');
      await tx.auditEvent.create({ data: { organizationId: existing.organizationId, hotelId: existing.hotelId, actorUserId: identity.identityId, correlationId: 'guest-reservation-cancel', action: 'guest.reservation.cancelled', resource: 'reservation', resourceId: existing.id } });
      return { id: existing.id, status: 'CANCELLED' as const };
    });
  }

  async updateProfile(identity: AuthenticatedIdentity, input: { fullName?: string; phone?: string; preferences?: string[] }) {
    const links = await this.links(identity);
    const link = links[0];
    const data = { ...(input.fullName ? { fullName: input.fullName.trim() } : {}), ...(input.phone !== undefined ? { phone: input.phone.trim() || null } : {}), ...(input.preferences ? { preferences: input.preferences } : {}) };
    if (!Object.keys(data).length) throw new BadRequestException('No permitted profile fields were provided.');
    return this.prisma.hotelGuest.update({ where: { id: link.guestId }, data, select: { id: true, fullName: true, email: true, phone: true, preferences: true } });
  }

  async serviceRequests(identity: AuthenticatedIdentity) {
    const links = await this.links(identity);
    return this.prisma.guestServiceRequest.findMany({ where: { OR: links.map(({ organizationId, hotelId, guestId }) => ({ organizationId, hotelId, guestId })) }, orderBy: { createdAt: 'desc' } });
  }

  async createServiceRequest(identity: AuthenticatedIdentity, input: { hotelId?: string; category: string; description: string }) {
    const links = await this.links(identity);
    const link = input.hotelId ? links.find((item) => item.hotelId === input.hotelId) : links[0];
    if (!link) throw new ForbiddenException('Guest profile is not linked to the selected hotel.');
    return this.prisma.guestServiceRequest.create({ data: { organizationId: link.organizationId, hotelId: link.hotelId, guestId: link.guestId, category: input.category, description: input.description } });
  }

  async linkByStaff(context: AuthorizationContext, actor: AuthenticatedIdentity, input: { hotelId: string; guestId: string; identityId: string; verificationMethod: 'IN_PERSON_ID' | 'RESERVATION_VERIFICATION' | 'MANAGER_REVIEW'; verificationCaseReference: string }, correlationId: string) {
    const target = await this.prisma.userIdentity.findFirst({ where: { id: input.identityId, emailVerified: true }, select: { id: true, email: true, memberships: { where: { organizationId: context.organization.id }, select: { id: true } } } });
    if (!target?.email || target.memberships.length) throw new BadRequestException('The identity must have a verified email and no staff membership.');
    const guest = await this.prisma.hotelGuest.findFirst({ where: { id: input.guestId, organizationId: context.organization.id, hotelId: input.hotelId }, select: { id: true, email: true } });
    if (!guest) throw new NotFoundException('Guest profile not found.');
    if (!guest.email || guest.email.toLowerCase() !== target.email.toLowerCase()) throw new BadRequestException('The verified identity email must match the guest record. Staff must separately verify the person before linking.');
    const matchingGuests = await this.prisma.hotelGuest.count({ where: { organizationId: context.organization.id, hotelId: input.hotelId, email: { equals: target.email, mode: 'insensitive' } } });
    if (matchingGuests !== 1) {
      await this.prisma.auditEvent.create({ data: { organizationId: context.organization.id, hotelId: input.hotelId, actorUserId: actor.identityId, correlationId, action: 'guest.identity.staff_link_denied', resource: 'guest-identity-link', outcome: 'DENIED', metadata: { reason: 'ambiguous_email_match', matchingGuestCount: matchingGuests } } });
      throw new ConflictException('Multiple guest records match this email. An administrator must resolve the duplicate records before linking.');
    }
    const conflict = await this.prisma.guestIdentityLink.findFirst({ where: { hotelId: input.hotelId, OR: [{ guestId: input.guestId }, { identityId: input.identityId }] }, select: { id: true } });
    if (conflict) {
      await this.prisma.auditEvent.create({ data: { organizationId: context.organization.id, hotelId: input.hotelId, actorUserId: actor.identityId, correlationId, action: 'guest.identity.staff_link_denied', resource: 'guest-identity-link', outcome: 'DENIED', metadata: { reason: 'identity_or_profile_already_linked' } } });
      throw new ConflictException('This guest profile or Firebase identity is already linked. No records were changed.');
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const link = await tx.guestIdentityLink.create({ data: { organizationId: context.organization.id, hotelId: input.hotelId, guestId: input.guestId, identityId: input.identityId, linkedById: actor.identityId, linkMethod: 'STAFF_VERIFIED' } });
        await tx.auditEvent.create({ data: { organizationId: context.organization.id, hotelId: input.hotelId, actorUserId: actor.identityId, correlationId, action: 'guest.identity.staff_linked', resource: 'guest-identity-link', resourceId: link.id, metadata: { guestId: input.guestId, identityId: input.identityId, verificationMethod: input.verificationMethod, verificationCaseReference: input.verificationCaseReference } } });
        return link;
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') throw new ConflictException('This guest profile or Firebase identity is already linked. No records were changed.');
      throw error;
    }
  }

  private async links(identity: AuthenticatedIdentity) {
    await this.assertGuestIdentity(identity);
    const links = await this.prisma.guestIdentityLink.findMany({ where: { organizationId: this.organizationId(), identityId: identity.identityId }, select: { organizationId: true, hotelId: true, guestId: true } });
    if (!links.length) throw new NotFoundException('Guest profile is not linked. Complete guest account setup first.');
    return links;
  }
}
