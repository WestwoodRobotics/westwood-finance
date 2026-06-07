export type AuthStatus =
  | "signed_out"
  | "needs_student_id"
  | "pending_approval"
  | "approved"
  | "unauthorized";

export type OrderStatus =
  | "Pending Review"
  | "Approved"
  | "Ordered"
  | "Received"
  | "Denied"
  | "Cancelled"
  | "Void";

export interface GoogleUser {
  email: string;
  name: string;
  picture: string;
  sub: string;
}

export interface ApprovedMember {
  firstName: string;
  lastName: string;
  team: string;
  studentId: string;
  role?: string;
  email?: string;
}

export interface Order {
  item: string;
  company: string;
  link: string;
  price: number;
  quantity: number;
  notes: string;
  category: string;
  team: string;
  timestamp: string;
  total: number;
  status: OrderStatus;
  tracking: string;
  id: string;
  orderUUID: string;
  rowIndex: number;
  orderedBy: string;
}

export interface Fund {
  id: string;
  rowIndex: number;
  Amount: number;
  Type?: string;
  Source?: string;
  Date?: string;
  Notes?: string;
  Team?: string;
  GrantStatus?: string;
  [key: string]: unknown;
}

export type Budget = Record<string, Record<string, number>>;

export interface MemberMatch {
  member: ApprovedMember;
  evalStatus: "approved" | "unauthorized" | "pending_approval";
}
