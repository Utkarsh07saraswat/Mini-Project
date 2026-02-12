const { EncryptionUtils } = require('../utils/encryptionUtils');

class EncryptionService {
    static encrypt(data, secret) {
        // Wrapper for specialized encryption needs
        // For now, we reuse the tenant ID encryption logic or add generic encryption
        if (typeof data !== 'string') {
            data = JSON.stringify(data);
        }
        return EncryptionUtils.encryptTenantId(data, secret);
    }

    static decrypt(encryptedData, secret) {
        const decrypted = EncryptionUtils.decryptTenantId(encryptedData, secret);
        try {
            return JSON.parse(decrypted);
        } catch {
            return decrypted;
        }
    }

    static hash(data) {
        return EncryptionUtils.hashForAudit(data);
    }
}

module.exports = { EncryptionService };
