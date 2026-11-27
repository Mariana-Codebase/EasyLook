import type { GarmentCategory } from './schema';

/** Every store, brand and garment below is fictional. */

export interface SeedStore {
  name: string;
  style: string;
  description: string;
}

export interface SeedOccasion {
  code: string;
  name: string;
  description: string;
  recommendedStyles: string[];
}

export interface SeedGarment {
  /** Only set when a document or example needs a stable, well-known id. */
  id?: string;
  name: string;
  store: string;
  category: GarmentCategory;
  priceCop: number;
  style: string;
  color: string;
  occasions: string[];
  description?: string;
  active?: boolean;
}

export const seedStores: SeedStore[] = [
  { name: 'Atelier Norte', style: 'elegant', description: 'Prendas de corte limpio para noches y eventos.' },
  { name: 'Pliegue Studio', style: 'minimal', description: 'Básicos de diseño en tonos neutros.' },
  { name: 'Calle Ocre', style: 'streetwear', description: 'Ropa urbana, holgada y cómoda.' },
  { name: 'Lino & Sal', style: 'boho', description: 'Fibras naturales y estampados para clima cálido.' },
  { name: 'Noche Prisma', style: 'bold', description: 'Brillos, color y piezas para la fiesta.' },
  { name: 'Vereda Clásica', style: 'classic', description: 'Sastrería y piezas atemporales para la oficina.' },
  { name: 'Algodón de Barrio', style: 'casual', description: 'Ropa de diario a buen precio.' },
];

export const seedOccasions: SeedOccasion[] = [
  {
    code: 'date',
    name: 'Cita',
    description: 'Una salida especial en pareja.',
    recommendedStyles: ['elegant', 'romantic', 'minimal'],
  },
  {
    code: 'office',
    name: 'Oficina',
    description: 'Jornada laboral con código de vestuario formal o semiformal.',
    recommendedStyles: ['classic', 'minimal', 'elegant'],
  },
  {
    code: 'brunch',
    name: 'Brunch',
    description: 'Plan de media mañana, relajado pero cuidado.',
    recommendedStyles: ['boho', 'casual', 'minimal', 'romantic'],
  },
  {
    code: 'party',
    name: 'Fiesta',
    description: 'Noche de rumba o celebración.',
    recommendedStyles: ['bold', 'elegant', 'streetwear'],
  },
  {
    code: 'casual',
    name: 'Casual',
    description: 'Día a día, diligencias o plan informal.',
    recommendedStyles: ['casual', 'streetwear', 'boho'],
  },
];

const clothingSizes = ['XS', 'S', 'M', 'L', 'XL'];
const shoeSizes = ['35', '36', '37', '38', '39', '40'];

export function sizesFor(category: GarmentCategory): string[] {
  if (category === 'shoes') return shoeSizes;
  if (category === 'accessory') return [];
  return clothingSizes;
}

/** Id used in the README example for adding a garment to an outfit. */
export const BLAZER_CREMA_ID = '28a58b2a-c847-44d4-a2ca-ec1dc35b1001';

export const seedGarments: SeedGarment[] = [
  // Tops
  { name: 'Top satinado', store: 'Atelier Norte', category: 'top', priceCop: 129900, style: 'elegant', color: 'champana', occasions: ['date', 'party'] },
  { name: 'Blusa clásica', store: 'Vereda Clásica', category: 'top', priceCop: 89900, style: 'classic', color: 'blanco', occasions: ['office', 'date'] },
  { name: 'Camisa de seda', store: 'Atelier Norte', category: 'top', priceCop: 179900, style: 'elegant', color: 'marfil', occasions: ['office', 'date'] },
  { name: 'Camiseta básica', store: 'Algodón de Barrio', category: 'top', priceCop: 39900, style: 'casual', color: 'blanco', occasions: ['casual', 'brunch'] },
  { name: 'Suéter de punto fino', store: 'Pliegue Studio', category: 'top', priceCop: 119900, style: 'minimal', color: 'gris', occasions: ['office', 'casual', 'brunch'] },
  { name: 'Blusa de encaje', store: 'Atelier Norte', category: 'top', priceCop: 139900, style: 'romantic', color: 'rosa', occasions: ['date', 'brunch'] },
  { name: 'Top de lentejuelas', store: 'Noche Prisma', category: 'top', priceCop: 149900, style: 'bold', color: 'plateado', occasions: ['party'] },
  { name: 'Crop top', store: 'Calle Ocre', category: 'top', priceCop: 59900, style: 'streetwear', color: 'negro', occasions: ['party', 'casual'] },
  { name: 'Blusa campesina', store: 'Lino & Sal', category: 'top', priceCop: 79900, style: 'boho', color: 'crudo', occasions: ['brunch', 'casual'] },
  { name: 'Camisa de lino', store: 'Lino & Sal', category: 'top', priceCop: 109900, style: 'boho', color: 'beige', occasions: ['brunch', 'casual', 'office'] },
  { name: 'Top asimétrico', store: 'Pliegue Studio', category: 'top', priceCop: 99900, style: 'minimal', color: 'negro', occasions: ['date', 'party'] },
  { name: 'Hoodie oversize', store: 'Calle Ocre', category: 'top', priceCop: 129900, style: 'streetwear', color: 'verde-oliva', occasions: ['casual'] },

  // Bottoms
  { name: 'Pantalón sastre', store: 'Vereda Clásica', category: 'bottom', priceCop: 159900, style: 'classic', color: 'negro', occasions: ['office', 'date'] },
  { name: 'Falda midi', store: 'Pliegue Studio', category: 'bottom', priceCop: 109900, style: 'minimal', color: 'camel', occasions: ['office', 'brunch', 'date'] },
  { name: 'Jean recto', store: 'Algodón de Barrio', category: 'bottom', priceCop: 119900, style: 'casual', color: 'azul', occasions: ['casual', 'brunch'] },
  { name: 'Pantalón palazzo', store: 'Atelier Norte', category: 'bottom', priceCop: 169900, style: 'elegant', color: 'negro', occasions: ['date', 'party', 'office'] },
  { name: 'Falda plisada', store: 'Atelier Norte', category: 'bottom', priceCop: 139900, style: 'romantic', color: 'rosa-palo', occasions: ['date', 'brunch'] },
  { name: 'Short de lino', store: 'Lino & Sal', category: 'bottom', priceCop: 79900, style: 'boho', color: 'blanco', occasions: ['brunch', 'casual'] },
  { name: 'Cargo ancho', store: 'Calle Ocre', category: 'bottom', priceCop: 139900, style: 'streetwear', color: 'caqui', occasions: ['casual', 'party'] },
  { name: 'Falda de cuero sintético', store: 'Noche Prisma', category: 'bottom', priceCop: 149900, style: 'bold', color: 'negro', occasions: ['party', 'date'] },
  { name: 'Pantalón recto de lana', store: 'Pliegue Studio', category: 'bottom', priceCop: 189900, style: 'minimal', color: 'gris', occasions: ['office'] },
  { name: 'Falda boho estampada', store: 'Lino & Sal', category: 'bottom', priceCop: 99900, style: 'boho', color: 'terracota', occasions: ['brunch', 'casual'] },
  { name: 'Jogger', store: 'Algodón de Barrio', category: 'bottom', priceCop: 69900, style: 'casual', color: 'gris', occasions: ['casual'] },

  // Dresses
  { name: 'Vestido negro midi', store: 'Atelier Norte', category: 'dress', priceCop: 249900, style: 'elegant', color: 'negro', occasions: ['date', 'party'] },
  { name: 'Vestido camisero', store: 'Vereda Clásica', category: 'dress', priceCop: 189900, style: 'classic', color: 'azul-marino', occasions: ['office', 'brunch'] },
  { name: 'Vestido floral', store: 'Lino & Sal', category: 'dress', priceCop: 159900, style: 'boho', color: 'estampado', occasions: ['brunch', 'date', 'casual'] },
  { name: 'Vestido slip satinado', store: 'Noche Prisma', category: 'dress', priceCop: 229900, style: 'bold', color: 'esmeralda', occasions: ['party', 'date'] },
  { name: 'Vestido de punto', store: 'Pliegue Studio', category: 'dress', priceCop: 199900, style: 'minimal', color: 'camel', occasions: ['office', 'date'] },
  { name: 'Vestido de tul', store: 'Atelier Norte', category: 'dress', priceCop: 329900, style: 'romantic', color: 'lila', occasions: ['date', 'party'] },
  { name: 'Vestido camiseta', store: 'Algodón de Barrio', category: 'dress', priceCop: 79900, style: 'casual', color: 'gris', occasions: ['casual', 'brunch'] },

  // Shoes
  { name: 'Tacones negros', store: 'Atelier Norte', category: 'shoes', priceCop: 199900, style: 'elegant', color: 'negro', occasions: ['date', 'party', 'office'] },
  { name: 'Baletas', store: 'Vereda Clásica', category: 'shoes', priceCop: 99900, style: 'classic', color: 'nude', occasions: ['office', 'brunch', 'date', 'casual'] },
  { name: 'Mocasines', store: 'Vereda Clásica', category: 'shoes', priceCop: 169900, style: 'classic', color: 'cafe', occasions: ['office'] },
  { name: 'Tenis blancos', store: 'Algodón de Barrio', category: 'shoes', priceCop: 129900, style: 'casual', color: 'blanco', occasions: ['casual', 'brunch'] },
  { name: 'Sandalias de tiras', store: 'Lino & Sal', category: 'shoes', priceCop: 89900, style: 'boho', color: 'cafe', occasions: ['brunch', 'casual', 'date'] },
  { name: 'Botines de plataforma', store: 'Calle Ocre', category: 'shoes', priceCop: 219900, style: 'streetwear', color: 'negro', occasions: ['party', 'casual'] },
  { name: 'Sandalias metalizadas', store: 'Noche Prisma', category: 'shoes', priceCop: 179900, style: 'bold', color: 'dorado', occasions: ['party', 'date'] },
  { name: 'Zapatos de tacón bajo', store: 'Pliegue Studio', category: 'shoes', priceCop: 149900, style: 'minimal', color: 'negro', occasions: ['office', 'date'] },
  { name: 'Tenis de lona', store: 'Calle Ocre', category: 'shoes', priceCop: 79900, style: 'streetwear', color: 'negro', occasions: ['casual'] },

  // Outerwear
  { id: BLAZER_CREMA_ID, name: 'Blazer crema', store: 'Atelier Norte', category: 'outerwear', priceCop: 149900, style: 'elegant', color: 'crema', occasions: ['office', 'date', 'brunch'] },
  { name: 'Gabardina', store: 'Vereda Clásica', category: 'outerwear', priceCop: 299900, style: 'classic', color: 'beige', occasions: ['office', 'date'] },
  { name: 'Chaqueta de jean', store: 'Algodón de Barrio', category: 'outerwear', priceCop: 139900, style: 'casual', color: 'azul', occasions: ['casual', 'brunch'] },
  { name: 'Chaqueta bomber', store: 'Calle Ocre', category: 'outerwear', priceCop: 189900, style: 'streetwear', color: 'negro', occasions: ['party', 'casual'] },
  { name: 'Kimono estampado', store: 'Lino & Sal', category: 'outerwear', priceCop: 119900, style: 'boho', color: 'estampado', occasions: ['brunch', 'casual'] },
  { name: 'Blazer de terciopelo', store: 'Noche Prisma', category: 'outerwear', priceCop: 239900, style: 'bold', color: 'vino', occasions: ['party'] },
  { name: 'Cárdigan largo', store: 'Pliegue Studio', category: 'outerwear', priceCop: 159900, style: 'minimal', color: 'gris', occasions: ['office', 'casual'] },

  // Accessories
  { name: 'Bolso de mano dorado', store: 'Noche Prisma', category: 'accessory', priceCop: 89900, style: 'bold', color: 'dorado', occasions: ['party', 'date'] },
  { name: 'Cinturón de cuero', store: 'Vereda Clásica', category: 'accessory', priceCop: 59900, style: 'classic', color: 'cafe', occasions: ['office', 'casual', 'brunch'] },
  { name: 'Aretes de perla', store: 'Atelier Norte', category: 'accessory', priceCop: 69900, style: 'elegant', color: 'marfil', occasions: ['date', 'office', 'party'] },
  { name: 'Sombrero de paja', store: 'Lino & Sal', category: 'accessory', priceCop: 49900, style: 'boho', color: 'natural', occasions: ['brunch', 'casual'] },
  { name: 'Gorra', store: 'Calle Ocre', category: 'accessory', priceCop: 39900, style: 'streetwear', color: 'negro', occasions: ['casual'] },
  { name: 'Bolso tote', store: 'Pliegue Studio', category: 'accessory', priceCop: 109900, style: 'minimal', color: 'negro', occasions: ['office', 'brunch', 'casual'] },
  { name: 'Pañoleta de seda', store: 'Atelier Norte', category: 'accessory', priceCop: 59900, style: 'romantic', color: 'rosa', occasions: ['brunch', 'date'] },

  // Discontinued piece, kept to show soft deletion in the catalog
  { name: 'Chaleco de punto', store: 'Pliegue Studio', category: 'outerwear', priceCop: 99900, style: 'minimal', color: 'crudo', occasions: ['office', 'casual'], active: false },
];
