/**
 * Hardcoded directory of FDU Silberman College of Business undergraduate
 * courses, scraped from the official course catalog at
 * fdu.edu/silberman-courses (May 2026 catalog PDF).
 *
 * Why a hardcoded list:
 * - Mirrors the faculty directory pattern: students pick instead of typing.
 * - The catalog only changes once a year, so a hardcoded list is fine for
 *   a season — easy to refresh next time the PDF updates.
 * - Course IDs are predictable (DEPT####), so we can synthesize the
 *   final course_id ("DEPT_####_##") deterministically once the student
 *   adds a section number.
 *
 * For courses not on this list (graduate seminars, cross-listed Becton
 * courses, special topics under different numbers), the ClassSelector
 * still has an "Other / not listed" fallback that keeps the manual-entry
 * fields available.
 */

export type CourseDepartment =
  | "Accounting"
  | "Business (General)"
  | "Career Studies"
  | "Decision Sciences"
  | "Economics"
  | "Entrepreneurship"
  | "Finance"
  | "Wealth Management"
  | "International Business"
  | "Information Systems"
  | "Law"
  | "Management"
  | "Marketing"
  | "Organization Studies"
  | "Sustainability";

export type Course = {
  code: string; // "ACCT2021"
  title: string; // "Introductory Financial Accounting"
  department: CourseDepartment;
  credits: string; // "3" or "1-3" or "3 each"
};

const ACCOUNTING: Course[] = [
  { code: "ACCT2021", title: "Introductory Financial Accounting", department: "Accounting", credits: "3" },
  { code: "ACCT2022", title: "Introductory Managerial Accounting", department: "Accounting", credits: "3" },
  { code: "ACCT3241", title: "Intermediate Financial Accounting I", department: "Accounting", credits: "3" },
  { code: "ACCT3242", title: "Intermediate Financial Accounting II", department: "Accounting", credits: "3" },
  { code: "ACCT3243", title: "Cost Accounting: Measurement and Control", department: "Accounting", credits: "3" },
  { code: "ACCT3390", title: "Accounting Information Systems", department: "Accounting", credits: "3" },
  { code: "ACCT4261", title: "Advanced Accounting", department: "Accounting", credits: "3" },
  { code: "ACCT4263", title: "Auditing Concepts", department: "Accounting", credits: "3" },
  { code: "ACCT4267", title: "Fundamentals of Federal Taxation", department: "Accounting", credits: "3" },
  { code: "ACCT4498", title: "Internship in Accounting Studies", department: "Accounting", credits: "3" },
  { code: "ACCT4499", title: "Internship in Accounting Studies", department: "Accounting", credits: "3" },
  { code: "ACCT4800", title: "Independent Study in Accounting", department: "Accounting", credits: "1-3" },
];

const BUSINESS_GENERAL: Course[] = [
  { code: "BUSI1000", title: "Foundations of Business", department: "Business (General)", credits: "3" },
];

const CAREER_STUDIES: Course[] = [
  { code: "CARR3000", title: "Career Strategies", department: "Career Studies", credits: "2" },
];

const DECISION_SCIENCES: Course[] = [
  { code: "DSCI1234", title: "Mathematics for Business Decisions", department: "Decision Sciences", credits: "3" },
  { code: "DSCI1239", title: "Calculus with Business Applications", department: "Decision Sciences", credits: "3" },
  { code: "DSCI2029", title: "Introduction to Statistics", department: "Decision Sciences", credits: "3" },
  { code: "DSCI2130", title: "Business Statistics", department: "Decision Sciences", credits: "3" },
  { code: "DSCI3152", title: "Operations Management", department: "Decision Sciences", credits: "3" },
  { code: "DSCI3502", title: "Value Chain Management for Sustainability", department: "Decision Sciences", credits: "3" },
  { code: "DSCI4800", title: "Independent Study in Decision Sciences", department: "Decision Sciences", credits: "1-3" },
];

const ECONOMICS: Course[] = [
  { code: "ECON2001", title: "Introduction to Microeconomics", department: "Economics", credits: "3" },
  { code: "ECON2102", title: "Introduction to Macroeconomics", department: "Economics", credits: "3" },
  { code: "ECON2207", title: "Introduction to Econometrics", department: "Economics", credits: "3" },
  { code: "ECON4208", title: "International Trade", department: "Economics", credits: "3" },
  { code: "ECON4421", title: "Selected Studies in Economics", department: "Economics", credits: "1-3" },
  { code: "ECON4499", title: "Internship in Economics Studies", department: "Economics", credits: "3" },
  { code: "ECON4800", title: "Independent Study in Economics", department: "Economics", credits: "1-3" },
];

const ENTREPRENEURSHIP: Course[] = [
  { code: "ENTR2700", title: "Introduction to Entrepreneurship and Innovation", department: "Entrepreneurship", credits: "3" },
  { code: "ENTR3160", title: "Launching New Ventures", department: "Entrepreneurship", credits: "3" },
  { code: "ENTR3202", title: "Family Business Management", department: "Entrepreneurship", credits: "3" },
  { code: "ENTR3300", title: "E-business for Entrepreneurs", department: "Entrepreneurship", credits: "3" },
  { code: "ENTR3601", title: "Women as Entrepreneurs", department: "Entrepreneurship", credits: "3" },
  { code: "ENTR3700", title: "Doing Well Through Doing Good", department: "Entrepreneurship", credits: "3" },
  { code: "ENTR4100", title: "Managing Growing Ventures", department: "Entrepreneurship", credits: "3" },
  { code: "ENTR4498", title: "Internship in Entrepreneurial Studies", department: "Entrepreneurship", credits: "3" },
  { code: "ENTR4499", title: "Internship in Entrepreneurial Studies", department: "Entrepreneurship", credits: "3" },
  { code: "ENTR4800", title: "Independent Study in Entrepreneurship", department: "Entrepreneurship", credits: "3" },
];

const FINANCE: Course[] = [
  { code: "FIN3250", title: "Principles of Financial Analysis", department: "Finance", credits: "3" },
  { code: "FIN3310", title: "Intermediate Financial Analysis", department: "Finance", credits: "3" },
  { code: "FIN3330", title: "Personal Financial Management", department: "Finance", credits: "3" },
  { code: "FIN3371", title: "International Business Finance", department: "Finance", credits: "3" },
  { code: "FIN3421", title: "Sports Finance", department: "Finance", credits: "3" },
  { code: "FIN3503", title: "Finance, Value and Sustainability", department: "Finance", credits: "3" },
  { code: "FIN4150", title: "Working Capital Management", department: "Finance", credits: "3" },
  { code: "FIN4211", title: "Special Topics in Finance", department: "Finance", credits: "1-3" },
  { code: "FIN4221", title: "Capital Budgeting", department: "Finance", credits: "3" },
  { code: "FIN4341", title: "Financial Markets and Institutions", department: "Finance", credits: "3" },
  { code: "FIN4343", title: "Securities and Investments", department: "Finance", credits: "3" },
  { code: "FIN4350", title: "Derivatives", department: "Finance", credits: "3" },
  { code: "FIN4351", title: "Portfolio Management", department: "Finance", credits: "3" },
  { code: "FIN4405", title: "Analytical Methods in Finance", department: "Finance", credits: "3" },
  { code: "FIN4451", title: "Internship in Finance", department: "Finance", credits: "1-3" },
  { code: "FIN4452", title: "Internship in Finance", department: "Finance", credits: "1-3" },
  { code: "FIN4498", title: "Internship in Finance Studies", department: "Finance", credits: "3" },
  { code: "FIN4499", title: "Internship in Finance Studies", department: "Finance", credits: "3" },
  { code: "FIN4800", title: "Independent Study in Finance", department: "Finance", credits: "1-3" },
];

const WEALTH_MGMT: Course[] = [
  { code: "WMA3335", title: "Personal Financial Management", department: "Wealth Management", credits: "3" },
  { code: "WMA4265", title: "Personal Tax Planning", department: "Wealth Management", credits: "3" },
  { code: "WMA4267", title: "Retirement Planning", department: "Wealth Management", credits: "3" },
  { code: "WMA4350", title: "Investment Planning", department: "Wealth Management", credits: "3" },
  { code: "WMA4370", title: "Personal Estate and Gift Planning", department: "Wealth Management", credits: "3" },
  { code: "WMA4375", title: "Risk Management and Insurance", department: "Wealth Management", credits: "3" },
  { code: "WMA4380", title: "Client Relations in Financial Management", department: "Wealth Management", credits: "3" },
  { code: "WMA4390", title: "Financial Planning Capstone", department: "Wealth Management", credits: "3" },
  { code: "WMA4498", title: "Wealth Management Internship", department: "Wealth Management", credits: "3" },
  { code: "WMA4499", title: "Wealth Management Internship", department: "Wealth Management", credits: "3" },
];

const INT_BUSINESS: Course[] = [
  { code: "IBUS3201", title: "Fundamentals of International Business", department: "International Business", credits: "3" },
];

const INFO_SYSTEMS: Course[] = [
  { code: "MIS1045", title: "Information Technology for Business", department: "Information Systems", credits: "3" },
  { code: "MIS2001", title: "Management Information Systems", department: "Information Systems", credits: "3" },
  { code: "MIS4301", title: "Data, Communications and Networks", department: "Information Systems", credits: "3" },
  { code: "MIS4303", title: "Spreadsheet Applications in Business", department: "Information Systems", credits: "3" },
  { code: "MIS4304", title: "Database Applications in Business", department: "Information Systems", credits: "3" },
  { code: "MIS4305", title: "Systems Analysis, Design and Implementation", department: "Information Systems", credits: "3" },
  { code: "MIS4307", title: "Introduction to E-business", department: "Information Systems", credits: "3" },
  { code: "MIS4499", title: "Internship in Information Systems", department: "Information Systems", credits: "3" },
  { code: "MIS4800", title: "Independent Study in Information Systems", department: "Information Systems", credits: "1-3" },
];

const LAW: Course[] = [
  { code: "LAW2276", title: "Business and the Law", department: "Law", credits: "3" },
];

const MANAGEMENT: Course[] = [
  { code: "MGMT2600", title: "Organizational Behavior", department: "Management", credits: "3" },
  { code: "MGMT3100", title: "Managerial Ethics", department: "Management", credits: "3" },
  { code: "MGMT3371", title: "International Management", department: "Management", credits: "3" },
  { code: "MGMT3400", title: "Managing Sustainability in the Global Context", department: "Management", credits: "3" },
  { code: "MGMT3504", title: "Becoming an Effective Sustainability Change Agent", department: "Management", credits: "3" },
  { code: "MGMT3610", title: "Leading Teams", department: "Management", credits: "3" },
  { code: "MGMT3620", title: "Leadership and Personal Development", department: "Management", credits: "3" },
  { code: "MGMT3700", title: "Human Resources Management", department: "Management", credits: "3" },
  { code: "MGMT3710", title: "Strategic Staffing", department: "Management", credits: "3" },
  { code: "MGMT3720", title: "Training, Development and Performance Management", department: "Management", credits: "3" },
  { code: "MGMT4160", title: "Strategic Management", department: "Management", credits: "3" },
  { code: "MGMT4490", title: "Guided Internship in Sustainability Management", department: "Management", credits: "3" },
  { code: "MGMT4498", title: "Internship in Management", department: "Management", credits: "3" },
  { code: "MGMT4499", title: "Internship in Human Resources Management", department: "Management", credits: "3" },
  { code: "MGMT4640", title: "Managing Projects and Organizations", department: "Management", credits: "3" },
  { code: "MGMT4730", title: "Strategic Human Resource Management", department: "Management", credits: "3" },
  { code: "MGMT4800", title: "Independent Study in Management", department: "Management", credits: "1-3" },
];

const MARKETING: Course[] = [
  { code: "MKTG2120", title: "Principles of Marketing", department: "Marketing", credits: "3" },
  { code: "MKTG3344", title: "Marketing Research", department: "Marketing", credits: "3" },
  { code: "MKTG3360", title: "Digital Marketing", department: "Marketing", credits: "3" },
  { code: "MKTG3371", title: "Principles of International Marketing", department: "Marketing", credits: "3" },
  { code: "MKTG3383", title: "Social Media Marketing", department: "Marketing", credits: "3" },
  { code: "MKTG3501", title: "Marketing for a Sustainable World", department: "Marketing", credits: "3" },
  { code: "MKTG4272", title: "Consumer Behavior", department: "Marketing", credits: "3" },
  { code: "MKTG4344", title: "Public Relations", department: "Marketing", credits: "3" },
  { code: "MKTG4365", title: "Marketing Communications", department: "Marketing", credits: "3" },
  { code: "MKTG4405", title: "Advanced Marketing Management", department: "Marketing", credits: "3" },
  { code: "MKTG4498", title: "Internship in Marketing Studies", department: "Marketing", credits: "3" },
  { code: "MKTG4499", title: "Internship in Marketing Studies", department: "Marketing", credits: "3" },
  { code: "MKTG4800", title: "Independent Study in Marketing", department: "Marketing", credits: "3" },
];

const ORG_STUDIES: Course[] = [
  { code: "ORGS1100", title: "Ethical Issues in Social Institutions", department: "Organization Studies", credits: "3" },
];

const SUSTAINABILITY: Course[] = [
  { code: "SUST3500", title: "Environmental Economics", department: "Sustainability", credits: "3" },
];

export const SILBERMAN_COURSES: Course[] = [
  ...ACCOUNTING,
  ...BUSINESS_GENERAL,
  ...CAREER_STUDIES,
  ...DECISION_SCIENCES,
  ...ECONOMICS,
  ...ENTREPRENEURSHIP,
  ...FINANCE,
  ...WEALTH_MGMT,
  ...INT_BUSINESS,
  ...INFO_SYSTEMS,
  ...LAW,
  ...MANAGEMENT,
  ...MARKETING,
  ...ORG_STUDIES,
  ...SUSTAINABILITY,
];

// Display order — Accounting + Finance first because that's BAP's audience.
export const COURSE_DEPARTMENT_ORDER: CourseDepartment[] = [
  "Accounting",
  "Finance",
  "Wealth Management",
  "Economics",
  "Decision Sciences",
  "Information Systems",
  "Management",
  "Marketing",
  "Entrepreneurship",
  "International Business",
  "Business (General)",
  "Law",
  "Career Studies",
  "Organization Studies",
  "Sustainability",
];

export const COURSES_BY_DEPARTMENT: Record<CourseDepartment, Course[]> = {
  Accounting: ACCOUNTING,
  "Business (General)": BUSINESS_GENERAL,
  "Career Studies": CAREER_STUDIES,
  "Decision Sciences": DECISION_SCIENCES,
  Economics: ECONOMICS,
  Entrepreneurship: ENTREPRENEURSHIP,
  Finance: FINANCE,
  "Wealth Management": WEALTH_MGMT,
  "International Business": INT_BUSINESS,
  "Information Systems": INFO_SYSTEMS,
  Law: LAW,
  Management: MANAGEMENT,
  Marketing: MARKETING,
  "Organization Studies": ORG_STUDIES,
  Sustainability: SUSTAINABILITY,
};

const COURSES_BY_CODE = new Map(SILBERMAN_COURSES.map((c) => [c.code, c]));

export function getCourseByCode(code: string): Course | null {
  return COURSES_BY_CODE.get(code.toUpperCase()) ?? null;
}

/**
 * Convert a base catalog code ("ACCT2021") + section ("01") into the
 * course_id format the rest of the app already uses ("ACCT_2021_01").
 * Section is zero-padded to two digits.
 */
export function formatCourseId(code: string, section: string): string {
  const upper = code.trim().toUpperCase();
  const match = upper.match(/^([A-Z]+)(\d{4})$/);
  if (!match) return upper; // fall back to whatever was passed
  const prefix = match[1];
  const number = match[2];
  const cleanSection = section.replace(/\D/g, "").slice(0, 2);
  const paddedSection = cleanSection.padStart(2, "0");
  return `${prefix}_${number}_${paddedSection}`;
}

/**
 * Inverse of formatCourseId — split a stored course_id back into its base
 * code and section. Returns nulls if the value doesn't parse.
 */
export function parseCourseId(
  courseId: string | null | undefined
): { code: string; section: string } | null {
  if (!courseId) return null;
  const match = courseId.toUpperCase().match(/^([A-Z]+)_(\d{4})_(\d{2})$/);
  if (!match) return null;
  return { code: `${match[1]}${match[2]}`, section: match[3] };
}
