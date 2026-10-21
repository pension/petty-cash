export type StaffAssignmentType = 'requester' | 'approver';
export type StaffEligibility = { requester: boolean; approver: boolean };
export type StaffEmployee = {
  employeeId: number;
  rcn: string | null;
  identifier: string | null;
  name: string;
  email: string;
  designation: string;
  department: string;
};
export type StaffAssignment = StaffEmployee & {
  id: string;
  type: StaffAssignmentType;
  addedAt: string;
  addedBy: string;
  addedByName: string;
};
