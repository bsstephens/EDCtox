/**
 * Substances the European Union has formally identified as endocrine disruptors.
 *
 * Transcribed from Annex III (table A9) of the WHO/UNEP State of the Science of
 * Endocrine-Disrupting Chemicals 2026, retrieved 20 November 2026. That annex reproduces
 * list I at https://edlists.org, which combines three instruments: the Plant Protection
 * Products Regulation, the Biocidal Products Regulation, and REACH's Candidate List of
 * substances of very high concern. The annex does not say which instrument covers each row,
 * so neither does EDCtox.
 *
 * What a row means: a European Union process concluded this substance meets its criteria for
 * an endocrine disruptor. That is a regulatory conclusion, not an EDCtox score, not a potency
 * statement, and not a claim about any particular health outcome. Absence from this list means
 * the European Union has not identified the substance. It does not mean the substance was
 * assessed and cleared: the 2026 assessment is explicit that most registered chemicals have
 * never been evaluated for endocrine-disrupting properties at all.
 *
 * Names are transcribed from a PDF and a few are truncated at a line break. The registry
 * numbers are the matching key and were checked against the EDCtox compound seed by hand.
 * Most rows are alkylphenol and nonylphenol-ethoxylate variants, which is why the list is long.
 */

export const EU_ED_LIST_URL =
  "https://edlists.org/the-ed-lists/list-i-substances-identified-as-endocrine-disruptors-by-the-eu";

export const EU_ED_LIST_SOURCE =
  "WHO/UNEP State of the Science of Endocrine-Disrupting Chemicals 2026, Annex III, table A9";

export const EU_ED_LIST_RETRIEVED = "2026-11-20";

export type EuIdentifiedEdc = { name: string; cas: string };

export const euIdentifiedEdcs: EuIdentifiedEdc[] = [
  { name: "(1R,3E,4S)-1,7,7-trimethyl-3-(4-methylbenzylidene)bicyclo[2.2.1]heptan-2-one (4-MBC)", cas: "95342-41-9" },
  { name: "(1R,3Z,4S)-1,7,7-trimethyl-3-(4-methylbenzylidene)bicyclo[2.2.1]heptan-2-one (4-MBC)", cas: "852541-21-0" },
  { name: "(1R,4S)-1,7,7-trimethyl-3-(4-methylbenzylidene)bicyclo[2.2.1]heptan-2-one (4-MBC)", cas: "741687-98-9" },
  { name: "(1S,3E,4R)-1,7,7-trimethyl-3-(4-methylbenzylidene)bicyclo[2.2.1]heptan-2-one (4-MBC)", cas: "852541-30-1" },
  { name: "(1S,3Z,4R)-1,7,7-trimethyl-3-(4-methylbenzylidene)bicyclo[2.2.1]heptan-2-one (4-MBC)", cas: "852541-25-4" },
  { name: "(3E)-1,7,7-trimethyl-3-(4-methylbenzylidene)bicyclo[2.2.1]heptan-2-one (4-MBC)", cas: "1782069-81-1" },
  { name: "(±)-1,7,7-trimethyl-3-[(4-methylphenyl)methylene]bicyclo[2.2.1]heptan-2- (4-MBC)", cas: "36861-47-9" },
  { name: "1,7,7-trimethyl-3-[(4-methylphenyl)methylene]bicyclo[2.2.1]heptan-2-one; 3-BC", cas: "15087-24-8" },
  { name: "14-(nonylphenoxy)-3,6,9,12-tetraoxatetradecan-1-ol", cas: "26264-02-8" },
  { name: "17-(4-nonylphenoxy)-3,6,9,12,15-pentaoxaheptadecan-1-ol", cas: "34166-38-6" },
  { name: "2,2-dibromo-2-cyanoacetamide (DBNPA)", cas: "10222-01-2" },
  { name: "2-(4-nonylphenoxy)ethanol", cas: "104-35-8" },
  { name: "2-(isononylphenoxy)ethanol", cas: "85005-55-6" },
  { name: "2-(nonylphenoxy)ethanol", cas: "27986-36-3" },
  { name: "2-[2-(4-nonylphenoxy)ethoxy]ethanol", cas: "20427-84-3" },
  { name: "2-[2-(nonylphenoxy)ethoxy]ethanol", cas: "27176-93-8" },
  { name: "2-[2-[2-[2-(4-nonylphenoxy)ethoxy]ethoxy]ethoxy]ethanol", cas: "7311-27-5" },
  { name: "2-[4-(1,1,3,3-tetramethylbutyl)phenoxy]ethanol", cas: "2315-67-5" },
  { name: "2-[4-(3,6-dimethylheptan-3-yl)phenoxy]ethanol", cas: "1119449-37-4" },
  { name: "2-{2-[4-(2,4,4-trimethylpentan-2-yl)phenoxy]ethoxy}ethanol", cas: "2315-61-9" },
  { name: "2-{2-[4-(3,6-dimethylheptan-3-yl)phenoxy]ethoxy}ethanol", cas: "1119449-38-5" },
  { name: "20-(4-nonylphenoxy)-3,6,9,12,15,18-hexaoxaicosan-1-ol", cas: "27942-27-4" },
  { name: "20-(isononylphenoxy)-3,6,9,12,15,18-hexaoxaicosan-1-ol", cas: "65455-69-8" },
  { name: "20-(nonylphenoxy)-3,6,9,12,15,18-hexaoxaicosan-1-ol", cas: "27177-03-3" },
  { name: "20-[4-(1,1,3,3-tetramethylbutyl)phenoxy]-3,6,9,12,15,18-hexaoxaicosan-1-ol", cas: "2497-59-8" },
  { name: "23-(nonylphenoxy)-3,6,9,12,15,18,21-heptaoxatricosan-1-ol", cas: "27177-05-5" },
  { name: "26-(4-nonylphenoxy)-3,6,9,12,15,18,21,24- octaoxahexacosan -1-ol", cas: "14409-72-4" },
  { name: "26-(nonylphenoxy)-3,6,9,12,15,18,21,24-octaoxahexacosan-1-ol", cas: "26571-11-9" },
  { name: "29-(nonylphenoxy)-3,6,9,12,15,18,21,24,27-nonaoxanonacosanol", cas: "27177-08-8" },
  { name: "3,6,9,12,15,18,21,24,27-nonaoxanonacosan-1-ol, 29-(isononylphenoxy)-", cas: "65455-72-3" },
  { name: "3,6,9,12,15-pentaoxaheptadecan-1-ol, 17-(nonylphenoxy)-", cas: "27177-01-1" },
  { name: "3,6,9,12-tetraoxatetradecan-1-ol, 14-(4-nonylphenoxy)-", cas: "20636-48-0" },
  { name: "3,6,9,12-tetraoxatetradecan-1-ol, 14-(4-nonylphenoxy)-, branched", cas: "91648-64-5" },
  { name: "4,4’-(1-methylpropylidene)bisphenol: Bisphenol B", cas: "77-40-7" },
  { name: "4,4’-isopropylidenediphenol; Bisphenol A", cas: "80-05-7" },
  { name: "4,4’-sulphonyldiphenol, Bisphenol S (BPS)", cas: "80-09-1" },
  { name: "4-(1,1,3,3-tetramethylbutyl)phenol", cas: "140-66-9" },
  { name: "4-(1,1,5-trimethylhexyl)phenol", cas: "521947-27-3" },
  { name: "4-(1-ethyl-1,3-dimethylpentyl)phenol", cas: "186825-36-5" },
  { name: "4-(1-ethyl-1,4-dimethylpentyl)phenol", cas: "142731-63-3" },
  { name: "4-(1-ethyl-1-methylhexyl)phenol", cas: "52427-13-1" },
  { name: "4-(2,2-dimethylpentan-3-yl)phenol", cas: "861010-65-3" },
  { name: "4-(2,3,3-trimethylbutan-2-yl)phenol", cas: "72861-06-4" },
  { name: "4-(2,3-dimethylpentan-2-yl)phenol", cas: "861011-60-1" },
  { name: "4-(2,4-dimethylpentan-2-yl)phenol", cas: "33104-11-9" },
  { name: "4-(2,4-dimethylpentan-3-yl)phenol", cas: "1824346-00-0" },
  { name: "4-(2-methylhexan-2-yl)phenol", cas: "30784-31-7" },
  { name: "4-(3,3-dimethylpentan-2-yl)phenol", cas: "911371-06-7" },
  { name: "4-(3-ethylheptan-2-yl)phenol", cas: "186825-39-8" },
  { name: "4-(3-ethylpentan-3-yl)phenol", cas: "37872-24-5" },
  { name: "4-(3-ethylpentyl)phenol", cas: "911370-98-4" },
  { name: "4-(3-methylhexan-2-yl)phenol", cas: "854904-93-1" },
  { name: "4-(3-methylhexan-3-yl)phenol", cas: "30784-32-8" },
  { name: "4-(3-methylhexyl)phenol", cas: "102570-52-5" },
  { name: "4-(4,4-dimethylpentan-2-yl)phenol", cas: "911371-07-8" },
  { name: "4-(4-methylhexan-2-yl)phenol", cas: "71945-81-8" },
  { name: "4-(4-methylhexyl)phenol", cas: "1139800-98-8" },
  { name: "4-(5-methylhexan-2-yl)phenol", cas: "857629-71-1" },
  { name: "4-(5-methylhexan-3-yl)phenol", cas: "854904-92-0" },
  { name: "4-(5-methylhexyl)phenol", cas: "100532-36-3" },
  { name: "4-(heptan-2-yl)phenol", cas: "6863-24-7" },
  { name: "4-(heptan-3-yl)phenol", cas: "6465-74-3" },
  { name: "4-(heptan-4-yl)phenol", cas: "6465-71-0" },
  { name: "4-heptylphenol", cas: "1987-50-4" },
  { name: "4-isododecylphenol", cas: "27459-10-5" },
  { name: "4-nonylphenol, branched, ethoxylated", cas: "127087-87-0" },
  { name: "4-nonylphenol, branched, ethoxylated 1 - 2.5 moles ethoxylated", cas: "127087-87-0" },
  { name: "4-nonylphenol, ethoxylated 1 - 2.5 moles ethoxylated", cas: "26027-38-3" },
  { name: "4-t-nonylphenol-diethoxylate", cas: "156609-10-8" },
  { name: "4-tert-butylphenol", cas: "98-54-4" },
  { name: "44-(nonylphenoxy)-3,6,9,12,15,18,21,24,27,30,33,36,39,42-tetradecaoxatetratetracontanol", cas: "57321-10-5" },
  { name: "Asulam", cas: "3337-71-1" },
  { name: "Benthiavalicarb", cas: "413615-35-7" },
  { name: "Benzyl butyl phthalate (BBP)", cas: "85-68-7" },
  { name: "Bis(2-ethylhexyl) phthalate (DEHP)", cas: "117-81-7" },
  { name: "Butyl 4-hydroxybenzoate; Butylparaben", cas: "94-26-8" },
  { name: "Cholecalciferol", cas: "67-97-0" },
  { name: "Clofentezine", cas: "74115-24-5" },
  { name: "Cyanamide", cas: "420-04-2" },
  { name: "Dibutyl phthalate (DBP)", cas: "84-74-2" },
  { name: "Dicyclohexyl phthalate (DCHP)", cas: "84-61-7" },
  { name: "Diisobutyl phthalate", cas: "84-69-5" },
  { name: "Dimethomorph", cas: "110488-70-5" },
  { name: "Flufenacet", cas: "142459-58-3" },
  { name: "Isobutyl 4-hydroxybenzoate; Isobutylparaben", cas: "4247-02-3" },
  { name: "Isononylphenol", cas: "11066-49-2" },
  { name: "Isononylphenol, ethoxylated", cas: "37205-87-1" },
  { name: "Mancozeb", cas: "8018-01-7" },
  { name: "Medetomidine", cas: "86347-14-0" },
  { name: "Mepanipyrim", cas: "110235-47-7" },
  { name: "Metiram", cas: "9006-42-2" },
  { name: "Metribuzin", cas: "21087-64-9" },
  { name: "Nonylphenol", cas: "25154-52-3" },
  { name: "Nonylphenol, branched, ethoxylated 1 - 2.5 moles ethoxylated", cas: "68412-54-4" },
  { name: "Nonylphenol, ethoxylated", cas: "9016-45-9" },
  { name: "Nonylphenol, ethoxylated (10-EO)", cas: "9016-45-9" },
  { name: "Nonylphenol, ethoxylated (15-EO)", cas: "9016-45-9" },
  { name: "Nonylphenol, ethoxylated (6,5-EO)", cas: "9016-45-9" },
  { name: "Nonylphenol, ethoxylated (8-EO)", cas: "9016-45-9" },
  { name: "Nonylphenol, ethoxylated (EO = 10)", cas: "9016-45-9" },
  { name: "Nonylphenol, ethoxylated (EO = 4)", cas: "127087-87-0" },
  { name: "Nonylphenol, ethoxylated (polymer)", cas: "9016-45-9" },
  { name: "Nonylphenolpolyglycolether", cas: "9016-45-9" },
  { name: "p-(1,1-dimethylheptyl)phenol", cas: "30784-30-6" },
  { name: "p-(1,1-dimethylpropyl)phenol", cas: "80-46-6" },
  { name: "p-(1-methyloctyl)phenol", cas: "17404-66-9" },
  { name: "p-isononylphenol", cas: "26543-97-5" },
  { name: "p-nonylphenol", cas: "104-40-5" },
  { name: "Phenol, (tetrapropenyl) derivatives", cas: "74499-35-7" },
  { name: "Phenol, 4-(1-ethyl-1,2-dimethylpropyl)-", cas: "30784-27-1" },
  { name: "Phenol, 4-dodecyl, branched", cas: "210555-94-5" },
  { name: "Phenol, 4-isododecyl-", cas: "27147-75-7" },
  { name: "Phenol, 4-nonyl-, branched", cas: "84852-15-3" },
  { name: "Phenol, 4-nonyl-, phosphite (3:1)", cas: "3050-88-2" },
  { name: "Phenol, 4-tert-heptyl-", cas: "288864-02-8" },
  { name: "Phenol, dodecyl-, branched", cas: "121158-58-5" },
  { name: "Phenol, heptyl derivs", cas: "72624-02-3" },
  { name: "Phenol, nonyl-, branched", cas: "90481-04-2" },
  { name: "Phenol, p-isononyl-, phosphite (3:1)", cas: "31631-13-7" },
  { name: "Phenol, p-sec-nonyl-, phosphite", cas: "106599-06-8" },
  { name: "Phenol, tetrapropylene-", cas: "57427-55-1" },
  { name: "Poly (oxy-1,2-ethanediyl), alpha -(nonylphenyl)-omega-hydroxy-, branched", cas: "68412-54-4" },
  { name: "Poly(oxy-1,2-ethanediyl), a-(nonylphenyl)-w-hydroxy-", cas: "9016-45-9" },
  { name: "Poly(oxy-1,2-ethanediyl), α-(nonylphenyl)-ω-hydroxy-, branched", cas: "68412-53-3" },
  { name: "Poly(oxy-1,2-ethanediyl), α-[(1,1,3,3-tetramethylbutyl)phenyl]-ω-hydroxy-", cas: "9036-19-5" },
  { name: "Polyethylene glycol p-(1,1,3,3-tetramethylbutyl)phenyl ether", cas: "9002-93-1" },
  { name: "Propiconazole", cas: "60207-90-1" },
  { name: "Reaction product of 1,3,4-thiadiazolidine-2,5-dithione, formaldehyde and phenol, heptyl derivs.", cas: "1471311-26-8" },
  { name: "Triflusulfuron-methyl", cas: "126535-15-7" },
  { name: "Triphenyl phosphate (TPP)", cas: "115-86-6" },
  { name: "Tris (4-nonylphenol, branched) phosphite (TNPP)", cas: "26523-78-4" },
  { name: "Tris(nonylphenyl) phosphite", cas: "26523-78-4" },
];

/** Registry numbers on the list, for matching a compound seed. */
export const euIdentifiedCas = new Map<string, string>(
  euIdentifiedEdcs.map((row) => [row.cas, row.name]),
);
