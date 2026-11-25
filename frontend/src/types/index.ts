export type SystemRole = 'SUPER_ADMIN' | 'STAFF' | 'PATIENT' | 'NURSE';
export type ClinicRole = 'CLINIC_ADMIN' | 'DOCTOR' | 'RECEPTIONIST' | 'NURSE';

export interface NurseProfile {
  id: string;
  user_id: string;
  clinic_id?: string;
  full_name: string;
  phone: string;
  email: string;
  avatar_url?: string;
  education: string;
  experience_years: string;
  service_location: string;
  service_fee_bdt: number;
  hourly_rate_bdt?: number;
  bio?: string;
  is_available: boolean;
}

export interface NurseBooking {
  id: string;
  booking_code: string;
  nurse_id: string;
  patient_id: string;
  invoice_id?: string;
  invoice_number?: string;
  service_date: string;
  shift_time: string;
  patient_address: string;
  care_notes?: string;
  fee_bdt: number;
  status: 'Pending' | 'Confirmed' | 'Completed' | 'Cancelled' | string;
  created_at: string;
  nurse_name?: string;
  nurse_phone?: string;
  nurse_location?: string;
  nurse_avatar?: string;
  patient_name?: string;
  patient_phone?: string;
  payment_status?: string;
  contracted_hours?: number;
  hourly_rate_bdt?: number;
  duty_status?: 'Awaiting Payment' | 'Ready to Start' | 'In Progress' | 'Completed' | string;
  duty_started_at?: string | null;
  duty_ended_at?: string | null;
  actual_worked_minutes?: number;
  overtime_hours?: number;
  overtime_due_bdt?: number;
  overtime_invoice_id?: string | null;
  overtime_invoice_number?: string | null;
}

export interface ClinicMembership {
  clinic_id: string;
  clinic_name: string;
  clinic_slug: string;
  role: ClinicRole;
  designation?: string;
  is_active: boolean;
}

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  avatar_url?: string;
  system_role: SystemRole;
  is_active: boolean;
  clinic_memberships: ClinicMembership[];
  created_at: string;
}

export interface Clinic {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone: string;
  address_line1: string;
  city: string;
  country: string;
  timezone: string;
  currency: string;
  logo_url?: string;
  letterhead_template?: Record<string, any>;
  is_active: boolean;
}

export interface Patient {
  id: string;
  clinic_id: string;
  user_id?: string | null;
  mrn: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  blood_group: string;
  phone: string;
  email?: string;
  address_line?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  allergies: string[];
  chronic_conditions: string[];
  notes?: string;
  lab_reports_count?: number;
  created_at: string;
}

export interface LabTestFinding {
  parameter: string;
  result: string;
  unit: string;
  normal_range: string;
  flag?: 'NORMAL' | 'HIGH' | 'LOW';
}

export interface LabReport {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id?: string | null;
  doctor_name?: string | null;
  test_name: string;
  test_category?: string | null;
  test_date: string;
  result_summary: string;
  findings_json?: LabTestFinding[] | any;
  report_file_url?: string | null;
  status: 'Completed' | 'Pending' | 'Reviewed' | string;
  lab_name?: string | null;
  pathologist_name?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface DayScheduleItem {
  day: number;
  name: string;
  is_active: boolean;
  start_time: string;
  end_time: string;
  lunch_start?: string;
  lunch_end?: string;
}

export interface DoctorLeave {
  id: string;
  doctor_id: string;
  doctor_name?: string;
  doctor_specialization?: string;
  doctor_avatar?: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | string;
  status_display?: string;
  total_days?: number;
  created_at?: string;
}

export interface DoctorScheduleOverview {
  doctor_id: string;
  current_status: string;
  available_from_time?: string | null;
  status_note?: string | null;
  slot_duration: number;
  buffer_time: number;
  weekly_schedule: DayScheduleItem[];
}

export interface DoctorProfile {
  id: string;
  user_id: string;
  clinic_id: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
  bio?: string;
  specialization: string;
  specialty?: string;
  category?: string;
  license_number: string;
  qualifications: string;
  degrees?: string;
  chamber_location?: string;
  visiting_days?: string;
  visiting_hours?: string;
  consultation_fee: number;
  follow_up_fee: number;
  is_available_for_booking: boolean;
  current_status?: string;
  status_note?: string;
  available_from_time?: string;
  confirmed_leaves?: DoctorLeave[];
  weekly_schedule?: DayScheduleItem[];
}

export type AppointmentStatus =
  | 'SCHEDULED'
  | 'PENDING'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'IN_CONSULTATION'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export type AppointmentType =
  | 'IN_PERSON'
  | 'TELECONSULTATION'
  | 'WALK_IN'
  | 'FOLLOW_UP'
  | 'EMERGENCY';

export interface QueueToken {
  id: string;
  appointment_id: string;
  doctor_id: string;
  queue_date: string;
  token_number: number;
  token_code: string;
  status: 'WAITING' | 'CALLED' | 'WITH_DOCTOR' | 'COMPLETED' | 'SKIPPED';
  check_in_time: string;
  called_time?: string;
  consultation_start_time?: string;
}

export interface Appointment {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  appointment_number: string;
  appointment_type: AppointmentType;
  status: AppointmentStatus;
  start_time: string;
  end_time: string;
  reason_for_visit?: string;
  patient_name?: string;
  patient_mrn?: string;
  patient_phone?: string;
  patient_gender?: string;
  patient_dob?: string;
  patient_age?: number;
  doctor_name?: string;
  doctor_specialty?: string;
  doctor_specialization?: string;
  doctor_avatar?: string;
  avatar_url?: string;
  chamber_location?: string;
  serial_number?: number;
  serial_code?: string;
  patient?: any;
  queue_token?: QueueToken;
  created_at: string;
}

export interface TimeSlot {
  start_time: string;
  end_time: string;
  is_available: boolean;
  reason?: string;
}

export interface AvailableSlotsResponse {
  doctor_id: string;
  date: string;
  slot_duration_minutes: number;
  slots: TimeSlot[];
}

export interface LiveQueueItem {
  token_id: string;
  token_code: string;
  token_number: number;
  appointment_id: string;
  patient_name: string;
  doctor_name: string;
  status: 'WAITING' | 'CALLED' | 'WITH_DOCTOR' | 'COMPLETED' | 'SKIPPED';
  wait_time_minutes: number;
  check_in_time: string;
}

export interface HospitalUnit {
  id: string;
  clinic_id: string;
  unit_code: string;
  unit_name: string;
  category: string; // 'General Bed' | 'Cabin' | 'ICU' | 'CCU'
  floor?: string;
  daily_price: number;
  status: 'FREE' | 'BOOKED';
  current_patient_id?: string | null;
  current_doctor_id?: string | null;
  patient_name?: string | null;
  patient_mrn?: string | null;
  patient_phone?: string | null;
  doctor_name?: string | null;
  assigned_at?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}
