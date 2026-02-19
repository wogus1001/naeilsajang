
export const getStoredUser = () => {
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

export const getRequesterId = (): string => {
    const user = getStoredUser();
    if (!user) return '';
    // Priority: uid > uuid > id > userId > user_id
    return user.uid || user.uuid || user.id || user.userId || user.user_id || '';
};

export const getStoredCompanyName = (): string => {
    const user = getStoredUser();
    if (!user) return '';
    return user.companyName || user.company_name || '';
};

export const getStoredCompanyId = (): string => {
    const user = getStoredUser();
    if (!user) return '';
    return user.companyId || user.company_id || '';
};
