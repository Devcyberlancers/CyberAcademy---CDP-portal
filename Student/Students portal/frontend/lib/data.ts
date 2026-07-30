import {
  BarChart3,
  Bell,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
  Code2,
  FileText,
  GraduationCap,
  LineChart,
  Mic,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  Users
} from "lucide-react";

export const institution = {
  name: "Cyber Academy",
  shortName: "CA",
  centre: "Career Development & Placement Portal",
  address: "Cyber Academy Campus, Bengaluru, Karnataka 560064",
  phone: "+91 80 4123 7788",
  email: "placements@cyberlancers.in",
  hours: "Monday to Friday, 9:00 AM - 6:00 PM"
};

export const navItems = [
  ["Home", "/"],
  ["About", "/about"],
  ["Career Development", "/career-development"],
  ["Placements", "/placements"],
  ["Companies", "/companies"],
  ["Training", "/training"],
  ["Statistics", "/statistics"],
  ["Gallery", "/gallery"],
  ["Events", "/events"],
  ["Announcements", "/announcements"],
  ["FAQ", "/faq"],
  ["Contact", "/contact"]
] as const;

export const metrics = [
  { label: "Highest Package", value: "44 LPA", detail: "Product engineering role" },
  { label: "Average Package", value: "8.7 LPA", detail: "Across eligible graduates" },
  { label: "Companies Visited", value: "312", detail: "2025-26 hiring season" },
  { label: "Offers Released", value: "1,486", detail: "Including PPOs" },
  { label: "Students Placed", value: "94%", detail: "Placement conversion" },
  { label: "Internships", value: "682", detail: "Paid internships" }
];

export const companies = [
  { name: "Tata Digital", industry: "Technology", roles: 18, status: "Hiring", package: "12-22 LPA" },
  { name: "Infosys", industry: "Consulting", roles: 42, status: "Drive Scheduled", package: "5-9 LPA" },
  { name: "Bosch", industry: "Automotive", roles: 16, status: "Shortlisting", package: "8-14 LPA" },
  { name: "Deloitte", industry: "Advisory", roles: 21, status: "Hiring", package: "7-12 LPA" },
  { name: "Adobe", industry: "Product", roles: 6, status: "Interviewing", package: "28-44 LPA" },
  { name: "L&T", industry: "Infrastructure", roles: 28, status: "Hiring", package: "6-11 LPA" },
  { name: "Accenture", industry: "Services", roles: 54, status: "Drive Scheduled", package: "4.8-8 LPA" },
  { name: "Mercedes-Benz R&D", industry: "Mobility", roles: 12, status: "Hiring", package: "10-18 LPA" }
];

export const jobs = [
  { title: "Graduate Software Engineer", company: "Adobe", location: "Bengaluru", salary: "28-44 LPA", skills: "React, DSA, Java", type: "Full Time" },
  { title: "Data Analyst Trainee", company: "Deloitte", location: "Hyderabad", salary: "7-11 LPA", skills: "SQL, Python, Tableau", type: "Full Time" },
  { title: "Embedded Systems Intern", company: "Bosch", location: "Bengaluru", salary: "35k/month", skills: "C, RTOS, CAN", type: "Internship" },
  { title: "Civil Design Associate", company: "L&T", location: "Chennai", salary: "6-9 LPA", skills: "AutoCAD, BIM", type: "Full Time" }
];

export const services = [
  { icon: Target, title: "Career Counselling", text: "One-to-one mentoring, career maps, role discovery, and academic pathway planning." },
  { icon: Code2, title: "Technical Training", text: "DSA labs, cloud fundamentals, cybersecurity drills, embedded systems, and domain bootcamps." },
  { icon: Mic, title: "Communication Lab", text: "GD practice, presentation coaching, business writing, and confident interview storytelling." },
  { icon: FileText, title: "AI Resume Analysis", text: "ATS score, missing keywords, grammar review, formatting alerts, and job-match insights." },
  { icon: Users, title: "Mock Interviews", text: "Panel simulations with alumni, faculty, and hiring partners across core and IT roles." },
  { icon: Sparkles, title: "Skill Gap Analysis", text: "Personalized learning plans mapped to company roles, salary bands, and drive calendars." }
];

export const process = [
  "Registration",
  "Eligibility Verification",
  "Resume Submission",
  "Application",
  "Aptitude Test",
  "Technical Test",
  "Group Discussion",
  "Technical Interview",
  "HR Interview",
  "Offer Letter",
  "Joining"
];

export const departments = [
  "Computer Science",
  "Information Science",
  "Electronics",
  "Mechanical",
  "Civil",
  "Electrical",
  "MBA",
  "MCA",
  "Architecture"
];

export const statistics = [
  { year: "2021", placed: 78, average: 5.8, highest: 24 },
  { year: "2022", placed: 84, average: 6.4, highest: 28 },
  { year: "2023", placed: 89, average: 7.2, highest: 32 },
  { year: "2024", placed: 92, average: 8.1, highest: 38 },
  { year: "2025", placed: 94, average: 8.7, highest: 44 }
];

export const departmentStats = departments.slice(0, 6).map((department, index) => ({
  department,
  placed: [96, 93, 91, 88, 86, 90][index],
  offers: [312, 248, 206, 136, 108, 124][index]
}));

export const announcements = [
  { title: "Adobe registration closes on 08 July 2026", tag: "Campus Drive", date: "03 Jul 2026" },
  { title: "Resume clinic for final year students starts Monday", tag: "Training", date: "02 Jul 2026" },
  { title: "Deloitte analyst shortlist published in student portal", tag: "Results", date: "30 Jun 2026" },
  { title: "Mandatory aptitude diagnostic for 2027 batch", tag: "Circular", date: "28 Jun 2026" }
];

export const events = [
  { title: "Cyber Academy Career Fair 2026", date: "18 Jul 2026", meta: "72 companies, 2,000+ interviews" },
  { title: "Cloud Engineering Hackathon", date: "26 Jul 2026", meta: "AWS, Azure, and GCP tracks" },
  { title: "Industry Talk: AI in Manufacturing", date: "05 Aug 2026", meta: "Mercedes-Benz R&D leadership session" },
  { title: "MBA Consulting Bootcamp", date: "12 Aug 2026", meta: "Case interviews and market sizing" }
];

export const stories = [
  { name: "Nisha Rao", company: "Adobe", package: "44 LPA", quote: "The mock interview panel helped me turn projects into clear product stories." },
  { name: "Arjun Menon", company: "Bosch", package: "14 LPA", quote: "Core engineering preparation became structured, measurable, and genuinely motivating." },
  { name: "Meera Thomas", company: "Deloitte", package: "11 LPA", quote: "The analytics training and resume review made my applications much sharper." }
];

export const dashboardCards = [
  { label: "Resume Score", value: "86%", icon: FileText },
  { label: "ATS Score", value: "78%", icon: ShieldCheck },
  { label: "Applications", value: "14", icon: BriefcaseBusiness },
  { label: "Interviews", value: "5", icon: CalendarDays },
  { label: "Eligible Jobs", value: "28", icon: CheckCircle2 },
  { label: "Training Progress", value: "72%", icon: LineChart }
];

export const adminModules = [
  { title: "Students", value: "4,820", icon: GraduationCap },
  { title: "Recruiters", value: "386", icon: Building2 },
  { title: "Placement Drives", value: "64", icon: CalendarDays },
  { title: "Reports Exported", value: "128", icon: BarChart3 },
  { title: "Notifications", value: "9,240", icon: Bell },
  { title: "Certificates", value: "1,116", icon: Trophy }
];

export const faqs = [
  ["Who is eligible for campus placement?", "Students meeting department CGPA, attendance, training completion, and recruiter-specific criteria can register for drives."],
  ["Can recruiters post internships and full-time roles?", "Yes. Recruiters can publish internships, PPO paths, full-time roles, shortlists, interview schedules, and offer details."],
  ["Does the portal support ATS resume scoring?", "The student portal includes resume upload, AI analysis, keyword gaps, formatting checks, and role-wise match scoring."],
  ["How are placement statistics verified?", "The admin team validates offers, salary bands, joining status, department mapping, and recruiter confirmations before publishing reports."]
];
