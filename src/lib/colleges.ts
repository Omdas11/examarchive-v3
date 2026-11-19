/**
 * All 75 colleges affiliated to Assam University (Silchar).
 * Source: official AUS affiliated-college list (aus.ac.in) + the
 * university's College Development Council list (Dec 2020) for locations.
 * Website URLs verified Nov 2026 (see goal hidden_files/college-websites.md);
 * `website: null` means no official homepage could be found — never a guess.
 * Static data: this page costs zero database reads.
 */
export interface College {
  name: string;
  location: string;
  /** Official website homepage, or null when none could be found. */
  website: string | null;
  /** True only for Haflong Govt College — the one college whose papers are live. */
  covered?: boolean;
}

export const COLLEGES: College[] = [

  { name: "A.K. Chanda Law College", location: "Silchar, Cachar", website: null },
  { name: "A.L. Choudhury College", location: "Algapur, Hailakandi", website: "https://www.alccollege.ac.in" },
  { name: "Barkhola College", location: "Barkhola, Cachar", website: "https://sites.google.com/view/barkhola-college/home" },
  { name: "Bhaswati Deb Memorial Centre for Higher Education", location: "Silchar, Cachar", website: "https://www.bdmche.org.in" },
  { name: "Bokajan College", location: "Bokajan, Karbi Anglong", website: "https://bokajancollege.co.in" },
  { name: "Cachar College", location: "Silchar, Cachar", website: "https://www.cacharcollege.ac.in" },
  { name: "DIET Hailakandi", location: "Hailakandi", website: "https://diethailakandi.com" },
  { name: "DIET Karbi Anglong", location: "Diphu, Karbi Anglong", website: "https://dietkarbianglong.in" },
  { name: "Deopani College", location: "Barpathar, Karbi Anglong", website: null },
  { name: "Diphu B.Ed College", location: "Diphu, Karbi Anglong", website: "https://www.diphubedcollege.org" },
  { name: "Diphu Girls College", location: "Diphu, Karbi Anglong", website: "https://diphugirlscollege.ac.in" },
  { name: "Diphu Govt College", location: "Diphu, Karbi Anglong", website: "https://diphugovernmentcollege.com" },
  { name: "Diphu Law College", location: "Diphu, Karbi Anglong", website: null },
  { name: "Don Bosco College", location: "Diphu, Karbi Anglong", website: "https://www.dbcdiphu.edu.in" },
  { name: "Dr. S.B. Institution of Education", location: "Hailakandi", website: "https://www.sbiehailakandi.co.in" },
  { name: "Dr. S.P.M. College of Education", location: "Silchar, Cachar", website: "https://www.spmcollege.edu.in" },
  { name: "Eastern Karbi Anglong College", location: "Sarihajan, Karbi Anglong", website: "https://www.ekac.in" },
  { name: "Fakhruddin Ali Ahmed Degree College", location: "Banskandi, Cachar", website: "https://fadegreecollege.in" },
  { name: "G.C. Paul College of Education", location: "Kalinagar, Karimganj", website: "https://www.gcpaulcollegeofeducation.org" },
  { name: "Govt Model College, Borkhola", location: "Borkhola (Jarailtala), Cachar", website: "https://gmcborkhola.ac.in/" },
  { name: "Gurucharan College", location: "Silchar, Cachar", website: "https://gurucharancollege.ac.in/" },
  { name: "Haflong Govt College", location: "Haflong, Dima Hasao", website: "https://www.haflonggovtcollege.ac.in/", covered: true },
  { name: "Hailakandi Women's College", location: "Hailakandi", website: null },
  { name: "Harlongbi Velongbi College", location: "Deithor, Karbi Anglong", website: "https://harlongbivelongbicollege.org/" },
  { name: "Hills Degree College", location: "Haflong, Dima Hasao", website: "https://hdc.ueniweb.com/" },
  { name: "Howraghat College", location: "Howraghat, Karbi Anglong", website: "https://www.howraghatcollege.co.in/" },
  { name: "Janata College", location: "Kabuganj, Cachar", website: "https://janatacollege.in/" },
  { name: "J.B. Hagjer Degree College", location: "Umrangso, Dima Hasao", website: "https://www.jbhagjerdegreecollege.in/" },
  { name: "J.N. Singh College", location: "Udharbond, Cachar", website: "https://www.jagannathsinghcollege.ac.in/" },
  { name: "Kaliganj Pioneer College", location: "Kaliganj, Karimganj", website: null },
  { name: "Kapili College", location: "Kheroni, West Karbi Anglong", website: "https://kapilicollege.co.in/" },
  { name: "Karimganj College", location: "Karimganj", website: "https://www.karimganjcollege.ac.in/" },
  { name: "Karimganj Law College", location: "Karimganj", website: "https://karimganjlawcollege.ac.in/" },
  { name: "Katigorah A Degree College", location: "Katigorah, Cachar", website: "https://kadcollege.in/" },
  { name: "Khairun Nessa Begum Women's College", location: "Srigauri, Karimganj", website: "https://www.knbwomenscollege.org/" },
  { name: "Lala Rural College", location: "Lala, Hailakandi", website: "https://lrcollege.ac.in/" },
  { name: "Lalit Jain Commerce College", location: "Silchar, Cachar", website: "https://www.lalitjaincollege.com/" },
  { name: "Langhin College", location: "Langhin, Karbi Anglong", website: "https://www.langhincollege.in/" },
  { name: "M.K. Dey College", location: "Amraghat, Cachar", website: "https://mkdc1994.in/" },
  { name: "M.K. Gandhi College", location: "Manikganj, Karimganj", website: "https://www.mkgandhi.in/" },
  { name: "Madhab Chandra Das (M.C.D.) College", location: "Sonai, Cachar", website: "https://www.mcdcollege.org.in/" },
  { name: "Maibang Degree College", location: "Maibang, Dima Hasao", website: "https://www.maibangdegreecollege.edu.in/" },
  { name: "Moinul Hoque Choudhury Memorial Science College", location: "Algapur, Hailakandi", website: "https://www.mhcmsc.in/" },
  { name: "Monmohan Ghosh Anil Das Memorial College", location: "Ramnagar, Silchar, Cachar", website: "https://www.mmgadcollege.ac.in/" },
  { name: "N.C. Paul Memorial College", location: "Jogipara, Silchar, Cachar", website: null },
  { name: "Nabinchandra College", location: "Badarpur, Karimganj", website: "https://www.nccollege.ac.in/" },
  { name: "Nehru College", location: "Pailapool, Cachar", website: "https://www.nehrucollege.org.in/" },
  { name: "Nilambazar College", location: "Nilambazar, Karimganj", website: "https://www.nilambazarcollege.ac.in/" },
  { name: "Pandit Deendayal Upadhyaya Adarsha Mahavidyalaya", location: "Eraligool, Karimganj", website: "https://www.pduameraligool.ac.in/" },
  { name: "Pandit Deendayal Upadhyaya Govt Model College", location: "Katlicherra, Hailakandi", website: "https://pdugmck.ac.in/" },
  { name: "Patharkandi College", location: "Patharkandi, Karimganj", website: "https://www.pkdc.ac.in/" },
  { name: "Patharkandi College of Education", location: "Patharkandi, Karimganj", website: "https://www.patharkandibedcollege.org/" },
  { name: "Pranab Jubilee College", location: "Bokajan, Karbi Anglong", website: "https://www.pjcbokajan.info/" },
  { name: "Rabindrasadan Girls' College", location: "Karimganj", website: "https://www.rabindrasadangirlscollege.in/" },
  { name: "R.K. Nagar College", location: "Ramkrishna Nagar, Karimganj", website: "https://www.rknagarcollege.org/" },
  { name: "Radhamadhab College", location: "Silchar, Cachar", website: "https://www.rmcollege.org/" },
  { name: "Ramanuj Gupta Degree College", location: "Silchar, Cachar", website: "https://www.rgdc.ac.in" },
  { name: "Rangsina College", location: "Donkamokam, West Karbi Anglong", website: "https://www.rangsinacollege.co.in" },
  { name: "Rukasen College", location: "Bakaliaghat, Karbi Anglong", website: "https://www.rukasen.com" },
  { name: "Satya Ranjan College", location: "Kalain, Cachar", website: "https://www.srcollege.ac.in" },
  { name: "S.C. Dey College", location: "Kalinagar, Hailakandi", website: "https://scdck.ac.in" },
  { name: "Semson Sing Engti College", location: "Baithalangso, Karbi Anglong", website: null },
  { name: "Silchar College", location: "Singari, Silchar, Cachar", website: "https://www.silcharcollege.ac.in" },
  { name: "Silchar College of Education", location: "Silchar, Cachar", website: "https://www.silcharcollegeofeducation.ac.in" },
  { name: "S.K. Roy College", location: "Katlicherra, Hailakandi", website: "https://www.skroycollegektc.ac.in" },
  { name: "S.K. Roy Memorial Institute of Education", location: "Katlicherra, Hailakandi", website: "https://www.skrmie.ac.in" },
  { name: "S.M. Dev College", location: "Lakhipur, Cachar", website: "https://www.smdevcollege.ac.in" },
  { name: "S.S. College", location: "Hailakandi", website: "https://www.sscollegehkd.ac.in" },
  { name: "Swami Vivekananda College", location: "Chandkhira, Karimganj", website: "https://svcollegecdk.ac.in" },
  { name: "Thong Nokbe College", location: "Dokmoka, Karbi Anglong", website: "https://tnc.ac.in" },
  { name: "T.T. College (Teachers' Training College)", location: "Silchar, Cachar", website: "https://ttcollegesilchar.com" },
  { name: "Vivekananda College of Education", location: "Karimganj", website: "https://www.vced.org" },
  { name: "Waisong College", location: "Hamren, West Karbi Anglong", website: null },
  { name: "West Silchar College", location: "Barjatrapur, Cachar", website: "https://www.westsilcharcollege.ac.in" },
  { name: "Women's College", location: "Silchar, Cachar", website: "https://www.wcsilchar.ac.in" },
];

export const COLLEGE_COUNT = COLLEGES.length;
