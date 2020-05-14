export interface Category {
  category: string;
  pallets: Pallet[];
}

export interface Pallet {
  id: number;
  name: string;
  description: string;
  homepage: string;
  github: string;
  documentation: string;
  icon: string;
  version: string;
}