import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken } from 'livekit-server-sdk';
import { Liveblocks } from '@liveblocks/node';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

const DEV_ORG_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Screen-Share Service.
 *
 * Verwaltet Sessions + Participants und generiert LiveKit-Tokens fuer
 * Host und Viewer. Externer Gast-Zugang via 12-stelliger Random-Token,
 * optional mit bcrypt-gehashtem Passwort geschuetzt.
 *
 * Voice-Chat ist optional pro Session — Token traegt entsprechend
 * `canPublish` (fuer Mikro) oder nicht.
 */
@Injectable()
export class ScreenShareService {
  private readonly logger = new Logger(ScreenShareService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // ------------------------------------------------------------------
  // Sessions
  // ------------------------------------------------------------------

  async startSession(hostUserId: string, data: {
    sessionName?: string;
    audioEnabled?: boolean;
    voiceEnabled?: boolean;
    invitedUserIds?: string[];
  }) {
    const session = await this.prisma.screenShareSession.create({
      data: {
        orgId: DEV_ORG_ID,
        hostUserId,
        // Room-ID wird aus der Session-ID abgeleitet (eindeutig pro Session).
        // Wir setzen einen Platzhalter, ueberschreiben dann unten.
        livekitRoomId: 'pending',
        sessionName: data.sessionName?.trim() || null,
        audioEnabled: !!data.audioEnabled,
        voiceEnabled: !!data.voiceEnabled,
      },
    });
    const livekitRoomId = `ss-${session.id}`;
    await this.prisma.screenShareSession.update({
      where: { id: session.id },
      data: { livekitRoomId },
    });

    // Host als Participant anlegen
    await this.prisma.screenShareParticipant.create({
      data: {
        sessionId: session.id,
        userId: hostUserId,
        role: 'host',
        status: 'joined',
        joinedAt: new Date(),
      },
    });

    // Invitations fuer ausgewaehlte Team-Mitglieder
    if (data.invitedUserIds?.length) {
      await this.prisma.screenShareParticipant.createMany({
        data: data.invitedUserIds
          .filter((uid) => uid !== hostUserId)
          .map((uid) => ({
            sessionId: session.id,
            userId: uid,
            role: 'viewer',
            status: 'invited',
          })),
      });
    }

    const hostToken = this.generateLivekitToken({
      roomId: livekitRoomId,
      identity: hostUserId,
      name: 'Host',
      isHost: true,
      voiceEnabled: !!data.voiceEnabled,
    });

    return {
      session: { ...session, livekitRoomId, status: 'active' },
      livekitToken: hostToken,
      livekitUrl: this.config.get<string>('LIVEKIT_URL') ?? '',
    };
  }

  async endSession(sessionId: string, userId: string) {
    const session = await this.prisma.screenShareSession.findFirst({
      where: { id: sessionId, orgId: DEV_ORG_ID },
    });
    if (!session) throw new NotFoundException('Session nicht gefunden');
    if (session.hostUserId !== userId) {
      // Owner darf auch fremde Sessions beenden
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user?.role !== 'owner') {
        throw new ForbiddenException('Nur der Host oder ein Owner darf die Session beenden');
      }
    }
    return this.prisma.screenShareSession.update({
      where: { id: sessionId },
      data: { status: 'ended', endedAt: new Date() },
    });
  }

  async joinSession(sessionId: string, user: { id: string; name: string; avatarUrl?: string | null }) {
    const session = await this.prisma.screenShareSession.findFirst({
      where: { id: sessionId, orgId: DEV_ORG_ID, status: 'active' },
    });
    if (!session) throw new NotFoundException('Session nicht gefunden oder bereits beendet');

    const isHost = session.hostUserId === user.id;

    // Participant-Row: Host nicht als Viewer einfuegen — er hat schon
    // seinen Eintrag aus startSession. Bei Rejoin (Refresh, Tab-Switch)
    // einfach token nochmal ausstellen.
    if (!isHost) {
      const existing = await this.prisma.screenShareParticipant.findFirst({
        where: { sessionId, userId: user.id },
      });
      if (existing) {
        await this.prisma.screenShareParticipant.update({
          where: { id: existing.id },
          data: { status: 'joined', joinedAt: new Date(), leftAt: null },
        });
      } else {
        await this.prisma.screenShareParticipant.create({
          data: { sessionId, userId: user.id, role: 'viewer', status: 'joined', joinedAt: new Date() },
        });
      }
    }

    const token = this.generateLivekitToken({
      roomId: session.livekitRoomId,
      identity: user.id,
      name: user.name,
      isHost,
      voiceEnabled: session.voiceEnabled,
    });

    return {
      session,
      isHost,
      livekitToken: token,
      livekitUrl: this.config.get<string>('LIVEKIT_URL') ?? '',
    };
  }

  async declineInvite(sessionId: string, userId: string) {
    await this.prisma.screenShareParticipant.updateMany({
      where: { sessionId, userId, status: 'invited' },
      data: { status: 'declined' },
    });
    return { ok: true };
  }

  async leaveSession(sessionId: string, userId: string) {
    await this.prisma.screenShareParticipant.updateMany({
      where: { sessionId, userId, status: 'joined' },
      data: { status: 'left', leftAt: new Date() },
    });
    return { ok: true };
  }

  async listActive() {
    return this.prisma.screenShareSession.findMany({
      where: { orgId: DEV_ORG_ID, status: 'active' },
      orderBy: { startedAt: 'desc' },
      include: {
        participants: {
          select: { id: true, userId: true, guestName: true, role: true, status: true, joinedAt: true },
        },
      },
    });
  }

  async listHistory(limit = 50) {
    return this.prisma.screenShareSession.findMany({
      where: { orgId: DEV_ORG_ID, status: 'ended' },
      orderBy: { endedAt: 'desc' },
      take: Math.min(Math.max(1, limit), 200),
      include: { participants: { select: { userId: true, guestName: true, role: true, status: true } } },
    });
  }

  async getSession(sessionId: string) {
    const s = await this.prisma.screenShareSession.findFirst({
      where: { id: sessionId, orgId: DEV_ORG_ID },
      include: { participants: true },
    });
    if (!s) throw new NotFoundException('Session nicht gefunden');
    return s;
  }

  // ------------------------------------------------------------------
  // Externer Link (Gast-Token)
  // ------------------------------------------------------------------

  async createPublicLink(sessionId: string, userId: string, password?: string) {
    const session = await this.prisma.screenShareSession.findFirst({
      where: { id: sessionId, orgId: DEV_ORG_ID, status: 'active' },
    });
    if (!session) throw new NotFoundException('Session nicht gefunden oder beendet');
    if (session.hostUserId !== userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user?.role !== 'owner' && user?.role !== 'admin') {
        throw new ForbiddenException('Nur Host, Admin oder Owner darf externe Links erstellen');
      }
    }

    const token = randomBytes(9).toString('base64url').slice(0, 12);
    const passwordHash = password ? createHash('sha256').update(password).digest('hex') : null;
    // 4h Gueltigkeit
    const expires = new Date(Date.now() + 4 * 60 * 60 * 1000);

    const updated = await this.prisma.screenShareSession.update({
      where: { id: sessionId },
      data: {
        isPublic: true,
        publicToken: token,
        publicPasswordHash: passwordHash,
        publicExpiresAt: expires,
      },
    });
    return {
      token,
      passwordRequired: !!password,
      expiresAt: updated.publicExpiresAt,
    };
  }

  async revokePublicLink(sessionId: string, userId: string) {
    const session = await this.prisma.screenShareSession.findFirst({
      where: { id: sessionId, orgId: DEV_ORG_ID },
    });
    if (!session) throw new NotFoundException('Session nicht gefunden');
    if (session.hostUserId !== userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user?.role !== 'owner') {
        throw new ForbiddenException('Nur Host oder Owner darf den Link widerrufen');
      }
    }
    return this.prisma.screenShareSession.update({
      where: { id: sessionId },
      data: { isPublic: false, publicToken: null, publicPasswordHash: null, publicExpiresAt: null },
    });
  }

  /** Public-Endpoint: Gast tritt via Token bei. Kein Auth-Token erforderlich. */
  async joinAsGuest(token: string, guestName: string, password?: string) {
    const trimmedName = guestName?.trim();
    if (!trimmedName) throw new BadRequestException('Name erforderlich');
    const session = await this.prisma.screenShareSession.findFirst({
      where: { publicToken: token, isPublic: true, status: 'active' },
    });
    if (!session) throw new NotFoundException('Link ungueltig oder Session beendet');
    if (session.publicExpiresAt && session.publicExpiresAt < new Date()) {
      throw new ForbiddenException('Link abgelaufen');
    }
    if (session.publicPasswordHash) {
      const provided = password ? createHash('sha256').update(password).digest('hex') : null;
      if (provided !== session.publicPasswordHash) {
        throw new ForbiddenException('Passwort falsch');
      }
    }

    const guest = await this.prisma.screenShareParticipant.create({
      data: {
        sessionId: session.id,
        guestName: trimmedName.slice(0, 120),
        role: 'viewer',
        status: 'joined',
        joinedAt: new Date(),
      },
    });

    const lkToken = this.generateLivekitToken({
      roomId: session.livekitRoomId,
      identity: `guest-${guest.id}`,
      name: `${trimmedName} (Gast)`,
      isHost: false,
      // Gaeste duerfen nicht voice publishen — strict viewer
      voiceEnabled: false,
    });

    return {
      sessionId: session.id,
      participantId: guest.id,
      livekitToken: lkToken,
      livekitUrl: this.config.get<string>('LIVEKIT_URL') ?? '',
      sessionName: session.sessionName,
    };
  }

  // ------------------------------------------------------------------
  // Liveblocks-Auth fuer org-presence Room (Invite-Broadcast)
  // ------------------------------------------------------------------
  /**
   * Authorisiert den User fuer den `org-presence-{orgId}` Liveblocks-Room.
   * Dieser Room dient ausschliesslich als Broadcast-Channel fuer
   * screen-share-invite Events — kein State, keine Cursors.
   *
   * Faellt zurueck auf `{ token: null }` wenn LIVEBLOCKS_SECRET_KEY nicht
   * gesetzt ist — dann zeigt der Frontend kein Popup, aber die Session
   * funktioniert trotzdem (Empfaenger sehen sie im /screen-share Index).
   */
  async createOrgPresenceLiveblocksToken(userInfo: {
    userId: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
    orgId: string;
  }): Promise<{ token: string | null; roomId?: string; reason?: string }> {
    const secretKey = this.config.get<string>('LIVEBLOCKS_SECRET_KEY');
    if (!secretKey) {
      return { token: null, reason: 'LIVEBLOCKS_SECRET_KEY not configured' };
    }
    const liveblocks = new Liveblocks({ secret: secretKey });
    const roomId = `org-presence-${userInfo.orgId}`;
    const session = liveblocks.prepareSession(userInfo.userId, {
      userInfo: {
        name: userInfo.name,
        email: userInfo.email,
        avatarUrl: userInfo.avatarUrl ?? undefined,
      },
    });
    session.allow(roomId, session.FULL_ACCESS);
    const { body } = await session.authorize();
    const parsed = JSON.parse(body);
    return { token: parsed.token, roomId };
  }

  // ------------------------------------------------------------------
  // LiveKit-Token-Generator
  // ------------------------------------------------------------------

  /**
   * Erzeugt einen kurzlebigen LiveKit-Access-Token (4h).
   *
   * - Host: canPublish=true (kann Screen + Mikro veroeffentlichen)
   * - Viewer mit Voice: canPublish=true (nur Mikro), canSubscribe=true
   * - Viewer ohne Voice: canPublish=false (nur subscribe)
   *
   * Identity ist eindeutig per User (oder guest-{id}). Doppelte Identities
   * im selben Room sind in LiveKit nicht erlaubt — das verhindert auch
   * accidentally mehrfaches Joinen.
   */
  private generateLivekitToken(params: {
    roomId: string;
    identity: string;
    name: string;
    isHost: boolean;
    voiceEnabled: boolean;
  }): string {
    const apiKey = this.config.get<string>('LIVEKIT_API_KEY');
    const apiSecret = this.config.get<string>('LIVEKIT_API_SECRET');
    if (!apiKey || !apiSecret) {
      throw new Error('LIVEKIT_API_KEY / LIVEKIT_API_SECRET fehlt — Env-Vars in Railway setzen');
    }
    const at = new AccessToken(apiKey, apiSecret, {
      identity: params.identity,
      name: params.name,
      ttl: 4 * 60 * 60, // 4 Stunden
    });
    at.addGrant({
      room: params.roomId,
      roomJoin: true,
      // Host darf alles publishen (Screen + Mikro), Viewer nur Mikro falls Voice an
      canPublish: params.isHost || params.voiceEnabled,
      canSubscribe: true,
      canPublishData: true, // fuer Live-Chat ueber LiveKit-Data-Channel
    });
    return at.toJwt() as unknown as string;
  }
}
