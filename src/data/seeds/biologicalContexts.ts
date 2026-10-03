export type BiologicalContextSeed = {
  stableKey: string;
  organ?: string;
  tissue?: string;
  cellType?: string;
  subcellularCompartment?: string;
  notes: string;
};

export const biologicalContexts: BiologicalContextSeed[] = [
  {
    stableKey: "hypothalamus",
    organ: "Brain",
    tissue: "Hypothalamus",
    notes: "Shared tissue lookup. A finding still records its own species.",
  },
  {
    stableKey: "pituitary",
    organ: "Pituitary",
    notes: "Shared tissue lookup.",
  },
  {
    stableKey: "ovary",
    organ: "Ovary",
    notes: "Shared tissue lookup.",
  },
  {
    stableKey: "ovarian-granulosa-cell",
    organ: "Ovary",
    cellType: "Granulosa cell",
    notes: "Cell type is narrower than ovary.",
  },
  {
    stableKey: "testis",
    organ: "Testis",
    notes: "Shared tissue lookup.",
  },
  {
    stableKey: "leydig-cell",
    organ: "Testis",
    cellType: "Leydig cell",
    notes: "Cell type is narrower than testis.",
  },
  {
    stableKey: "sertoli-cell",
    organ: "Testis",
    cellType: "Sertoli cell",
    notes: "Cell type is narrower than testis.",
  },
  {
    stableKey: "placenta",
    organ: "Placenta",
    notes: "Shared tissue lookup.",
  },
  {
    stableKey: "liver-hepatocyte",
    organ: "Liver",
    cellType: "Hepatocyte",
    notes: "Shared tissue lookup.",
  },
  {
    stableKey: "skeletal-muscle-myocyte",
    organ: "Skeletal muscle",
    cellType: "Myocyte",
    notes: "Shared tissue lookup.",
  },
  {
    stableKey: "adipose-adipocyte",
    organ: "Adipose",
    cellType: "Adipocyte",
    notes: "Shared tissue lookup.",
  },
  {
    stableKey: "pancreatic-beta-cell",
    organ: "Pancreas",
    cellType: "Beta cell",
    notes: "Shared tissue lookup.",
  },
  {
    stableKey: "dopaminergic-neuron",
    organ: "Brain",
    cellType: "Dopaminergic neuron",
    notes: "Neuronal context. A mitochondrial endpoint in this cell is not the same row as a whole-organism endocrine effect.",
  },
  {
    stableKey: "hippocampal-neuron",
    organ: "Brain",
    tissue: "Hippocampus",
    cellType: "Neuron",
    notes: "Shared tissue lookup.",
  },
  {
    stableKey: "mitochondrion",
    subcellularCompartment: "Mitochondrion",
    notes: "Subcellular context. It does not name an organ.",
  },
];
