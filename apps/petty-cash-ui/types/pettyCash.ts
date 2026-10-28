export type UserRole = 'gs_requester' | 'gs_manager' | 'finance_staff' | 'finance_supervisor';

export type RequestStatus =
  | 'draft'
  | 'pending_approval'
  | 'rejected'
  | 'pending_finance'
  | 'ready_for_collection'
  | 'cash_issued'
  | 'pending_closure'
  | 'returned_for_correction'
  | 'closed'
  | 'cancelled';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  department: string;
  role: UserRole;
  avatar?: string;
}

export interface ActivityTimelineItem {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  actor: {
    name: string;
    role: string;
  };
  type:
    | 'created'
    | 'approved'
    | 'rejected'
    | 'finance_processed'
    | 'handover'
    | 'acknowledged'
    | 'expense_added'
    | 'expense_verified'
    | 'expense_returned'
    | 'additional_requested'
    | 'additional_approved'
    | 'additional_issued'
    | 'return_recorded'
    | 'closed'
    | 'cancelled'
    | 'extended'
    | 'reminder';
}

export interface CashIssuance {
  id: string;
  amount: number;
  issuedBy: string;
  issuedAt: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  isAdditional: boolean;
  notes?: string;
}

export interface AdditionalCashRequest {
  id: string;
  amount: number;
  justification: string;
  requestedAt: string;
  status: 'pending_manager' | 'manager_approved' | 'manager_rejected' | 'issued';
  managerDecisionBy?: string;
  managerDecisionAt?: string;
  rejectionReason?: string;
  issuanceId?: string;
}

export interface ExpenseItem {
  fileId?: string;
  id: string;
  description: string;
  supplierName: string;
  category?: string;
  invoiceNumber: string;
  expenseDate: string;
  amount: number;
  receiptUrl?: string;
  receiptFileName?: string;
  receiptContentType?: string;
  ocrExtracted: boolean;
  ocrConfidence?: number;
  ocrFields?: {
    supplier?: string;
    invoice?: string;
    amount?: number;
    date?: string;
  };
  verificationStatus: 'submitted' | 'verified' | 'returned_for_correction' | 'rejected';
  correctionNote?: string;
  verifiedBy?: string;
  verifiedAt?: string;
}

export interface CashReturn {
  id: string;
  expectedAmount: number;
  actualAmount: number;
  difference: number;
  receivedBy: string;
  returnedBy: string;
  returnDate: string;
  notes?: string;
  acknowledged: boolean;
}

export interface CashHandover {
  id: string;
  fromEmployeeId: number;
  fromName: string;
  toEmployeeId: number;
  toName: string;
  note?: string;
  acceptedAt: string;
}

export interface ClosingDateExtension {
  originalDate: string;
  newDate: string;
  reason: string;
  extendedBy: string;
  extendedAt: string;
}

export interface PettyCashRequest {
  version: number;
  allowedActions: string[];
  expenseCount?: number;
  expenseTotal?: number;
  id: string; // e.g. "PC-2026-0042"
  purpose: string;
  department?: string;
  requester: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  status: RequestStatus;
  requestedAmount: number;
  approvedAmount: number;
  totalCashIssued: number;
  estimatedClosingDate: string;
  effectiveClosingDate: string;
  closingDateExtensions: ClosingDateExtension[];
  dynamicsReference?: string;
  fundId: string;
  notes?: string;
  rejectionReason?: string;
  correctionNote?: string;
  cancellationReason?: string;
  closureNotes?: string;
  closedBy?: string;
  closedAt?: string;
  custodianEmployeeId?: number;
  custodianName?: string;
  pendingCustodianEmployeeId?: number;
  pendingCustodianName?: string;
  issuances: CashIssuance[];
  additionalCashRequests: AdditionalCashRequest[];
  expenses: ExpenseItem[];
  returns: CashReturn[];
  handovers: CashHandover[];
  timeline: ActivityTimelineItem[];
  createdAt: string;
  updatedAt: string;
}

export interface PettyCashFund {
  id: string;
  name: string;
  currency: 'MVR';
  openingBalance: number;
  effectiveDate: string;
  currentExpectedBalance: number;
  custodian: string;
  description?: string;
}

export interface FundTransaction {
  id: string;
  fundId: string;
  type:
    'opening_balance' | 'cash_issued' | 'cash_returned' | 'reimbursement' | 'top_up' | 'adjustment';
  amount: number; // positive increases physical cash, negative decreases
  runningBalance: number;
  date: string;
  requestId?: string;
  recordedBy: string;
  reference: string;
  notes?: string;
}

export interface DenominationCounts {
  note1000?: number;
  note500: number;
  note100: number;
  note50: number;
  note20: number;
  note10: number;
  note5?: number;
  coin5?: number;
  coin2: number;
  coin1: number;
  coin0_5?: number;
  coin0_25?: number;
  coin0_10?: number;
  coin0_1?: number;
}

export interface DailyReconciliation {
  id: string;
  fundId: string;
  countDate: string;
  expectedBalance: number;
  actualCashCount: number;
  difference: number;
  countedBy: string;
  reviewer?: string;
  notes?: string;
  status: 'balanced' | 'discrepancy_pending' | 'resolved';
  denominations: DenominationCounts;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNotes?: string;
}

export interface RequestFinancialReconciliation {
  totalCashIssued: number;
  totalExpensesSubmitted: number;
  totalExpensesVerified: number;
  totalCashReturned: number;
  expectedCashReturn: number;
  unaccountedAmount: number;
  isFullyReconciled: boolean;
}

export interface PettyCashNotification {
  id: string;
  title: string;
  text: string;
  url: string;
  seen: boolean;
  createdAt: string;
}

export type PettyCashSummary = Omit<
  PettyCashRequest,
  'expenses' | 'issuances' | 'returns' | 'handovers' | 'timeline'
>;
