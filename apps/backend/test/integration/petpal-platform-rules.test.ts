import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import {
  bootstrapBackendTestContext,
  type BackendTestContext,
  loginAs,
  reseedBackendTestContext,
  teardownBackendTestContext,
} from '../support/backend-testkit';

let context: BackendTestContext;

before(async () => {
  context = await bootstrapBackendTestContext();
});

beforeEach(async () => {
  await reseedBackendTestContext(context);
});

after(async () => {
  await teardownBackendTestContext(context);
});

describe('PetPal platform rule admin integration', () => {
  it('admin can manage draft, publish and archive platform rules', async () => {
    const { app, prisma } = context;
    const adminSession = await loginAs(app, 'admin', 'Admin123!');
    const suffix = Date.now().toString(36);

    const createFirstResponse = await request(app)
      .post('/api/petpal/admin/rules')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        ruleCode: `SERVICE_STANDARD_${suffix}`,
        ruleName: '服务标准与履约承诺',
        ruleVersion: 'v1.0.0',
        effectiveAt: '2026-04-02T08:00:00.000Z',
        contentMd: '# 服务标准\n\n- 每次服务前确认宠物状态\n- 服务结束后上传反馈',
      })
      .expect(200);

    const firstRule = createFirstResponse.body.data as {
      id: string;
      ruleCode: string;
      ruleName: string;
      ruleVersion: string;
      status: string;
      creatorId: string | null;
      updaterId: string | null;
    };

    assert.equal(firstRule.status, 'DRAFT');
    assert.equal(firstRule.creatorId, adminSession.user.id);
    assert.equal(firstRule.updaterId, adminSession.user.id);

    const updateFirstResponse = await request(app)
      .put(`/api/petpal/admin/rules/${firstRule.id}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        ruleCode: firstRule.ruleCode,
        ruleName: '服务标准与履约承诺（修订）',
        ruleVersion: 'v1.0.0',
        effectiveAt: '2026-04-02T08:00:00.000Z',
        contentMd: '# 服务标准\n\n- 服务开始前电话确认\n- 服务结束后 15 分钟内回传影像',
      })
      .expect(200);

    assert.equal(updateFirstResponse.body.data.ruleName, '服务标准与履约承诺（修订）');

    const publishFirstResponse = await request(app)
      .post(`/api/petpal/admin/rules/${firstRule.id}/publish`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(publishFirstResponse.body.data.status, 'PUBLISHED');

    const createSecondResponse = await request(app)
      .post('/api/petpal/admin/rules')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        ruleCode: firstRule.ruleCode,
        ruleName: '服务标准与履约承诺（新版）',
        ruleVersion: 'v1.1.0',
        effectiveAt: '2026-05-01T08:00:00.000Z',
        contentMd: '# 服务标准 v1.1\n\n- 补充异常升级路径\n- 补充服务日志最少次数',
      })
      .expect(200);

    const secondRule = createSecondResponse.body.data as {
      id: string;
      status: string;
    };

    assert.equal(secondRule.status, 'DRAFT');

    const publishSecondResponse = await request(app)
      .post(`/api/petpal/admin/rules/${secondRule.id}/publish`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(publishSecondResponse.body.data.status, 'PUBLISHED');

    const statsResponse = await request(app)
      .get('/api/petpal/admin/rules/stats')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .query({
        keyword: suffix,
      })
      .expect(200);

    assert.deepEqual(statsResponse.body.data, {
      total: 2,
      byStatus: {
        DRAFT: 0,
        PUBLISHED: 2,
        ARCHIVED: 0,
      },
      currentEffectiveCount: 1,
      upcomingPublishedCount: 1,
    });

    const listResponse = await request(app)
      .get('/api/petpal/admin/rules')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .query({
        page: 1,
        pageSize: 10,
        keyword: suffix,
      })
      .expect(200);

    assert.equal(listResponse.body.data.pagination.total, 2);
    assert.equal(
      listResponse.body.data.items.some((item: { id: string }) => item.id === firstRule.id),
      true,
    );
    assert.equal(
      listResponse.body.data.items.some((item: { id: string }) => item.id === secondRule.id),
      true,
    );

    const archiveFirstResponse = await request(app)
      .post(`/api/petpal/admin/rules/${firstRule.id}/archive`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(archiveFirstResponse.body.data.status, 'ARCHIVED');

    const archivedRule = await prisma.platformRule.findFirst({
      where: {
        id: firstRule.id,
      },
      select: {
        status: true,
        updateId: true,
      },
    });

    assert.ok(archivedRule);
    assert.equal(archivedRule.status, 'ARCHIVED');
    assert.equal(archivedRule.updateId, adminSession.user.id);
  });

  it('forbids ordinary member from querying platform rules', async () => {
    const { app } = context;
    const memberSession = await loginAs(app, 'user', 'User123!');

    await request(app)
      .get('/api/petpal/admin/rules')
      .set('Authorization', `Bearer ${memberSession.tokens.accessToken}`)
      .expect(403);
  });
});
