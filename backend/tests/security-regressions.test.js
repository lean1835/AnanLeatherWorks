const assert = require('node:assert/strict');
const http = require('node:http');
const { after, before, test } = require('node:test');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-with-at-least-thirty-two-characters';
process.env.COOKIE_SECRET = 'different-test-cookie-secret-with-thirty-two-chars';
process.env.R2_PUBLIC_DOMAIN = 'https://cdn.anan.test/assets';

require('ts-node/register/transpile-only');
require('tsconfig-paths/register');

const { normalizeImageObjectKey, storageService } = require('../src/common/services/r2.service');
const {
    buildImageReferenceFilter,
    cleanupUnreferencedImages,
    deriveThumbnailKey,
} = require('../src/common/services/imageCleanup.service');
const RepairOrder = require('../src/modules/repair-orders/repairOrder.model').default;
const User = require('../src/modules/auth/auth.model').default;
const Customer = require('../src/modules/customers/customer.model').default;
const { authService } = require('../src/modules/auth/auth.service');
const {
    parseVietnamBusinessDate,
    vietnamEndOfMonthUtc,
    vietnamStartOfMonthUtc,
} = require('../src/common/utils/timezone');
const app = require('../src/app').default;

let server;
let baseUrl;

before(async () => {
    server = http.createServer(app);
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
    if (!server) return;
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

test('normalizes canonical and trusted legacy image references', () => {
    const key = 'repairs/1720000000000_abcdef0123456789.jpg';
    assert.equal(normalizeImageObjectKey(key), key);
    assert.equal(normalizeImageObjectKey({ objectKey: key }), key);
    assert.equal(normalizeImageObjectKey(`/api/repair-orders/stream/${encodeURIComponent(key)}`), key);
    assert.equal(normalizeImageObjectKey(`https://cdn.anan.test/assets/${key}`), key);
});

test('rejects traversal, data URLs, malformed keys, and untrusted remote URLs', async () => {
    const invalidReferences = [
        '../secret.jpg',
        'repairs/../../secret.jpg',
        'repairs\\secret.jpg',
        '/etc/passwd.jpg',
        'data:image/jpeg;base64,AAAA',
        'https://attacker.example/private.jpg',
        'file:///etc/passwd.jpg',
        'repairs/not-an-image.svg',
    ];
    for (const value of invalidReferences) assert.equal(normalizeImageObjectKey(value), null, value);

    let fetchCalled = false;
    const originalFetch = global.fetch;
    global.fetch = async () => {
        fetchCalled = true;
        throw new Error('Remote fetch must not occur');
    };
    try {
        assert.equal(await storageService.getImageBuffer('https://attacker.example/private.jpg'), null);
        assert.equal(fetchCalled, false);
    } finally {
        global.fetch = originalFetch;
    }
});

function imageFilterMatches(filter, storedReference) {
    return filter.$or.some((condition) => {
        const matcher = condition.beforeImages || condition.afterImages;
        return matcher.$in.some((candidate) => {
            if (typeof candidate === 'string') return candidate === storedReference;
            candidate.lastIndex = 0;
            return candidate.test(storedReference);
        });
    });
}

test('shared-image cleanup recognizes canonical and trusted legacy references', () => {
    const key = 'repairs/1720000000000_abcdef0123456789.jpg';
    const encodedKey = encodeURIComponent(key);
    const filter = buildImageReferenceFilter(key);

    assert.equal(imageFilterMatches(filter, key), true);
    assert.equal(imageFilterMatches(filter, `/api/repair-orders/stream/${encodedKey}`), true);
    assert.equal(imageFilterMatches(filter, `https://api.anan.test/api/repair-images/stream/${encodedKey}`), true);
    assert.equal(imageFilterMatches(filter, `https://cdn.anan.test/assets/${key}?v=legacy`), true);
    assert.equal(imageFilterMatches(filter, `https://attacker.example/files/${key}`), false);
    assert.equal(deriveThumbnailKey(key), 'repairs/thumb_1720000000000_abcdef0123456789.jpg');
});

test('unique business keys declare one named index instead of duplicate auto indexes', () => {
    const userIndexes = User.schema.indexes().filter(([fields]) => fields.username === 1);
    const customerIndexes = Customer.schema.indexes().filter(([fields]) => fields.normalizedPhone === 1);

    assert.equal(userIndexes.length, 1);
    assert.equal(userIndexes[0][1].name, 'idx_user_username');
    assert.equal(userIndexes[0][1].unique, true);
    assert.equal(customerIndexes.length, 1);
    assert.equal(customerIndexes[0][1].name, 'idx_customer_normalizedPhone');
    assert.equal(customerIndexes[0][1].unique, true);
});

test('shared-image cleanup preserves referenced objects and bounds concurrent checks', async () => {
    const originalExists = RepairOrder.exists;
    const originalDeleteImage = storageService.deleteImage;
    const sharedKey = 'repairs/1720000000000_abcdef0123456789.jpg';
    let deleteCalls = 0;

    try {
        RepairOrder.exists = async () => ({ _id: 'shared-order' });
        storageService.deleteImage = async () => {
            deleteCalls += 1;
        };

        const sharedResult = await cleanupUnreferencedImages([sharedKey, sharedKey]);
        assert.deepEqual(sharedResult.referenced, [sharedKey]);
        assert.deepEqual(sharedResult.deleted, []);
        assert.equal(deleteCalls, 0);

        let activeChecks = 0;
        let maxActiveChecks = 0;
        RepairOrder.exists = async () => {
            activeChecks += 1;
            maxActiveChecks = Math.max(maxActiveChecks, activeChecks);
            await new Promise((resolve) => setImmediate(resolve));
            activeChecks -= 1;
            return null;
        };

        const keys = Array.from({ length: 12 }, (_, index) => `repairs/172000000000${index}_abcdef.jpg`);
        const cleanupResult = await cleanupUnreferencedImages(keys);
        assert.equal(cleanupResult.deleted.length, keys.length);
        assert.equal(cleanupResult.failures.length, 0);
        assert.equal(maxActiveChecks, 4);
        assert.equal(deleteCalls, keys.length);
    } finally {
        RepairOrder.exists = originalExists;
        storageService.deleteImage = originalDeleteImage;
    }
});

test('keeps date-only business boundaries stable in Vietnam regardless of host timezone', () => {
    assert.equal(parseVietnamBusinessDate('2026-08-01').toISOString(), '2026-07-31T17:00:00.000Z');
    assert.equal(parseVietnamBusinessDate('2026-08-01', true).toISOString(), '2026-08-01T16:59:59.999Z');
    assert.equal(Number.isNaN(parseVietnamBusinessDate('2026-02-30').getTime()), true);
    assert.equal(vietnamStartOfMonthUtc(2026, 8).toISOString(), '2026-07-31T17:00:00.000Z');
    assert.equal(vietnamEndOfMonthUtc(2026, 8).toISOString(), '2026-08-31T16:59:59.999Z');
});

test('anonymous callers cannot stream stored images', async () => {
    const key = encodeURIComponent('repairs/1720000000000_abcdef0123456789.jpg');
    const response = await fetch(`${baseUrl}/api/repair-orders/stream/${key}`);
    assert.equal(response.status, 401);
    assert.equal((await response.json()).success, false);
});

test('public registration is blocked without the bootstrap secret and does not reach MongoDB', async () => {
    const response = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'new-user', password: 'a-secure-password' }),
    });
    assert.equal(response.status, 403);
    assert.equal((await response.json()).success, false);
});

test('a disallowed browser Origin is rejected before an unsafe route can run', async () => {
    const response = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            origin: 'https://attacker.example',
        },
        body: JSON.stringify({ username: 'new-user', password: 'a-secure-password' }),
    });
    assert.equal(response.status, 403);
    assert.match((await response.json()).message, /Origin/);
});

test('login keeps the JWT in an HttpOnly cookie and never exposes it in JSON', async () => {
    const originalLogin = authService.login;
    const token = 'server-only-session-token';
    authService.login = async () => ({
        success: true,
        message: 'Đăng nhập thành công.',
        data: {
            user: { id: 'user-id', username: 'staff', displayName: 'Staff' },
            token,
        },
    });

    try {
        const response = await fetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ username: 'staff', password: 'valid-password' }),
        });
        const body = await response.json();
        const setCookie = response.headers.get('set-cookie') || '';

        assert.equal(response.status, 200);
        assert.equal(body.data.user.username, 'staff');
        assert.equal(Object.hasOwn(body.data, 'token'), false);
        assert.equal(JSON.stringify(body).includes(token), false);
        assert.match(setCookie, /token=/);
        assert.match(setCookie, /HttpOnly/i);
        assert.match(setCookie, /SameSite=Strict/i);
    } finally {
        authService.login = originalLogin;
    }
});

test('browser API authentication is cookie-only and rejects bearer-only sessions', async () => {
    const originalFindById = User.findById;
    let lookupCalls = 0;
    User.findById = async () => {
        lookupCalls += 1;
        return { _id: 'user-id', username: 'staff', displayName: 'Staff', isActive: true };
    };
    const token = jwt.sign({ id: 'user-id', username: 'staff' }, process.env.JWT_SECRET, {
        algorithm: 'HS256',
        issuer: 'ananleather-works-api',
        audience: 'ananleather-works-web',
        expiresIn: '5m',
    });

    try {
        const response = await fetch(`${baseUrl}/api/auth/me`, {
            headers: { authorization: `Bearer ${token}` },
        });
        assert.equal(response.status, 401);
        assert.equal(lookupCalls, 0);
    } finally {
        User.findById = originalFindById;
    }
});
