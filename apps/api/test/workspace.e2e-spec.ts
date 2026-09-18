import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import request from 'supertest';

import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { CsrfGuard } from '../src/common/guards/csrf.guard';
import { User } from '../src/users/schemas/user.schema';
import { Workspace } from '../src/workspaces/schemas/workspace.schema';
import { Membership } from '../src/memberships/schemas/membership.schema';
import { Role } from '../src/common/enums/role.enum';
import { InvitationsService } from '../src/invitations/invitations.service';
import { Types } from 'mongoose';

jest.setTimeout(30000);

process.env.NODE_ENV = 'test';
process.env.PORT = process.env.PORT ?? '3001';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'mongodb://localhost:27017/postly?replicaSet=rs0';
process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
process.env.SESSION_SECRET =
  process.env.SESSION_SECRET ?? 'test-session-secret-at-least-32-characters';
process.env.TOKEN_ENCRYPTION_KEY =
  process.env.TOKEN_ENCRYPTION_KEY ??
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:3000';

describe('Workspace & Team Management (e2e)', () => {
  let app: INestApplication;
  let userModel: any;
  let workspaceModel: any;
  let membershipModel: any;
  let invitationsService: InvitationsService;

  const origin = process.env.CORS_ORIGIN!;

  const timestamp = Date.now();

  const userAEmail = `phase3-owner-${timestamp}@example.com`;
  const userBEmail = `phase3-member-${timestamp}@example.com`;
  const protectionEmail = `phase3-owner-protection-${timestamp}@example.com`;

  const workspaceAName = `Phase 3 Workspace A ${timestamp}`;
  const workspaceBName = `Phase 3 Workspace B ${timestamp}`;
  const protectionWorkspaceName = `Phase 3 Protection ${timestamp}`;

  let inviteEmailForCleanup: string | null = null;

  async function signup(email: string, name: string) {
    const agent = request.agent(app.getHttpServer());

    await agent
      .post('/api/auth/signup')
      .set('Origin', origin)
      .send({
        name,
        email,
        password: 'Password123',
      })
      .expect(201);

    return agent;
  }

  beforeAll(async () => {
    /*
     * Enable Mongoose debug logging only for Membership operations.
     *
     * The goal is to catch an unexpected deleteOne/deleteMany operation
     * occurring when the second membership is created.
     */
    mongoose.set('debug', (collectionName, method, ...args) => {
      if (collectionName !== 'memberships' && collectionName !== 'membership') {
        return;
      }

      const safeValue = (value: any): any => {
        if (value === null || value === undefined) {
          return value;
        }

        if (value instanceof mongoose.Types.ObjectId) {
          return value.toString();
        }

        if (value instanceof Date) {
          return value.toISOString();
        }

        if (Array.isArray(value)) {
          return value.map(safeValue);
        }

        if (typeof value !== 'object') {
          return value;
        }

        /*
         * Mongo/Mongoose options can contain ClientSession, MongoClient,
         * collection objects, etc. Do not recursively serialize those.
         */
        if (
          value.constructor?.name === 'ClientSession' ||
          value.constructor?.name === 'MongoClient' ||
          value.constructor?.name === 'ServerSessionPool'
        ) {
          return `[${value.constructor.name}]`;
        }

        const result: Record<string, any> = {};

        for (const [key, nestedValue] of Object.entries(value)) {
          /*
           * Skip known MongoDB internal/session properties.
           */
          if (
            key === 'session' ||
            key === 'client' ||
            key === 'db' ||
            key === 'collection'
          ) {
            continue;
          }

          try {
            result[key] = safeValue(nestedValue);
          } catch {
            result[key] = '[Unserializable]';
          }
        }

        return result;
      };

      console.error(
        '[MONGOOSE MEMBERSHIP DEBUG]',
        method,
        JSON.stringify(args.map(safeValue), null, 2),
      );
    });

    const { AppModule } = await import('../src/app.module');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.setGlobalPrefix('api');

    app.enableCors({
      origin,
      credentials: true,
    });

    app.use(cookieParser());

    const configService = app.get(ConfigService);

    app.useGlobalFilters(new AllExceptionsFilter());

    app.useGlobalGuards(new CsrfGuard(configService));

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    userModel = app.get(getModelToken(User.name));
    workspaceModel = app.get(getModelToken(Workspace.name));
    membershipModel = app.get(getModelToken(Membership.name));
    invitationsService = app.get(InvitationsService);

    const membershipIndexes = await membershipModel.collection.indexes();

    console.error(
      'MEMBERSHIP INDEXES:',
      JSON.stringify(membershipIndexes, null, 2),
    );

    await app.init();
  });

  afterAll(async () => {
    try {
      if (workspaceModel && membershipModel) {
        const workspaces = await workspaceModel
          .find({
            name: {
              $in: [workspaceAName, workspaceBName, protectionWorkspaceName],
            },
          })
          .select('_id')
          .lean()
          .exec();

        const workspaceIds = workspaces.map((workspace: any) => workspace._id);

        if (workspaceIds.length) {
          await membershipModel.deleteMany({
            workspaceId: {
              $in: workspaceIds,
            },
          });

          await workspaceModel.deleteMany({
            _id: {
              $in: workspaceIds,
            },
          });
        }
      }

      if (userModel) {
        const emails = [userAEmail, userBEmail, protectionEmail];

        if (inviteEmailForCleanup) {
          emails.push(inviteEmailForCleanup);
        }

        await userModel.deleteMany({
          email: {
            $in: emails,
          },
        });
      }
    } finally {
      if (app) {
        await app.close();
      }
    }
  });

  it('isolates workspaces and enforces owner-only member management', async () => {
    const owner = await signup(userAEmail, 'Phase 3 Owner');

    const otherUser = await signup(userBEmail, 'Phase 3 Member');

    /*
     * Create Workspace A.
     */
    const createA = await owner
      .post('/api/workspaces')
      .set('Origin', origin)
      .send({
        name: workspaceAName,
      })
      .expect(201);

    const workspaceAId = createA.body.workspace.id;
    const nativeMemberships = await membershipModel.collection
      .find({
        workspaceId: new Types.ObjectId(workspaceAId),
      })
      .toArray();

    console.error(
      'NATIVE MEMBERSHIPS AFTER CREATE A:',
      JSON.stringify(nativeMemberships, null, 2),
    );

    const mongooseMemberships = await membershipModel
      .find({
        workspaceId: new Types.ObjectId(workspaceAId),
      })
      .lean()
      .exec();

    console.error(
      'MONGOOSE MEMBERSHIPS AFTER CREATE A:',
      JSON.stringify(mongooseMemberships, null, 2),
    );

    /*
     * Immediately inspect Workspace A memberships.
     */
    const afterCreateA = await membershipModel
      .find({
        workspaceId: new Types.ObjectId(workspaceAId),
      })
      .lean()
      .exec();

    console.error('AFTER CREATE A:', JSON.stringify(afterCreateA, null, 2));

    expect(afterCreateA).toHaveLength(1);
    expect(afterCreateA[0].role).toBe(Role.OWNER);

    /*
     * Create Workspace B.
     */
    const createB = await otherUser
      .post('/api/workspaces')
      .set('Origin', origin)
      .send({
        name: workspaceBName,
      })
      .expect(201);

    const workspaceBId = createB.body.workspace.id;

    /*
     * Make sure Workspace A's Owner membership survived creation
     * of Workspace B.
     */
    const afterCreateB = await membershipModel
      .find({
        workspaceId: workspaceAId,
      })
      .lean()
      .exec();

    console.error(
      'WORKSPACE A AFTER CREATE B:',
      JSON.stringify(afterCreateB, null, 2),
    );

    expect(afterCreateB).toHaveLength(1);
    expect(afterCreateB[0].role).toBe(Role.OWNER);

    /*
     * Verify cross-workspace access is blocked.
     */
    await owner
      .get(`/api/workspaces/${workspaceBId}`)
      .expect(403)
      .expect(({ body }) => {
        expect(body.code).toBe('NOT_A_MEMBER');
      });

    /*
     * Verify Owner membership through the real endpoint.
     */
    const members = await owner
      .get(`/api/workspaces/${workspaceAId}/members`)
      .expect(200);

    expect(members.body.members).toHaveLength(1);
    expect(members.body.members[0].role).toBe(Role.OWNER);

    /*
     * Find User B.
     */
    const otherUserRecord = await userModel
      .findOne({
        email: userBEmail,
      })
      .select('_id')
      .lean()
      .exec();

    expect(otherUserRecord).toBeDefined();

    /*
     * IMPORTANT DIAGNOSTIC #1
     *
     * Verify Owner membership immediately BEFORE creating
     * User B's membership.
     */
    const beforeSecondMembership = await membershipModel
      .find({
        workspaceId: workspaceAId,
      })
      .lean()
      .exec();

    console.error(
      'BEFORE SECOND MEMBERSHIP:',
      JSON.stringify(beforeSecondMembership, null, 2),
    );

    expect(beforeSecondMembership).toHaveLength(1);
    expect(beforeSecondMembership[0].role).toBe(Role.OWNER);

    /*
     * IMPORTANT DIAGNOSTIC #2
     *
     * Create User B's membership through Mongoose.
     */
    console.error(
      'CREATING SECOND MEMBERSHIP:',
      JSON.stringify(
        {
          userId: otherUserRecord!._id.toString(),
          workspaceId: workspaceAId,
          role: Role.VIEWER,
        },
        null,
        2,
      ),
    );

    const createdMembership = await membershipModel.create({
      userId: otherUserRecord!._id,
      workspaceId: workspaceAId,
      role: Role.VIEWER,
    });

    expect(createdMembership).toBeDefined();

    /*
     * IMPORTANT DIAGNOSTIC #3
     *
     * Inspect raw MongoDB collection directly.
     *
     * This bypasses Mongoose query helpers/population.
     */
    const rawAfterMongooseCreate = await membershipModel.collection
      .find({
        workspaceId: new mongoose.Types.ObjectId(workspaceAId),
      })
      .toArray();

    console.error(
      'RAW COLLECTION AFTER MONGOOSE CREATE:',
      JSON.stringify(
        rawAfterMongooseCreate,
        (_key, value) => {
          if (value instanceof mongoose.Types.ObjectId) {
            return value.toString();
          }

          if (value instanceof Date) {
            return value.toISOString();
          }

          return value;
        },
        2,
      ),
    );

    /*
     * IMPORTANT DIAGNOSTIC #4
     *
     * Normal Mongoose query after create.
     */
    const afterMongooseCreate = await membershipModel
      .find({
        workspaceId: workspaceAId,
      })
      .lean()
      .exec();

    console.error(
      'MONGOOSE QUERY AFTER CREATE:',
      JSON.stringify(afterMongooseCreate, null, 2),
    );

    /*
     * The Owner should still exist.
     */
    expect(afterMongooseCreate).toHaveLength(2);

    /*
     * Verify both roles.
     */
    const roles = afterMongooseCreate
      .map((membership: any) => membership.role)
      .sort();

    expect(roles).toEqual([Role.OWNER, Role.VIEWER].sort());

    /*
     * Verify that both membership references resolve to Users.
     */
    const debugMemberships = await membershipModel
      .find({
        workspaceId: workspaceAId,
      })
      .populate('userId')
      .lean()
      .exec();

    console.error(
      'DEBUG MEMBERSHIPS WITH USERS:',
      JSON.stringify(debugMemberships, null, 2),
    );

    expect(debugMemberships).toHaveLength(2);

    for (const membership of debugMemberships) {
      expect(membership.userId).toBeDefined();
    }

    /*
     * Real HTTP endpoint.
     */
    const memberList = await owner
      .get(`/api/workspaces/${workspaceAId}/members`)
      .expect(200);

    console.error(
      'MEMBERS RESPONSE:',
      JSON.stringify(memberList.body.members, null, 2),
    );

    expect(memberList.body.members).toHaveLength(2);

    const viewer = memberList.body.members.find(
      (member: any) => member.email === userBEmail,
    );

    expect(viewer).toBeDefined();
    expect(viewer.role).toBe(Role.VIEWER);

    /*
     * Invitation controller test.
     */
    const controllerInviteEmail = `phase3-controller-invite-${Date.now()}@example.com`;

    await owner
      .post(`/api/workspaces/${workspaceAId}/invitations`)
      .set('Origin', origin)
      .send({
        email: controllerInviteEmail,
        role: Role.EDITOR,
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.invitation.email).toBe(controllerInviteEmail);

        expect(body.invitation.role).toBe(Role.EDITOR);
      });

    /*
     * Viewer/editor must not manage invitations.
     */
    await otherUser
      .post(`/api/workspaces/${workspaceAId}/invitations`)
      .set('Origin', origin)
      .send({
        email: `phase3-forbidden-${Date.now()}@example.com`,
        role: Role.VIEWER,
      })
      .expect(403)
      .expect(({ body }) => {
        expect(body.code).toBe('INSUFFICIENT_ROLE');
      });

    /*
     * Pending invitations.
     */
    const pendingInvitations = await owner
      .get(`/api/workspaces/${workspaceAId}/invitations`)
      .expect(200);

    expect(
      pendingInvitations.body.invitations.some(
        (invitation: any) => invitation.email === controllerInviteEmail,
      ),
    ).toBe(true);

    /*
     * Invitation acceptance.
     */
    const inviteEmail = `phase3-invite-${Date.now()}@example.com`;

    inviteEmailForCleanup = inviteEmail;

    const ownerRecord = await userModel
      .findOne({
        email: userAEmail,
      })
      .select('_id')
      .lean()
      .exec();

    expect(ownerRecord).toBeDefined();

    const invite = await invitationsService.createInvitation(
      workspaceAId,
      ownerRecord!._id.toString(),
      inviteEmail,
      Role.VIEWER,
    );

    const inviteUser = await signup(inviteEmail, 'Phase 3 Invitee');

    await inviteUser
      .post(`/api/invitations/${invite.rawToken}/accept`)
      .set('Origin', origin)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          success: true,
        });
      });

    const inviteUserRecord = await userModel
      .findOne({
        email: inviteEmail,
      })
      .select('_id')
      .lean()
      .exec();

    expect(inviteUserRecord).toBeDefined();

    const acceptedMember = await membershipModel
      .findOne({
        workspaceId: workspaceAId,
        userId: inviteUserRecord!._id,
      })
      .lean()
      .exec();

    expect(acceptedMember?.role).toBe(Role.VIEWER);

    /*
     * Invitation token must be single-use.
     */
    await inviteUser
      .post(`/api/invitations/${invite.rawToken}/accept`)
      .set('Origin', origin)
      .expect(400)
      .expect(({ body }) => {
        expect(body.code).toBe('INVITATION_ALREADY_ACCEPTED');
      });

    await userModel.deleteOne({
      email: inviteEmail,
    });

    /*
     * Viewer cannot update another member.
     */
    await otherUser
      .patch(`/api/workspaces/${workspaceAId}/members/${viewer.membershipId}`)
      .set('Origin', origin)
      .send({
        role: Role.EDITOR,
      })
      .expect(403)
      .expect(({ body }) => {
        expect(body.code).toBe('INSUFFICIENT_ROLE');
      });

    /*
     * Owner can update the member.
     */
    await owner
      .patch(`/api/workspaces/${workspaceAId}/members/${viewer.membershipId}`)
      .set('Origin', origin)
      .send({
        role: Role.EDITOR,
      })
      .expect(200);

    /*
     * Member still cannot update workspace settings.
     */
    await otherUser
      .patch(`/api/workspaces/${workspaceAId}`)
      .set('Origin', origin)
      .send({
        name: 'Should Not Update',
      })
      .expect(403)
      .expect(({ body }) => {
        expect(body.code).toBe('INSUFFICIENT_ROLE');
      });

    /*
     * Member cannot delete workspace.
     */
    await otherUser
      .delete(`/api/workspaces/${workspaceAId}`)
      .set('Origin', origin)
      .expect(403)
      .expect(({ body }) => {
        expect(body.code).toBe('INSUFFICIENT_ROLE');
      });

    /*
     * User B owns Workspace B and can delete it.
     */
    await otherUser
      .delete(`/api/workspaces/${workspaceBId}`)
      .set('Origin', origin)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          success: true,
        });
      });

    /*
     * User A must no longer be able to access Workspace B.
     */
    await owner
      .get(`/api/workspaces/${workspaceBId}`)
      .expect(403)
      .expect(({ body }) => {
        expect(body.code).toBe('NOT_A_MEMBER');
      });
  });

  it('protects the owner from self-demotion and self-removal', async () => {
    const owner = await signup(protectionEmail, 'Protection Owner');

    const created = await owner
      .post('/api/workspaces')
      .set('Origin', origin)
      .send({
        name: protectionWorkspaceName,
      })
      .expect(201);

    const workspaceId = created.body.workspace.id;

    const members = await owner
      .get(`/api/workspaces/${workspaceId}/members`)
      .expect(200);

    expect(members.body.members).toHaveLength(1);

    const ownerMembershipId = members.body.members[0].membershipId;

    /*
     * Owner cannot demote themselves.
     */
    await owner
      .patch(`/api/workspaces/${workspaceId}/members/${ownerMembershipId}`)
      .set('Origin', origin)
      .send({
        role: Role.EDITOR,
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.code).toBe('CANNOT_DEMOTE_OWNER');
      });

    /*
     * Owner cannot remove themselves.
     */
    await owner
      .delete(`/api/workspaces/${workspaceId}/members/${ownerMembershipId}`)
      .set('Origin', origin)
      .expect(400)
      .expect(({ body }) => {
        expect(body.code).toBe('CANNOT_REMOVE_MEMBER');
      });

    /*
     * Owner membership must remain intact.
     */
    const membershipAfterAttempts = await membershipModel
      .findOne({
        _id: ownerMembershipId,
        workspaceId,
      })
      .lean()
      .exec();

    expect(membershipAfterAttempts).toBeDefined();
    expect(membershipAfterAttempts!.role).toBe(Role.OWNER);

    /*
     * Cleanup this workspace immediately.
     */
    await membershipModel.deleteOne({
      _id: ownerMembershipId,
    });

    await workspaceModel.deleteOne({
      _id: workspaceId,
    });

    await userModel.deleteOne({
      email: protectionEmail,
    });
  });
});
