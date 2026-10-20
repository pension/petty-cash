import type { BulkReceiptInput } from '~/composables/useBulkReceipts';
import type { ReceiptExtraction, BulkReceiptExtraction } from '~/utils/receiptExtraction';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type {
  PettyCashRequest,
  PettyCashSummary,
  PettyCashFund,
  FundTransaction,
  DailyReconciliation,
  ExpenseItem,
  FloatNotification,
} from '~/types/float';
type Me = {
  id: string;
  name: string;
  email: string;
  department: string;
  roles: string[];
  capabilities: Record<string, boolean>;
};
type Page<T> = { data: T[]; total: number; page: number; pageSize: number };
export const useFloatStore = defineStore('float', () => {
  const currentUser = ref<Me>({
    id: '',
    name: '',
    email: '',
    department: '',
    roles: [],
    capabilities: {},
  });
  const requests = ref<PettyCashSummary[]>([]),
    details = ref<Record<string, PettyCashRequest>>({});
  const fund = ref<PettyCashFund>({
    id: '',
    name: '',
    currency: 'MVR',
    openingBalance: 0,
    effectiveDate: '',
    currentExpectedBalance: 0,
    custodian: '',
  });
  const transactions = ref<FundTransaction[]>([]),
    reconciliations = ref<DailyReconciliation[]>([]);
  const stats = ref({
    pendingApproval: 0,
    pendingDisbursement: 0,
    unsettled: 0,
    awaitingClosure: 0,
    cashInVault: 0,
    cashWithStaff: 0,
    lastCountAt: null as string | null,
    unresolvedDiscrepancies: 0,
  });
  const listTotal = ref(0),
    listPage = ref(1),
    listPageSize = ref(10),
    transactionTotal = ref(0),
    countTotal = ref(0);
  const loading = ref(false),
    busy = ref(false),
    error = ref(''),
    accessError = ref(''),
    notifications = ref<FloatNotification[]>([]),
    notificationTotal = ref(0);
  let listQuery: Record<string, string | number | boolean | undefined> = {},
    view = '',
    generation = 0,
    requestSequence = 0;
  const keys = new Map<string, string>();
  const blobs = new Map<string, string>();
  const base = () => String(useRuntimeConfig().public.apiBase).replace(/\/$/, '');
  async function api<T = unknown>(
    path: string,
    method = 'GET',
    body: object = {},
    key?: string,
    fileUpload = false,
  ): Promise<T> {
    const started = generation;
    const response = await useHttp<T>(`${base()}${path}`, {
      method,
      body,
      fileUpload,
      headers: key ? { 'Idempotency-Key': key } : {},
    });
    if (started !== generation) throw new Error('Petty Cash context changed.');
    if (!response.success) {
      if (response.status === 401) {
        useIdentity().logOut();
      }
      const message = response.error?.message || 'Could not reach Petty Cash. Please try again.';
      if (
        response.status === 403 &&
        (path === '/access' || response.error?.code === 'MPAO_ENTITY_REQUIRED')
      )
        accessError.value = message;
      const e = Object.assign(new Error(Array.isArray(message) ? message.join(', ') : message), {
        status: response.status,
        fields: response.error?.errors,
      });
      throw e;
    }
    return response.data;
  }
  function reset() {
    generation++;
    requestSequence++;
    requests.value = [];
    details.value = {};
    transactions.value = [];
    reconciliations.value = [];
    notifications.value = [];
    currentUser.value = {
      id: '',
      name: '',
      email: '',
      department: '',
      roles: [],
      capabilities: {},
    };
    fund.value = {
      id: '',
      name: '',
      currency: 'MVR',
      openingBalance: 0,
      effectiveDate: '',
      currentExpectedBalance: 0,
      custodian: '',
    };
    stats.value = {
      pendingApproval: 0,
      pendingDisbursement: 0,
      unsettled: 0,
      awaitingClosure: 0,
      cashInVault: 0,
      cashWithStaff: 0,
      lastCountAt: null,
      unresolvedDiscrepancies: 0,
    };
    keys.clear();
    for (const url of blobs.values()) URL.revokeObjectURL(url);
    blobs.clear();
    error.value = '';
    accessError.value = '';
  }
  async function fetchStats() {
    stats.value = await api<typeof stats.value>('/stats');
  }
  async function fetchFund() {
    fund.value = await api<PettyCashFund>('/fund');
  }
  async function fetchRequest(id: string) {
    const r = await api<PettyCashRequest>(`/requests/${encodeURIComponent(id)}`);
    details.value[id] = r;
    return r;
  }
  async function fetchRequests(query: Record<string, string | number | boolean | undefined> = {}) {
    listQuery = { ...query };
    const sequence = ++requestSequence;
    const q = new URLSearchParams(
      Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => [k, String(v)]),
    );
    const page = await api<Page<PettyCashSummary>>(`/requests?${q}`);
    if (sequence !== requestSequence) return;
    requests.value = page.data;
    listTotal.value = page.total;
    listPage.value = page.page;
    listPageSize.value = page.pageSize;
  }
  async function fetchTransactions(page = 1) {
    const r = await api<Page<FundTransaction>>(`/fund/transactions?page=${page}&pageSize=5`);
    transactions.value = r.data;
    transactionTotal.value = r.total;
  }
  async function fetchCounts(page = 1) {
    const r = await api<Page<DailyReconciliation>>(`/vault-counts?page=${page}&pageSize=10`);
    reconciliations.value = r.data;
    countTotal.value = r.total;
  }
  async function fetchNotifications(page = 1) {
    const r = await api<Page<FloatNotification>>(`/notifications?page=${page}&pageSize=20`);
    notifications.value = r.data;
    notificationTotal.value = r.total;
  }
  async function markRead(id: string) {
    await api(`/notifications/${id}/read`, 'POST');
    await fetchNotifications();
  }
  async function initialize(path: string) {
    const run = ++generation;
    view = path;
    loading.value = true;
    error.value = '';
    try {
      if (!currentUser.value.id) {
        const user = useIdentity().user.value;
        if (!user?.uuid) throw new Error('Sign in through Bifrost to continue.');
        const access = await api<Pick<Me, 'roles' | 'capabilities'>>('/access');
        if (run !== generation) return;
        currentUser.value = {
          id: user.uuid,
          name: user.name,
          email: user.email,
          department: access.roles.some((role) => role === 'GS_REQUESTER' || role === 'GS_MANAGER')
            ? 'General Services'
            : 'Finance',
          ...access,
        };
      }
      if (run !== generation) return;
      await Promise.all([fetchFund(), fetchStats(), fetchNotifications()]);
      if (path.startsWith('/requests/')) await fetchRequest(path.split('/')[2]);
      else if (path === '/fund') await fetchTransactions();
      else if (path === '/reconciliation') await fetchCounts();
      else if (path === '/approvals') await fetchRequests({ status: 'pending_approval' });
      else if (path === '/finance')
        await fetchRequests({ status: 'pending_finance,ready_for_collection' });
      else if (path === '/requests')
        await fetchRequests({ status: 'closed', sort: 'closedAt', order: 'desc' });
      else if (path === '/')
        await fetchRequests({
          mine: true,
          status:
            'pending_approval,pending_finance,ready_for_collection,cash_issued,returned_for_correction,pending_closure',
        });
    } catch (e) {
      if (run === generation)
        error.value = e instanceof Error ? e.message : 'Could not load Petty Cash.';
    } finally {
      if (run === generation) loading.value = false;
    }
  }
  async function mutate<T>(
    scope: string,
    fn: (key?: string) => Promise<T>,
    idempotent = false,
  ): Promise<T> {
    if (busy.value) throw new Error('Please wait for the current operation to finish.');
    busy.value = true;
    try {
      let key: string | undefined;
      if (idempotent) {
        key = keys.get(scope);
        if (!key) {
          const issued = await api<{ key: string }>('/idempotency-keys', 'POST');
          key = issued.key;
          keys.set(scope, key);
        }
      }
      const result = await fn(key);
      keys.delete(scope);
      // A refresh failure must never turn a committed payment into a failed submission.
      await Promise.all([
        fetchFund(),
        fetchStats(),
        fetchNotifications(),
        ...(view === '/fund'
          ? [fetchTransactions()]
          : view === '/reconciliation'
            ? [fetchCounts()]
            : !view.startsWith('/requests/')
              ? [fetchRequests(listQuery)]
              : []),
      ]).catch(() => {
        error.value = 'Saved successfully. Refresh the page to update the totals.';
      });
      return result;
    } catch (e) {
      if (e instanceof Error && 'status' in e && typeof e.status === 'number' && e.status < 500) {
        keys.delete(scope);
      }
      throw e;
    } finally {
      busy.value = false;
    }
  }
  async function action(
    id: string,
    name: string,
    body: object = {},
    method = 'POST',
    idempotent = false,
  ) {
    const known = details.value[id] || requests.value.find((r) => r.id === id);
    return mutate(
      `${id}:${name}`,
      async (key) => {
        try {
          const r = await api<PettyCashRequest>(
            `/requests/${id}${name ? '/' + name : ''}`,
            method,
            { ...body, expectedVersion: known?.version },
            idempotent ? key : undefined,
          );
          details.value[id] = r;
          return r;
        } catch (e) {
          if (e instanceof Error && 'status' in e && e.status === 409)
            await fetchRequest(id).catch(() => undefined);
          throw e;
        }
      },
      idempotent,
    );
  }
  const createRequest = (p: {
    purpose: string;
    requestedAmount: number;
    estimatedClosingDate: string;
  }) =>
    mutate('create', () =>
      api<PettyCashRequest>('/requests', 'POST', {
        purpose: p.purpose,
        requestedAmount: p.requestedAmount,
        neededBy: p.estimatedClosingDate,
      }),
    );
  const updateRequest = (
    id: string,
    p: { purpose: string; requestedAmount: number; neededBy: string },
  ) => action(id, '', p, 'PATCH');
  const approveRequestByManager = (id: string) => action(id, 'authorize');
  const rejectRequestByManager = (id: string, reason: string) => action(id, 'reject', { reason });
  const prepareCashByFinance = (id: string, p: { approvedAmount: number; notes?: string }) =>
    action(id, 'notify-collection', { amount: p.approvedAmount, reason: p.notes });
  const collectCash = (id: string) => action(id, 'confirm-receipt', {}, 'POST', true);
  const addExpense = (
    id: string,
    p: Pick<ExpenseItem, 'supplierName' | 'description' | 'expenseDate' | 'amount'> &
      Partial<ExpenseItem>,
  ) => action(id, 'expenses', p);
  const addExpenses = (id: string, receipts: BulkReceiptInput[]) =>
    action(id, 'expenses', { receipts }, 'POST', true);
  const deleteExpense = (id: string, expenseId: string) =>
    action(id, `expenses/${expenseId}`, {}, 'DELETE');
  const submitForClosure = (id: string) => action(id, 'settle');
  const sendReminder = (id: string) => action(id, 'reminders');
  const returnSettlementForCorrection = (id: string, note: string) =>
    action(id, 'return-for-correction', { note });
  const finalizeRequest = (
    id: string,
    p: { denominations?: Record<string, number>; dynamicsReference?: string },
  ) => action(id, 'finalize', p, 'POST', true);
  const addFundTopUp = (p: { amount: number; reference: string; notes?: string }) =>
    mutate('top-up', (key) => api('/fund/top-ups', 'POST', p, key), true);
  const recordDailyCount = (p: { denominations: Record<string, number>; notes?: string }) =>
    mutate('count', () =>
      api('/vault-counts', 'POST', { denominations: p.denominations, notes: p.notes }),
    );
  const resolveDiscrepancy = (id: string, p: { resolutionNotes: string; adjustLedger: boolean }) =>
    mutate(
      `resolve:${id}`,
      (key) =>
        api(
          `/vault-counts/${id}/resolve`,
          'POST',
          { resolutionNotes: p.resolutionNotes, adjustLedger: p.adjustLedger },
          key,
        ),
      true,
    );
  const uploadReceipt = (file: File) =>
    api<{ fileId: string; fileName: string }>('/files', 'POST', { file }, undefined, true);
  const extractReceipt = (fileId: string) =>
    api<ReceiptExtraction>('/ocr/receipts', 'POST', { fileId });
  const extractReceipts = (fileIds: string[]) =>
    api<BulkReceiptExtraction>('/ocr/receipts', 'POST', { fileIds });
  async function receiptUrl(fileId: string) {
    if (blobs.has(fileId)) return blobs.get(fileId)!;
    // useHttp's download option opens a window and cannot return protected preview bytes.
    const token = localStorage.getItem('access_token');
    const response = await fetch(`${base()}/files/${fileId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) throw new Error('Could not open the receipt.');
    const url = URL.createObjectURL(await response.blob());
    blobs.set(fileId, url);
    return url;
  }
  const report = () =>
    api<{
      fund: PettyCashFund;
      transactions: FundTransaction[];
      counts: DailyReconciliation[];
      cashWithStaff: number;
      preparedBy: string;
      totals: {
        topUps: number;
        cashIssued: number;
        cashReturned: number;
        reimbursements: number;
        adjustments: number;
      };
    }>('/reports/reconciliation');
  return {
    currentUser,
    requests,
    allRequests: requests,
    details,
    fund,
    transactions,
    reconciliations,
    stats,
    listTotal,
    listPage,
    listPageSize,
    transactionTotal,
    countTotal,
    loading,
    busy,
    error,
    accessError,
    notifications,
    notificationTotal,
    cashWithStaff: computed(() => stats.value.cashWithStaff),
    fundOverview: computed(() => ({
      unresolvedDiscrepanciesCount: stats.value.unresolvedDiscrepancies,
    })),
    initialize,
    reset,
    fetchRequests,
    fetchRequest,
    fetchTransactions,
    fetchCounts,
    fetchNotifications,
    markRead,
    fetchStats,
    fetchFund,
    getRequestById: (id: string) => details.value[id],
    nextPage: (page: number) => fetchRequests({ ...listQuery, page }),
    createRequest,
    updateRequest,
    approveRequestByManager,
    rejectRequestByManager,
    prepareCashByFinance,
    collectCash,
    addExpense,
    addExpenses,
    deleteExpense,
    submitForClosure,
    sendReminder,
    returnSettlementForCorrection,
    finalizeRequest,
    addFundTopUp,
    recordDailyCount,
    resolveDiscrepancy,
    uploadReceipt,
    extractReceipt,
    extractReceipts,
    receiptUrl,
    report,
  };
});
