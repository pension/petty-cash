import type {
  StaffAssignment,
  StaffAssignmentType,
  StaffEmployee,
  StaffEligibility,
} from '~/types/staffAssignments';
import { eligibleActions } from '~/utils/staffEligibility';
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
  const staffAssignments = ref<StaffAssignment[]>([]);
  const staffEligibility = ref<StaffEligibility>({ requester: false, approver: false });
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
    pageDenied = ref(false),
    notifications = ref<FloatNotification[]>([]),
    notificationTotal = ref(0);
  let listQuery: Record<string, string | number | boolean | undefined> = {},
    view = '',
    generation = 0,
    requestSequence = 0,
    navigationSequence = 0,
    readEpoch = 0,
    listEndpoint = '/requests';
  const pendingReads = new Map<string, Promise<unknown>>();
  const cachedReads = new Map<string, { value: unknown; expires: number }>();
  let initialization: { path: string; promise: Promise<void> } | undefined;
  const pageCapabilities: Record<string, string> = {
    '/': 'viewRequests',
    '/approvals': 'viewApprovals',
    '/finance': 'viewFinance',
    '/requests': 'viewHistory',
    '/reconciliation': 'viewReconciliation',
    '/fund': 'viewLedger',
    '/notifications': 'viewNotifications',
    '/settings': 'viewSettings',
  };
  function canViewPage(path: string) {
    const capability = path.startsWith('/requests/') ? 'viewRequest' : pageCapabilities[path];
    return Boolean(capability && currentUser.value.capabilities[capability]);
  }
  const firstAllowedPage = computed(() => Object.keys(pageCapabilities).find(canViewPage));
  function invalidateReads() {
    readEpoch++;
    pendingReads.clear();
    cachedReads.clear();
  }
  async function read<T>(path: string, ttl = 0): Promise<T> {
    const cached = cachedReads.get(path);
    if (ttl && cached && cached.expires > Date.now()) return cached.value as T;
    const existing = pendingReads.get(path);
    if (existing) return existing as Promise<T>;
    const epoch = readEpoch;
    const promise = api<T>(path).then((value) => {
      if (epoch !== readEpoch) throw new Error('Petty Cash data changed.');
      if (ttl) cachedReads.set(path, { value, expires: Date.now() + ttl });
      return value;
    });
    pendingReads.set(path, promise);
    try {
      return await promise;
    } finally {
      if (pendingReads.get(path) === promise) pendingReads.delete(path);
    }
  }
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
    navigationSequence++;
    requestSequence++;
    invalidateReads();
    initialization = undefined;
    view = '';
    listEndpoint = '/requests';
    listQuery = {};
    pageDenied.value = false;
    loading.value = false;
    listTotal.value = transactionTotal.value = countTotal.value = notificationTotal.value = 0;
    requests.value = [];
    staffAssignments.value = [];
    staffEligibility.value = { requester: false, approver: false };
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
  type Access = Pick<Me, 'roles' | 'capabilities'> & { staffEligibility: StaffEligibility };
  async function refreshAccess(force = false) {
    const context = generation;
    const user = useIdentity().user.value;
    if (!user?.uuid) throw new Error('Sign in through Bifrost to continue.');
    try {
      if (force) cachedReads.delete('/access');
      const access = await read<Access>('/access', 30000);
      staffEligibility.value = access.staffEligibility || { requester: false, approver: false };
      currentUser.value = {
        id: user.uuid,
        name: user.name,
        email: user.email,
        department: access.roles.some((role) => role === 'GS_REQUESTER' || role === 'GS_MANAGER')
          ? 'General Services'
          : 'Finance',
        roles: access.roles,
        capabilities: {
          ...access.capabilities,
          createRequest: !!access.capabilities.createRequest && staffEligibility.value.requester,
        },
      };
    } catch (error) {
      if (context === generation) {
        staffEligibility.value = { requester: false, approver: false };
        currentUser.value.capabilities.createRequest = false;
      }
      throw error;
    }
  }
  function visibleRequest<T extends PettyCashSummary>(request: T): T {
    return {
      ...request,
      allowedActions: eligibleActions(request.allowedActions, staffEligibility.value),
    };
  }
  const visibleRequests = computed(() => requests.value.map(visibleRequest));
  async function fetchStaffAssignments() {
    staffAssignments.value = await read<StaffAssignment[]>('/staff-assignments');
  }
  const lookupStaff = (email: string) =>
    api<StaffEmployee>('/staff-assignments/lookup', 'POST', { email });
  async function saveStaffAssignment(operation: () => Promise<unknown>) {
    await mutate('staff-settings', operation);
    await refreshAccess(true).catch(() => {
      error.value = 'Staff settings saved. Refresh the page to reload your access.';
    });
  }
  const addStaffAssignment = (type: StaffAssignmentType, employee: StaffEmployee) =>
    saveStaffAssignment(() =>
      api('/staff-assignments', 'POST', {
        type,
        email: employee.email,
        employeeId: employee.employeeId,
      }),
    );
  const removeStaffAssignment = (id: string) =>
    saveStaffAssignment(() => api(`/staff-assignments/${encodeURIComponent(id)}`, 'DELETE'));

  async function fetchStats(ttl = 0) {
    stats.value = await read<typeof stats.value>('/stats', ttl);
  }
  async function fetchFund(ttl = 0) {
    fund.value = await read<PettyCashFund>('/fund', ttl);
  }
  async function fetchRequest(id: string) {
    const r = await read<PettyCashRequest>(`/requests/${encodeURIComponent(id)}`);
    details.value[id] = r;
    return visibleRequest(r);
  }
  async function fetchRequests(
    query: Record<string, string | number | boolean | undefined> = {},
    endpoint = listEndpoint,
  ) {
    listEndpoint = endpoint;
    listQuery = { ...query };
    const sequence = ++requestSequence;
    const q = new URLSearchParams(
      Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => [k, String(v)]),
    );
    const page = await read<Page<PettyCashSummary>>(`${endpoint}?${q}`);
    if (sequence !== requestSequence) return;
    requests.value = page.data;
    listTotal.value = page.total;
    listPage.value = page.page;
    listPageSize.value = page.pageSize;
  }
  async function fetchTransactions(page = 1) {
    const r = await read<Page<FundTransaction>>(`/fund/transactions?page=${page}&pageSize=5`);
    transactions.value = r.data;
    transactionTotal.value = r.total;
  }
  async function fetchCounts(page = 1) {
    const r = await read<Page<DailyReconciliation>>(`/vault-counts?page=${page}&pageSize=10`);
    reconciliations.value = r.data;
    countTotal.value = r.total;
  }
  async function fetchNotifications(page = 1, ttl = 0) {
    const r = await read<Page<FloatNotification>>(`/notifications?page=${page}&pageSize=20`, ttl);
    notifications.value = r.data;
    notificationTotal.value = r.total;
  }
  async function markRead(id: string) {
    await api(`/notifications/${id}/read`, 'POST');
    invalidateReads();
    await fetchNotifications(1, 60000);
  }
  function initialize(path: string): Promise<void> {
    if (initialization?.path === path) return initialization.promise;
    const promise = loadPage(path);
    initialization = { path, promise };
    void promise.finally(() => {
      if (initialization?.promise === promise) initialization = undefined;
    });
    return promise;
  }
  async function loadPage(path: string) {
    const run = ++navigationSequence;
    const context = generation;
    view = path;
    requestSequence++;
    loading.value = true;
    pageDenied.value = false;
    error.value = '';
    try {
      await refreshAccess();
      if (run !== navigationSequence || context !== generation) return;
      if (!canViewPage(path)) {
        pageDenied.value = true;
        return;
      }
      await loadPageData(path);
    } catch (e) {
      if (run === navigationSequence && context === generation)
        error.value = e instanceof Error ? e.message : 'Could not load Petty Cash.';
    } finally {
      if (run === navigationSequence && context === generation) loading.value = false;
    }
  }
  async function loadPageData(path: string, refresh = false) {
    const caps = currentUser.value.capabilities;
    const jobs: Promise<unknown>[] = [];
    if (caps.viewNotifications) jobs.push(fetchNotifications(1, 60000));
    if (
      caps.viewStatistics &&
      ['/', '/approvals', '/finance', '/fund', '/reconciliation'].includes(path)
    )
      jobs.push(fetchStats(30000));
    if (caps.viewFund && ['/fund', '/reconciliation'].includes(path)) jobs.push(fetchFund(30000));
    if (path.startsWith('/requests/')) {
      if (!refresh) jobs.push(fetchRequest(path.split('/')[2]));
    } else if (path === '/fund') jobs.push(fetchTransactions());
    else if (path === '/reconciliation') jobs.push(fetchCounts());
    else if (path === '/settings') jobs.push(fetchStaffAssignments());
    else if (path === '/approvals')
      jobs.push(fetchRequests(refresh ? listQuery : {}, '/approvals'));
    else if (path === '/finance')
      jobs.push(
        fetchRequests(
          refresh ? listQuery : { status: 'pending_finance,ready_for_collection' },
          '/finance',
        ),
      );
    else if (path === '/requests')
      jobs.push(
        fetchRequests(
          refresh ? listQuery : { sort: 'closedAt', order: 'desc' },
          '/requests/history',
        ),
      );
    else if (path === '/')
      jobs.push(
        fetchRequests(
          refresh
            ? listQuery
            : {
                mine: true,
                status:
                  'pending_approval,pending_finance,ready_for_collection,cash_issued,returned_for_correction,pending_closure',
              },
          '/requests',
        ),
      );
    await Promise.all(jobs);
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
      invalidateReads();
      await loadPageData(view, true).catch(() => {
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
    await refreshAccess(true);
    const known = details.value[id] || requests.value.find((r) => r.id === id);
    const actionName = name.startsWith('expenses/')
      ? 'removeExpense'
      : (
          {
            '': 'edit',
            authorize: 'authorize',
            reject: 'reject',
            'notify-collection': 'notifyCollection',
            'confirm-receipt': 'confirmReceipt',
            expenses: 'addExpense',
            settle: 'settle',
            reminders: 'sendReminder',
            'return-for-correction': 'returnForCorrection',
            finalize: 'finalize',
          } as Record<string, string>
        )[name];
    if (!known || !visibleRequest(known).allowedActions.includes(actionName))
      throw new Error('You are no longer eligible for this action. Refresh the request.');
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
          return visibleRequest(r);
        } catch (e) {
          if (e instanceof Error && 'status' in e && e.status === 409)
            await fetchRequest(id).catch(() => undefined);
          throw e;
        }
      },
      idempotent,
    );
  }
  const createRequest = async (p: {
    purpose: string;
    requestedAmount: number;
    estimatedClosingDate: string;
  }) => {
    await refreshAccess(true);
    if (!currentUser.value.capabilities.createRequest)
      throw new Error('You need request permission and an active requester staff assignment.');
    return mutate('create', () =>
      api<PettyCashRequest>('/requests', 'POST', {
        purpose: p.purpose,
        requestedAmount: p.requestedAmount,
        neededBy: p.estimatedClosingDate,
      }),
    );
  };
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
  async function requireReceiptAccess(capability: string) {
    await refreshAccess(true);
    if (!staffEligibility.value.requester || !currentUser.value.capabilities[capability])
      throw new Error('You need receipt permission and an active requester staff assignment.');
  }
  const uploadReceipt = async (file: File) => {
    await requireReceiptAccess('uploadReceipts');
    return api<{ fileId: string; fileName: string }>('/files', 'POST', { file }, undefined, true);
  };
  const extractReceipt = async (fileId: string) => {
    await requireReceiptAccess('extractReceipts');
    return api<ReceiptExtraction>('/ocr/receipts', 'POST', { fileId });
  };
  const extractReceipts = async (fileIds: string[]) => {
    await requireReceiptAccess('extractReceipts');
    return api<BulkReceiptExtraction>('/ocr/receipts', 'POST', { fileIds });
  };
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
    staffAssignments,
    staffEligibility,
    refreshAccess,
    lookupStaff,
    addStaffAssignment,
    removeStaffAssignment,
    requests: visibleRequests,
    allRequests: visibleRequests,
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
    pageDenied,
    canViewPage,
    firstAllowedPage,
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
    getRequestById: (id: string) =>
      details.value[id] ? visibleRequest(details.value[id]) : undefined,
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
