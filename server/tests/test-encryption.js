const { TenantResolver } = require('../src/middleware/tenantResolver');
const { EncryptionUtils } = require('../src/utils/encryptionUtils');
const jwt = require('jsonwebtoken');

// Test encryption utilities
console.log('========================================');
console.log('Encryption & JWT Token Test');
console.log('========================================\n');

// 1. Test encryption/decryption
console.log('1. Testing Encryption/Decryption:');
const testTenantId = 'tenant-test-123';
const encryptionSecret = process.env.ENCRYPTION_SECRET || 'test-secret-key-for-development-only';

try {
    const encrypted = EncryptionUtils.encryptTenantId(testTenantId, encryptionSecret);
    console.log(`   Original: ${testTenantId}`);
    console.log(`   Encrypted: ${encrypted.substring(0, 50)}...`);

    const decrypted = EncryptionUtils.decryptTenantId(encrypted, encryptionSecret);
    console.log(`   Decrypted: ${decrypted}`);
    console.log(`   ✓ Match: ${testTenantId === decrypted}\n`);
} catch (error) {
    console.error(`   ✗ Error: ${error.message}\n`);
}

// 2. Test JWT token creation
console.log('2. Testing JWT Token Creation:');
const jwtSecret = process.env.JWT_SECRET || 'test-jwt-secret';

try {
    // Create token with encryption
    const payload = {
        tenantId: testTenantId,
        userId: 'user-123',
        email: 'test@example.com',
    };

    const token = TenantResolver.createToken(payload, true);
    console.log(`   Token created: ${token.substring(0, 50)}...`);

    // Verify and decode
    const decoded = jwt.verify(token, jwtSecret);
    console.log(`   Decoded payload:`);
    console.log(`     - Encrypted: ${decoded.encrypted}`);
    console.log(`     - User ID: ${decoded.userId}`);
    console.log(`     - Email: ${decoded.email}`);
    console.log(`     - Tenant ID (encrypted): ${decoded.tenantId.substring(0, 30)}...`);

    // Decrypt tenant ID
    const decryptedTenantId = EncryptionUtils.decryptTenantId(decoded.tenantId, encryptionSecret);
    console.log(`     - Tenant ID (decrypted): ${decryptedTenantId}`);
    console.log(`   ✓ Token verification successful\n`);
} catch (error) {
    console.error(`   ✗ Error: ${error.message}\n`);
}

// 3. Test token without encryption
console.log('3. Testing JWT Token Without Encryption:');
try {
    const payload = {
        tenantId: testTenantId,
        userId: 'user-456',
    };

    const token = TenantResolver.createToken(payload, false);
    const decoded = jwt.verify(token, jwtSecret);

    console.log(`   Encrypted: ${decoded.encrypted || false}`);
    console.log(`   Tenant ID: ${decoded.tenantId}`);
    console.log(`   ✓ Unencrypted token works\n`);
} catch (error) {
    console.error(`   ✗ Error: ${error.message}\n`);
}

// 4. Test hash for audit
console.log('4. Testing Hash for Audit Logs:');
const sensitiveData = 'user-password-123';
const hash = EncryptionUtils.hashForAudit(sensitiveData);
console.log(`   Original: ${sensitiveData}`);
console.log(`   Hash: ${hash}`);
console.log(`   ✓ One-way hash created\n`);

// 5. Generate new secrets
console.log('5. Generate New Secrets:');
const newSecret = EncryptionUtils.generateSecret();
console.log(`   New encryption secret: ${newSecret}`);
console.log(`   ✓ Use this in production .env file\n`);

console.log('========================================');
console.log('All encryption tests completed!');
console.log('========================================');
