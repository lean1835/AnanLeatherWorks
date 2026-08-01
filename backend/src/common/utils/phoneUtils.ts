export function normalizePhoneNumber(phone: string): string {
    if (!phone) return '';
    let cleaned = phone.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('+84')) {
        cleaned = '0' + cleaned.slice(3);
    } else if (cleaned.startsWith('84') && cleaned.length >= 11) {
        cleaned = '0' + cleaned.slice(2);
    }
    return /^0[1-9]\d{8,9}$/.test(cleaned) ? cleaned : '';
}
