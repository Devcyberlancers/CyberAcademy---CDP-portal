import {
  Activity,
  BookOpen,
  BriefcaseBusiness,
  ClipboardList,
  GraduationCap,
  ShieldAlert,
  Users
} from "lucide-react";

export const dashboardStats = [
  { label: "Total Students", value: "12", caption: "Across all batches", tone: "indigo", icon: Users },
  { label: "Active This Week", value: "8", caption: "Logged in", tone: "emerald", icon: Activity },
  { label: "Courses Published", value: "5", caption: "1 draft waiting", tone: "blue", icon: BookOpen },
  { label: "Pending Approvals", value: "3", caption: "Student applications", tone: "amber", icon: ClipboardList },
  { label: "Open Jobs", value: "30", caption: "Live drives", tone: "violet", icon: BriefcaseBusiness },
  { label: "Assessment Flags", value: "2", caption: "Need review", tone: "rose", icon: ShieldAlert }
];

export const courses = [
  {
    id: "CL-2024-0018",
    title: "Ethical Hacking",
    category: "Cyber Security",
    instructor: "John Doe",
    status: "Published",
    students: 250,
    completion: 68,
    modules: 8,
    lessons: 64,
    updated: "16 May 2024"
  },
  {
    id: "CL-2024-0020",
    title: "Service Company Prep Course Level 2",
    category: "Placement Prep",
    instructor: "CDC Faculty",
    status: "Published",
    students: 518,
    completion: 42,
    modules: 10,
    lessons: 76,
    updated: "31 May 2024"
  },
  {
    id: "CL-2024-0024",
    title: "TCS NQT Mock and Practice Assessments",
    category: "Assessment",
    instructor: "Assessment Team",
    status: "Draft",
    students: 0,
    completion: 0,
    modules: 6,
    lessons: 28,
    updated: "03 Jun 2024"
  }
];

export const courseModules = [
  { title: "Introduction to Ethical Hacking", videoUrl: "https://www.youtube.com/watch?v=sample-intro", quiz: "Intro Quiz", locked: false },
  { title: "Footprinting & Reconnaissance", videoUrl: "https://www.youtube.com/watch?v=sample-footprint", quiz: "Reconnaissance Check", locked: true },
  { title: "Scanning Networks", videoUrl: "https://www.youtube.com/watch?v=sample-scan", quiz: "Scanning Quiz", locked: true },
  { title: "Enumeration", videoUrl: "https://www.youtube.com/watch?v=sample-enum", quiz: "Enumeration Quiz", locked: true },
  { title: "Vulnerability Analysis", videoUrl: "https://www.youtube.com/watch?v=sample-vulnerability", quiz: "Lab Review", locked: true },
  { title: "System Hacking", videoUrl: "https://www.youtube.com/watch?v=sample-system", quiz: "System Hacking Quiz", locked: true },
  { title: "Malware Threats", videoUrl: "https://www.youtube.com/watch?v=sample-malware", quiz: "Malware Quiz", locked: true },
  { title: "Sniffing & Spoofing", videoUrl: "https://www.youtube.com/watch?v=sample-sniffing", quiz: "Final Module Quiz", locked: true }
];

export const students = [
  {
    id: "STU006",
    name: "Uppalapati Bhargav",
    email: "bhargav.20bcn7050@vitstudent.ac.in",
    regNo: "20BCN7050",
    status: "Pending Approval",
    progress: 0,
    module: "Not Started",
    lastLogin: "-",
    joined: "10 Jul 2026"
  },
  {
    id: "STU001",
    name: "Riya Sharma",
    email: "riya.sharma@example.com",
    regNo: "21BCE1001",
    status: "Advanced",
    progress: 85,
    module: "8. Sniffing & Spoofing",
    lastLogin: "Online",
    joined: "12 Apr 2024"
  },
  {
    id: "STU002",
    name: "Aarav Kumar",
    email: "aarav.kumar@example.com",
    regNo: "21BCE1042",
    status: "In Progress",
    progress: 45,
    module: "4. Enumeration",
    lastLogin: "2h ago",
    joined: "18 Apr 2024"
  },
  {
    id: "STU003",
    name: "Pooja Singh",
    email: "pooja.singh@example.com",
    regNo: "22BCE1188",
    status: "New User",
    progress: 10,
    module: "1. Introduction",
    lastLogin: "1 day ago",
    joined: "16 May 2024"
  },
  {
    id: "STU004",
    name: "Mohit Tiwari",
    email: "mohit.tiwari@example.com",
    regNo: "20BCE1099",
    status: "Advanced",
    progress: 92,
    module: "8. Sniffing & Spoofing",
    lastLogin: "30m ago",
    joined: "22 Mar 2024"
  },
  {
    id: "STU005",
    name: "Sneha Nair",
    email: "sneha.nair@example.com",
    regNo: "21BCE1110",
    status: "In Progress",
    progress: 60,
    module: "5. Vulnerability Analysis",
    lastLogin: "5h ago",
    joined: "05 Apr 2024"
  }
];

export const jobs = [
  {
    id: "JOB001",
    company: "Elanco Innovation And Alliance Centre, India",
    role: "Trainee Engineer",
    location: "Bangalore",
    ctc: "Rs 30K PM",
    offer: "Regular offer",
    pending: 1,
    approved: 4,
    rejected: 0,
    status: "Published"
  },
  {
    id: "JOB002",
    company: "Zocket",
    role: "Software Developer",
    location: "Not Provided",
    ctc: "Rs 6L PA",
    offer: "Regular offer",
    pending: 1,
    approved: 3,
    rejected: 1,
    status: "Pending Approval"
  },
  {
    id: "JOB003",
    company: "Kumaran Systems",
    role: "Developer",
    location: "Chennai",
    ctc: "Rs 7L PA",
    offer: "Unplaced candidates",
    pending: 1,
    approved: 5,
    rejected: 0,
    status: "Published"
  }
];

export const candidateApprovals = [
  {
    id: "APP001",
    studentId: "STU006",
    studentName: "Uppalapati Bhargav",
    regNo: "20BCN7050",
    email: "bhargav.20bcn7050@vitstudent.ac.in",
    job: "Elanco Innovation And Alliance Centre, India",
    role: "Trainee Engineer",
    eligibility: "Auto eligible",
    status: "Pending Admin Approval"
  },
  {
    id: "APP002",
    studentId: "STU002",
    studentName: "Aarav Kumar",
    regNo: "21BCE1042",
    email: "aarav.kumar@example.com",
    job: "Zocket",
    role: "Software Developer",
    eligibility: "Manual review",
    status: "Needs Review"
  },
  {
    id: "APP003",
    studentId: "STU001",
    studentName: "Riya Sharma",
    regNo: "21BCE1001",
    email: "riya.sharma@example.com",
    job: "Kumaran Systems",
    role: "Developer",
    eligibility: "Auto eligible",
    status: "Pending Admin Approval"
  }
];

export const newStudentRegistrations = [
  {
    id: "REG001",
    studentId: "STU006",
    name: "Uppalapati Bhargav",
    regNo: "20BCN7050",
    email: "bhargav.20bcn7050@vitstudent.ac.in",
    phone: "+91-9490228229",
    degree: "B.Tech",
    branch: "CSE with Networks",
    batch: "2025",
    criteria: ["Institution email verified", "Registration number valid", "Profile details completed"],
    status: "Ready for Admin Approval",
    paymentStatus: "Verified",
    accountStatus: "Credentials Sent",
    profileStatus: "Completed",
    username: "20BCN7050",
    tempPassword: "Bhargav@7050",
    portalLink: process.env.NEXT_PUBLIC_STUDENT_PORTAL_LINK ?? "http://localhost:3000"
  },
  {
    id: "REG002",
    studentId: "STU007",
    name: "Diya Kurian",
    regNo: "21BCE1120",
    email: "diya.kurian@vitstudent.ac.in",
    phone: "+91-9000011122",
    degree: "B.Tech",
    branch: "CSE",
    batch: "2025",
    criteria: ["Institution email verified", "Registration number valid", "Profile details completed"],
    status: "Ready for Account Creation",
    paymentStatus: "Pending Verification",
    accountStatus: "Not Created",
    profileStatus: "Waiting for Student"
  }
];

export const securityEvents = [
  { title: "Repeated failed admin login", user: "placement.admin@vit.ac.in", severity: "High", time: "12 min ago" },
  { title: "Assessment tab-switch threshold crossed", user: "21BCE1042", severity: "Medium", time: "1h ago" },
  { title: "Bulk export generated", user: "super.admin@vit.ac.in", severity: "Low", time: "Yesterday" }
];

export const reports = [
  "Student progress report",
  "Course completion report",
  "Assignment performance report",
  "Placement approval report",
  "Job application funnel",
  "Security audit report"
];
