const crypto = require('crypto');

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const ITERATIONS = 100000;

class EncryptionUtils {
    /**
     * Derive encryption key from secret using PBKDF2
     */
    static deriveKey(secret, salt) {
        return crypto.pbkdf2Sync(
            secret,
            salt,
            ITERATIONS,
            KEY_LENGTH,
            'sha512'
        );
    }

    /**
     * Encrypt tenant_id for JWT payload
     * @param {string} tenantId - Plain tenant ID
     * @param {string} secret - Encryption secret from env
     * @returns {string} - Base64 encoded encrypted data
     */
    static encryptTenantId(tenantId, secret = process.env.ENCRYPTION_SECRET) {
        if (!secret) {
            throw new Error('ENCRYPTION_SECRET not configured');
        }

        // Generate random salt and IV
        const salt = crypto.randomBytes(SALT_LENGTH);
        const iv = crypto.randomBytes(IV_LENGTH);

        // Derive key from secret
        const key = this.deriveKey(secret, salt);

        // Create cipher
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

        // Encrypt tenant ID
        let encrypted = cipher.update(tenantId, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        // Get authentication tag
        const authTag = cipher.getAuthTag();

        // Combine salt + iv + authTag + encrypted data
        const combined = Buffer.concat([
            salt,
            iv,
            authTag,
            Buffer.from(encrypted, 'hex')
        ]);

        return combined.toString('base64');
    }

    /**
     * Decrypt tenant_id from JWT payload
     * @param {string} encryptedData - Base64 encoded encrypted data
     * @param {string} secret - Encryption secret from env
     * @returns {string} - Plain tenant ID
     */
    static decryptTenantId(encryptedData, secret = process.env.ENCRYPTION_SECRET) {
        if (!secret) {
            throw new Error('ENCRYPTION_SECRET not configured');
        }

        try {
            // Decode base64
            const combined = Buffer.from(encryptedData, 'base64');

            // Extract components
            const salt = combined.slice(0, SALT_LENGTH);
            const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
            const authTag = combined.slice(
                SALT_LENGTH + IV_LENGTH,
                SALT_LENGTH + IV_LENGTH + TAG_LENGTH
            );
            const encrypted = combined.slice(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

            // Derive key
            const key = this.deriveKey(secret, salt);

            // Create decipher
            const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
            decipher.setAuthTag(authTag);

            // Decrypt
            let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
            decrypted += decipher.final('utf8');

            return decrypted;
        } catch (error) {
            throw new Error(`Decryption failed: ${error.message}`);
        }
    }

    /**
     * Generate a secure random encryption secret
     * @returns {string} - Base64 encoded secret
     */
    static generateSecret() {
        return crypto.randomBytes(32).toString('base64');
    }

    /**
     * Hash sensitive data for audit logs (one-way)
     * @param {string} data - Data to hash
     * @returns {string} - SHA-256 hash
     */
    static hashForAudit(data) {
        return crypto.createHash('sha256').update(data).digest('hex');
    }
}

module.exports = { EncryptionUtils };
