/**
 * Hardcoded directory of FDU Silberman College of Business faculty,
 * scraped from fdu.edu/academics/colleges-schools/silberman in May 2026.
 *
 * Why a hardcoded list:
 * 1. The official FDU site doesn't expose faculty email addresses
 *    publicly, so students would otherwise have to guess and type.
 * 2. Picking a known faculty member from a dropdown is much faster
 *    than typing name + email — that was the whole point of the
 *    "Pick your class" simplification.
 * 3. /professors directory now shows every Silberman professor as a
 *    card whether students have used the bot with them yet or not.
 *
 * Each entry has a `slug` we use as a stable identifier across the DB
 * (stored in documents/chat_sessions as a synthetic professor_email
 * with the form `<slug>@silberman.fdu`). When the chapter eventually
 * wants real prof emails for outreach, those can be added per-row in
 * Supabase without disturbing the join key.
 *
 * Adjuncts and one-off lecturers should pick the "Other / not listed"
 * option in the ClassSelector and type their professor's name freely.
 */

export type Department =
  | "Accounting"
  | "Finance & Economics"
  | "Management & Marketing";

export type Faculty = {
  slug: string; // stable ID, e.g. "vijay-sampath"
  name: string; // display name, e.g. "Vijay Sampath"
  title: string; // role / rank
  department: Department;
};

const ACCOUNTING: Faculty[] = [
  { slug: "scott-mcgregor", name: "Scott McGregor", title: "Chair · Associate Professor of Accounting", department: "Accounting" },
  { slug: "deirdre-collier", name: "Deirdre Collier", title: "Professor of Accounting", department: "Accounting" },
  { slug: "jeffrey-hsu", name: "Jeffrey Hsu", title: "Professor of Management Information Systems", department: "Accounting" },
  { slug: "yongbeom-kim", name: "Yongbeom Kim", title: "Professor of Management Information Systems", department: "Accounting" },
  { slug: "leslie-mandel", name: "Leslie Mandel", title: "Senior Lecturer of Accounting", department: "Accounting" },
  { slug: "carmine-nogara", name: "Carmine Nogara", title: "Assistant Professor of Accounting", department: "Accounting" },
  { slug: "li-qin", name: "Li Qin", title: "Professor of Management Information Systems", department: "Accounting" },
  { slug: "hannah-rozen", name: "Hannah Rozen", title: "Associate Professor of Accounting", department: "Accounting" },
  { slug: "vijay-sampath", name: "Vijay Sampath", title: "Associate Professor of Accounting", department: "Accounting" },
  { slug: "jonathan-schiff", name: "Jonathan Schiff", title: "Professor of Accounting", department: "Accounting" },
  { slug: "xin-tan", name: "Xin Tan", title: "Professor of Management Information Systems", department: "Accounting" },
  { slug: "ron-west", name: "Ron West", title: "Director, CFP® Program · Professor of Taxation and Financial Planning", department: "Accounting" },
];

const FINANCE: Faculty[] = [
  { slug: "karen-denning", name: "Karen Denning", title: "Chair · Professor of Finance", department: "Finance & Economics" },
  { slug: "petros-anastasopoulos", name: "Petros Anastasopoulos", title: "Associate Professor of Economics", department: "Finance & Economics" },
  { slug: "amirhossein-bazargan", name: "Amirhossein Bazargan", title: "Assistant Professor of Decision Sciences", department: "Finance & Economics" },
  { slug: "kenneth-betz", name: "Kenneth Betz", title: "Senior Lecturer", department: "Finance & Economics" },
  { slug: "ilirjan-cane", name: "Ilirjan (Richard) Cane", title: "Lecturer of Decision Sciences", department: "Finance & Economics" },
  { slug: "patrick-cozza", name: "Patrick Cozza", title: "Lecturer of Wealth Management", department: "Finance & Economics" },
  { slug: "frederick-englander", name: "Frederick Englander", title: "Professor of Economics", department: "Finance & Economics" },
  { slug: "maureen-kieff", name: "Maureen Kieff", title: "Senior Lecturer of Quantitative Analysis", department: "Finance & Economics" },
  { slug: "wenyi-kuang", name: "Wenyi Kuang", title: "Assistant Professor of Supply Chain Management", department: "Finance & Economics" },
  { slug: "mahmoud-montasser", name: "Mahmoud Montasser", title: "Lecturer", department: "Finance & Economics" },
  { slug: "ziye-nie", name: "Ziye (Zoe) Nie", title: "Assistant Professor of Finance", department: "Finance & Economics" },
  { slug: "sorin-tuluca", name: "Sorin Tuluca", title: "Professor of Finance", department: "Finance & Economics" },
  { slug: "lu-wang", name: "Lu Wang", title: "Assistant Professor", department: "Finance & Economics" },
  { slug: "xiaohui-yang", name: "Xiaohui Yang", title: "Associate Professor of Finance", department: "Finance & Economics" },
];

const MANAGEMENT: Faculty[] = [
  { slug: "omer-topaloglu", name: "Omer Topaloglu", title: "Chair · Professor of Marketing", department: "Management & Marketing" },
  { slug: "james-almeida", name: "James G. Almeida", title: "Dean · Professor of Entrepreneurship", department: "Management & Marketing" },
  { slug: "daniel-wischnevsky", name: "J. Daniel Wischnevsky", title: "Associate Dean · Associate Professor of Management", department: "Management & Marketing" },
  { slug: "pierre-balthazard", name: "Pierre Balthazard", title: "Professor of Management", department: "Management & Marketing" },
  { slug: "scott-behson", name: "Scott J. Behson", title: "Professor of Management", department: "Management & Marketing" },
  { slug: "domenick-celentano", name: "Domenick Celentano", title: "Senior Lecturer of Entrepreneurship", department: "Management & Marketing" },
  { slug: "rajesh-chandrashekaran", name: "Rajesh Chandrashekaran", title: "Professor of Marketing", department: "Management & Marketing" },
  { slug: "yoshiko-demotta", name: "Yoshiko DeMotta", title: "Associate Professor of Marketing", department: "Management & Marketing" },
  { slug: "gerard-farias", name: "Gerard F. Farias", title: "Associate Professor of Management", department: "Management & Marketing" },
  { slug: "oden-groth", name: "Oden Groth", title: "Assistant Professor of Digital Marketing & MIS", department: "Management & Marketing" },
  { slug: "eunjeong-ko", name: "Eun-Jeong Ko", title: "Associate Professor of Entrepreneurship", department: "Management & Marketing" },
  { slug: "isabella-krysa", name: "Isabella Krysa", title: "Associate Professor of Management", department: "Management & Marketing" },
  { slug: "ian-mercer", name: "Ian Mercer", title: "Assistant Professor of Management", department: "Management & Marketing" },
  { slug: "osita-nwachukwu", name: "Osita Nwachukwu", title: "Associate Professor of Management", department: "Management & Marketing" },
  { slug: "jill-reid", name: "Jill Reid", title: "Clinical Assistant Professor of Marketing", department: "Management & Marketing" },
];

export const SILBERMAN_FACULTY: Faculty[] = [
  ...ACCOUNTING,
  ...FINANCE,
  ...MANAGEMENT,
];

export const FACULTY_BY_DEPARTMENT: Record<Department, Faculty[]> = {
  Accounting: ACCOUNTING,
  "Finance & Economics": FINANCE,
  "Management & Marketing": MANAGEMENT,
};

const SYNTHETIC_EMAIL_DOMAIN = "silberman.fdu";

/**
 * Build the synthetic email we store in the DB for a faculty member. This
 * is the join key for documents.professor_email + chat_sessions.professor_email
 * — it doesn't have to be a real address, just stable across the project.
 */
export function syntheticFacultyEmail(slug: string): string {
  return `${slug}@${SYNTHETIC_EMAIL_DOMAIN}`;
}

/**
 * True if the email looks like one we generated (vs. a real address typed
 * by an early student before this list existed).
 */
export function isSyntheticFacultyEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase().endsWith(`@${SYNTHETIC_EMAIL_DOMAIN}`);
}

/**
 * Recover the slug from a synthetic email (for joining static-list metadata
 * onto rows pulled from the DB). Returns null if the email isn't synthetic.
 */
export function facultySlugFromEmail(
  email: string | null | undefined
): string | null {
  if (!email) return null;
  const e = email.toLowerCase();
  const suffix = `@${SYNTHETIC_EMAIL_DOMAIN}`;
  if (!e.endsWith(suffix)) return null;
  return e.slice(0, -suffix.length);
}

const FACULTY_BY_SLUG = new Map(SILBERMAN_FACULTY.map((f) => [f.slug, f]));

export function getFacultyBySlug(slug: string): Faculty | null {
  return FACULTY_BY_SLUG.get(slug) ?? null;
}
