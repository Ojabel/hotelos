import type { Department, StaffMember } from '@/types';

const s = (n: number, name: string, title: string, department: Department, monthlySalary: number, hiredAt: string, hotelId = 'h-vi', status: StaffMember['status'] = 'active'): StaffMember => ({
  id: `st-${String(n).padStart(3, '0')}`, name, title, department, hotelId, status, monthlySalary, hiredAt,
  phone: `+234 70${n % 10} ${String(200 + n * 17).padStart(3, '0')} ${String(1000 + n * 311).slice(0, 4)}`,
  email: `${name.toLowerCase().replace(/[^a-z ]/g, '').replace(/ +/g, '.')}@hotelos.demo`,
});

export const mockStaff: StaffMember[] = [
  s(1, 'Amara Eze', 'General Manager', 'Management', 1800000, '2019-03-04'),
  s(2, 'Tolu Adeniyi', 'Front Desk Supervisor', 'Front Desk', 650000, '2020-06-15'),
  s(3, 'Blessing Ojo', 'Head Housekeeper', 'Housekeeping', 420000, '2019-09-01'),
  s(4, 'Kunle Raji', 'Room Attendant', 'Housekeeping', 220000, '2022-01-10'),
  s(5, 'Mercy Udo', 'Room Attendant', 'Housekeeping', 220000, '2022-08-22'),
  s(6, 'Femi Salako', 'Room Attendant', 'Housekeeping', 210000, '2023-02-13', 'h-epe'),
  s(7, 'Emeka Okoro', 'Chief Engineer', 'Maintenance', 550000, '2018-11-05'),
  s(8, 'Sani Abubakar', 'Electrician', 'Maintenance', 350000, '2021-04-19'),
  s(9, 'Peter Adewale', 'Plumber', 'Maintenance', 320000, '2021-10-04', 'h-epe'),
  s(10, 'Ruth Lawal', 'Restaurant Manager', 'Restaurant', 600000, '2020-01-20'),
  s(11, 'Ifeoma Nwankwo', 'Head Chef', 'Restaurant', 560000, '2019-07-15'),
  s(12, 'Chinedu Obi', 'Accountant', 'Finance', 480000, '2020-09-07'),
  s(13, 'Yetunde Bello', 'Room Attendant', 'Housekeeping', 220000, '2021-12-01', 'h-vi', 'on_leave'),
  s(14, 'Chioma Eze', 'Front Desk Agent', 'Front Desk', 280000, '2022-05-09'),
  s(15, 'Dayo Alabi', 'Front Desk Agent', 'Front Desk', 280000, '2023-03-06'),
  s(16, 'Gift Akpan', 'Waiter', 'Restaurant', 190000, '2023-07-17'),
  s(17, 'Samuel Obi', 'Waiter', 'Restaurant', 190000, '2024-01-08'),
  s(18, 'Hassan Musa', 'Security Officer', 'Security', 230000, '2021-02-15'),
];
