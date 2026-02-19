
type StoredUser = {
    uid?: string;
    uuid?: string;
    id?: string;
    userId?: string;
    user_id?: string;
    name?: string;
    role?: string;
    managerName?: string;
    companyName?: string;
    company_name?: string;
    companyId?: string;
    company_id?: string;
    [key: string]: unknown;
} | null;

export const getStoredUser = (): StoredUser => {
    if (typeof window === 'undefined') return null;
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    try {
        const parsed = JSON.parse(userStr);
        return parsed?.user || parsed || null;
    } catch {
        return null; // Return null on parse error
    }
};

export const getRequesterId = (sourceUser?: StoredUser): string => {
    const user = sourceUser || getStoredUser();
    if (!user) return '';
    // Priority: uid > uuid > id > userId > user_id
    return user.uid || user.uuid || user.id || user.userId || user.user_id || '';
};

export const getStoredCompanyName = (sourceUser?: StoredUser): string => {
    const user = sourceUser || getStoredUser();
    if (!user) return '';
    return user.companyName || user.company_name || '';
};

export const getStoredCompanyId = (sourceUser?: StoredUser): string => {
    const user = sourceUser || getStoredUser();
    if (!user) return '';
    return user.companyId || user.company_id || '';
};
