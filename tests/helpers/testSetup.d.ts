export declare function getAdminToken(): Promise<string>;
export declare function getAnalystToken(): Promise<string>;
export declare function getViewerToken(): Promise<string>;
interface CreateRecordOverrides {
    amount?: number;
    type?: 'INCOME' | 'EXPENSE';
    category?: string;
    date?: string;
    notes?: string;
}
export declare function createTestRecord(token: string, overrides?: CreateRecordOverrides): Promise<{
    id: string;
    amount: string;
    type: string;
    category: string;
    date: string;
    notes: string | null;
}>;
export {};
